import { readFileSync, existsSync, lstatSync, realpathSync, mkdirSync, mkdtempSync, writeFileSync, chmodSync, renameSync, unlinkSync, rmSync, rmdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseEvidenceJson } from './pii-evidence-json.mjs';
import { validateActiveEvidenceAdoption, adoptionDigest } from './pii-evidence-adoption.mjs';
import { validateEvidencePins, validatePreflightReport, sha256 } from './pii-evidence-contract.mjs';
import { validateEvidenceCostDecision, evidenceDigest } from './pii-evidence-comparison-plan.mjs';
const refuse = code => { throw new Error(`PII adoption apply refusal: ${code}`); };
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const read = file => parseEvidenceJson(readFileSync(file, 'utf8'));

export function adoptionUpdateFiles(bundle, costDecision) {
  const checked = validateActiveEvidenceAdoption(bundle), comparison = bundle.comparison;
  validateEvidenceCostDecision(costDecision, { preflight: bundle.preflight, policy: bundle.policy, populationIndex: comparison.populationIndex });
  if (costDecision.state !== 'approved' || evidenceDigest(costDecision) !== comparison.plan.dispatch.costDecisionSha256) refuse('accepted-cost-mismatch');
  const entry = { preflight: bundle.preflight, candidate: bundle.candidate, acceptance: bundle.acceptance,
    comparison, retainedFiles: bundle.retainedFiles };
  const base = 'benchmarks/pii-evidence', directory = 'benchmarks/pii-evidence-comparison';
  const files = {
    [`${base}/snapshot-pin.json`]: json(bundle.snapshotPin), [`${base}/consumer-pin.json`]: json(bundle.consumerPin),
    [`${base}/preflight.json`]: json(bundle.preflight),
    [`${base}/adoption.json`]: json({ schema: 'pii-evidence-applied-adoption/1', bundle, costDecision }),
    [`${base}/history.json`]: json({ schema: 'pii-evidence-adoption-history/1', entries: [...bundle.history, entry] }),
    ...Object.fromEntries(Object.entries(bundle.retainedFiles).map(([name, text]) => [`${directory}/${name}`, text])),
    [`${directory}/record.json`]: json(comparison.record), [`${directory}/population-index.json`]: json(comparison.populationIndex),
    [`${directory}/cost-decision.json`]: json(costDecision),
  };
  if (Object.values(files).some(text => Buffer.byteLength(text) > 32 * 1024 * 1024)) refuse('output-record-too-large');
  return { checked, files };
}

function statOrMissing(file) {
  try { return lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safeFile(root, name, created = null) {
  const destination = join(root, name);
  let parent = dirname(destination);
  const missing = [];
  while (parent !== root) {
    const stat = statOrMissing(parent);
    if (stat) {
      if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(parent) !== parent) refuse('unsafe-parent');
    } else missing.unshift(parent);
    parent = dirname(parent);
  }
  if (created) for (const directory of missing) { mkdirSync(directory, { mode: 0o700 }); created.push(directory); }
  const stat = statOrMissing(destination);
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 32 * 1024 * 1024) refuse('unsafe-target');
  }
  return destination;
}

/** A future active pin is usable only with the complete external approval and canonical history. */
export function checkActiveEvidenceFiles(root) {
  root = realpathSync(root);
  const base = 'benchmarks/pii-evidence', policy = read(join(root, 'benchmarks/pii-population-policy.json'));
  const snapshot = read(safeFile(root, `${base}/snapshot-pin.json`)), consumer = read(safeFile(root, `${base}/consumer-pin.json`));
  const preflight = read(safeFile(root, `${base}/preflight.json`)), adoptionFile = safeFile(root, `${base}/adoption.json`);
  if (existsSync(adoptionFile)) {
    const adoption = read(adoptionFile);
    if (!exact(adoption, ['schema', 'bundle', 'costDecision']) || adoption.schema !== 'pii-evidence-applied-adoption/1') refuse('active-adoption-invalid');
    const { files } = adoptionUpdateFiles(adoption.bundle, adoption.costDecision);
    if (adoptionDigest(policy) !== adoptionDigest(adoption.bundle.policy)) refuse('active-policy-mismatch');
    for (const [name, text] of Object.entries(files))
      if (!existsSync(safeFile(root, name)) || sha256(readFileSync(join(root, name))) !== sha256(text)) refuse('active-file-mismatch');
  } else {
    validateEvidencePins(snapshot, consumer); validatePreflightReport(preflight, policy);
  }
  if (sha256(readFileSync(join(root, 'benchmarks/pii-eval-population-pins.json'))) !== consumer.preservedPopulationPinsSha256) refuse('four-population-pins-changed');
  return { snapshotPin: snapshot, consumerPin: consumer, preflight, policy };
}

export function prepareEvidenceAdoptionReview({ root, bundle, costDecision }) {
  root = realpathSync(root);
  const { files } = adoptionUpdateFiles(bundle, costDecision);
  checkActiveEvidenceFiles(root);
  const expectedPriorSha256 = Object.fromEntries(Object.keys(files).sort().map(name => {
    const file = safeFile(root, name);
    return [name, existsSync(file) ? sha256(readFileSync(file)) : null];
  }));
  return { schema: 'pii-evidence-adoption-review-package/1', bundle: structuredClone(bundle),
    costDecision: structuredClone(costDecision), expectedPriorSha256 };
}

/** All replacements are staged first; a failed replacement restores exact original bytes. */
export function applyEvidenceAdoption({ root, reviewPackage, beforeReplace = () => {} }) {
  root = realpathSync(root);
  if (!exact(reviewPackage, ['schema', 'bundle', 'costDecision', 'expectedPriorSha256']) || reviewPackage.schema !== 'pii-evidence-adoption-review-package/1') refuse('review-package-invalid');
  const { checked, files } = adoptionUpdateFiles(reviewPackage.bundle, reviewPackage.costDecision), names = Object.keys(files).sort();
  if (!exact(reviewPackage.expectedPriorSha256, names)) refuse('expected-prior-set-mismatch');
  const current = checkActiveEvidenceFiles(root);
  const prior = reviewPackage.bundle.history.at(-1)?.preflight ?? reviewPackage.bundle.preflight;
  if (adoptionDigest(current.snapshotPin) !== adoptionDigest(prior.evidence) ||
      adoptionDigest(current.consumerPin) !== adoptionDigest(prior.consumer) || adoptionDigest(current.preflight) !== adoptionDigest(prior)) refuse('active-history-predecessor-mismatch');
  const currentAdoption = join(root, 'benchmarks/pii-evidence/adoption.json');
  if (existsSync(currentAdoption)) {
    const old = read(currentAdoption).bundle;
    const oldEntry = { preflight: old.preflight, candidate: old.candidate, acceptance: old.acceptance,
      comparison: old.comparison, retainedFiles: old.retainedFiles };
    if (adoptionDigest(reviewPackage.bundle.history) !== adoptionDigest([...old.history, oldEntry])) refuse('active-history-prefix-mismatch');
  }
  if (adoptionDigest(read(join(root, 'benchmarks/pii-population-policy.json'))) !== adoptionDigest(reviewPackage.bundle.policy)) refuse('review-policy-mismatch');
  const previous = new Map(), priorModes = new Map();
  const inspect = () => {
    for (const name of names) {
      const file = safeFile(root, name), bytes = existsSync(file) ? readFileSync(file) : null;
      if (reviewPackage.expectedPriorSha256[name] !== (bytes === null ? null : sha256(bytes))) refuse('expected-prior-mismatch');
      previous.set(name, bytes); priorModes.set(name, bytes === null ? 0o644 : lstatSync(file).mode & 0o777);
    }
  };
  inspect();
  const lock = safeFile(root, 'benchmarks/pii-evidence/.adoption-lock');
  mkdirSync(lock, { mode: 0o700 });
  let stage, completed = false;
  const replaced = [], created = [];
  try {
    inspect();
    stage = mkdtempSync(join(root, 'benchmarks/pii-evidence/.adoption-transaction-'));
    for (const [index, name] of names.entries()) {
      writeFileSync(join(stage, `next-${index}`), files[name], { flag: 'wx', mode: 0o600 });
      chmodSync(join(stage, `next-${index}`), priorModes.get(name));
      if (previous.get(name) !== null) {
        writeFileSync(join(stage, `prior-${index}`), previous.get(name), { flag: 'wx', mode: 0o600 });
        chmodSync(join(stage, `prior-${index}`), priorModes.get(name));
      }
    }
    for (const [index, name] of names.entries()) {
      const destination = safeFile(root, name, created);
      beforeReplace(name, index);
      renameSync(join(stage, `next-${index}`), destination); replaced.push({ name, index });
    }
    checkActiveEvidenceFiles(root); completed = true;
  } catch (error) {
    try {
      for (const { name, index } of replaced.reverse()) {
        const destination = safeFile(root, name);
        if (previous.get(name) === null) unlinkSync(destination);
        else renameSync(join(stage, `prior-${index}`), destination);
      }
      for (const directory of created.reverse()) rmdirSync(directory);
    } catch { refuse('rollback-failed-transaction-backups-retained'); }
    throw error;
  } finally {
    // If rollback itself failed, retain the backups for manual recovery.
    if (stage && (completed || replaced.every(({ name }) => {
      const file = join(root, name), bytes = previous.get(name);
      return bytes === null ? !existsSync(file) : existsSync(file) && sha256(readFileSync(file)) === sha256(bytes);
    }))) rmSync(stage, { recursive: true, force: true });
    rmdirSync(lock);
  }
  return { candidateDigest: checked.candidateDigest, updatedFiles: names, authorityChanged: false, ownerAcceptanceGenerated: false };
}
