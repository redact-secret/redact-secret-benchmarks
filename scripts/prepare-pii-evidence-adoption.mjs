import { applyEvidenceAdoption, prepareEvidenceAdoptionReview } from './lib/pii-evidence-adoption-apply.mjs';
import { parseEvidenceJson as parseProposalJson } from './lib/pii-evidence-json.mjs';
export { parseEvidenceJson as parseProposalJson } from './lib/pii-evidence-json.mjs';
import { readFileSync, existsSync, lstatSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preparePiiEvidenceAdoption, adoptionSummary, validateActiveEvidenceAdoption, validateReadyEvidenceAdoption } from './lib/pii-evidence-adoption.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const refuse = code => { throw new Error(`PII adoption refusal: ${code}`); };
const json = value => `${JSON.stringify(value, null, 2)}\n`;
function readPublicRecord(file, maximumBytes = 2 * 1024 * 1024) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximumBytes) refuse('input-not-bounded-regular-file');
  return parseProposalJson(readFileSync(file, 'utf8'));
}

function newScratchDirectory(root, outDir) {
  // Only a new scratch proposal directory is writable; repository pins and records are never output targets.
  if (typeof outDir !== 'string' || !/^results-output\/pii-evidence-adoption\/[a-z0-9][a-z0-9-]{0,79}$/.test(outDir)) refuse('unsafe-output-path');
  const destination = join(root, outDir);
  if (existsSync(destination)) refuse('output-already-exists');
  const resolvedRoot = realpathSync(root);
  let parent = root;
  for (const part of ['results-output', 'pii-evidence-adoption']) {
    parent = join(parent, part);
    if (existsSync(parent)) {
      const stat = lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== join(resolvedRoot, ...outDir.split('/').slice(0, part === 'results-output' ? 1 : 2)))
        refuse('unsafe-output-parent');
    } else mkdirSync(parent, { mode: 0o700 });
  }
  // mkdir is exclusive even if another caller races the earlier existence check.
  mkdirSync(destination, { mode: 0o700 });
  return destination;
}

export function prepareAdoptionFiles({ root = ROOT, preflightFile, previousFile, scannerFile, previousScannerFile, acceptanceFile, outDir }) {
  const policy = readPublicRecord(join(root, 'benchmarks/pii-population-policy.json'));
  const candidate = preparePiiEvidenceAdoption({ policy, preflight: readPublicRecord(preflightFile),
    previousPreflight: previousFile ? readPublicRecord(previousFile) : null,
    scanner: scannerFile ? readPublicRecord(scannerFile) : null,
    previousScanner: previousScannerFile ? readPublicRecord(previousScannerFile) : null,
    acceptance: acceptanceFile ? readPublicRecord(acceptanceFile) : null });
  const destination = newScratchDirectory(root, outDir);
  try {
    writeFileSync(join(destination, 'candidate.json'), json(candidate), { flag: 'wx', mode: 0o600 });
    writeFileSync(join(destination, 'summary.md'), adoptionSummary(candidate), { flag: 'wx', mode: 0o600 });
    // A separate accept tool must validate a canonical measurement receipt; this plan cannot apply itself.
    writeFileSync(join(destination, 'acceptance-plan.json'), json({ schema: 'pii-evidence-acceptance-plan/1',
      candidateDigest: candidate.candidateDigest, canApply: false, state: 'proposal', activeWrites: [],
      preserveHistorical: candidate.historical, required: ['strict-canonical-measurement-receipt', 'external-maintainer-acceptance', 'reviewed-active-pin-update'],
      authorityChanged: false, ownerAcceptanceGenerated: false }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  return candidate;
}

export function prepareAcceptedAdoptionFiles({ root = ROOT, bundleFile, costDecisionFile, outDir }) {
  const input = readPublicRecord(bundleFile, 32 * 1024 * 1024), validated = validateActiveEvidenceAdoption(input);
  const review = costDecisionFile ? prepareEvidenceAdoptionReview({ root, bundle: input, costDecision: readPublicRecord(costDecisionFile) }) : null;
  const latest = input.history.at(-1);
  const entry = { preflight: input.preflight, candidate: input.candidate, acceptance: input.acceptance, comparison: input.comparison, retainedFiles: input.retainedFiles };
  const destination = newScratchDirectory(root, outDir);
  try {
    const files = {
      'validated-adoption.json': validated,
      'proposed-active.json': { snapshotPin: validated.snapshotPin, consumerPin: validated.consumerPin, preflight: input.preflight },
      // Preserve original receipt bytes, artifacts and approvals, not only their digests.
      'proposed-history.json': { schema: 'pii-evidence-adoption-history/1', entries: [...input.history, entry] },
      'rollback.json': { snapshotPin: latest?.preflight.evidence ?? input.snapshotPin,
        consumerPin: latest?.preflight.consumer ?? input.consumerPin, preflight: latest?.preflight ?? input.preflight, history: input.history },
      'apply-plan.json': { schema: 'pii-evidence-reviewed-update-plan/1', state: 'unapplied', candidateDigest: validated.candidateDigest,
        repositoryWritesApplied: [], ownerAcceptanceGenerated: false, authorityChanged: false,
        preserve: 'proposed-history.json', rollback: 'rollback.json',
        proposedTargets: ['benchmarks/pii-evidence/snapshot-pin.json', 'benchmarks/pii-evidence/consumer-pin.json', 'benchmarks/pii-evidence/preflight.json'],
        prerequisites: ['authenticate-external-maintainer-record', 'review-active-pins-and-retained-history', 'separate-authorized-local-update'] },
    };
    if (review) files['review-package.json'] = review;
    for (const [name, content] of Object.entries(files)) writeFileSync(join(destination, name), json(content), { flag: 'wx', mode: 0o600 });
  } catch (error) { rmSync(destination, { recursive: true, force: true }); throw error; }
  return validated;
}

export function prepareReadyAdoptionFiles({ root = ROOT, bundleFile, outDir }) {
  const input = readPublicRecord(bundleFile, 32 * 1024 * 1024), validated = validateReadyEvidenceAdoption(input);
  const destination = newScratchDirectory(root, outDir), previous = input.history.at(-1);
  try {
    const files = {
      'ready-for-acceptance.json': validated,
      'proposed-active.json': { snapshotPin: input.snapshotPin, consumerPin: input.consumerPin, preflight: input.preflight },
      'proposed-history.json': { schema: 'pii-evidence-adoption-history/1', entries: [...input.history,
        { preflight: input.preflight, candidate: input.candidate, acceptance: null, comparison: input.comparison, retainedFiles: input.retainedFiles }] },
      'rollback.json': { snapshotPin: previous?.preflight.evidence, consumerPin: previous?.preflight.consumer,
        preflight: previous?.preflight, comparison: previous?.comparison, retainedFiles: previous?.retainedFiles },
      'apply-plan.json': { schema: 'pii-evidence-ready-update-plan/1', state: 'ready-for-acceptance', canApply: false,
        candidateDigest: validated.candidateDigest, acceptance: null, ownerAcceptanceGenerated: false,
        authorityChanged: false, repositoryWritesApplied: [],
        prerequisite: 'external-maintainer-acceptance-bound-to-this-candidate-digest',
        nextCommand: 'prepare-pii-evidence-adoption --validate-adoption with externally accepted bundle and exact cost decision' },
    };
    for (const [name, content] of Object.entries(files)) writeFileSync(join(destination, name), json(content), { flag: 'wx', mode: 0o600 });
  } catch (error) { rmSync(destination, { recursive: true, force: true }); throw error; }
  return validated;
}

export function main(argv, { root = ROOT, out = console.log, err = console.error } = {}) {
  try {
    const known = new Set(['preflight', 'previous', 'scanner', 'previous-scanner', 'acceptance', 'out-dir', 'validate-adoption', 'prepare-acceptance', 'apply-adoption', 'cost-decision']);
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
      const key = argv[index]?.slice(2), value = argv[index + 1];
      if (!argv[index]?.startsWith('--') || !known.has(key) || options[key] !== undefined || !value || value.startsWith('--')) refuse('invalid-arguments');
      options[key] = value;
    }
    if (options['apply-adoption']) {
      if (Object.keys(options).length !== 1) refuse('invalid-arguments');
      const result = applyEvidenceAdoption({ root, reviewPackage: readPublicRecord(resolve(root, options['apply-adoption']), 32 * 1024 * 1024) });
      out(`Applied external adoption ${result.candidateDigest}; authority and owner criteria unchanged.`); return 0;
    }
    if (!options['out-dir'] || (!options.preflight && !options['validate-adoption'] && !options['prepare-acceptance'])) refuse('missing-arguments');
    const file = name => options[name] ? resolve(root, options[name]) : undefined;
    if (options['prepare-acceptance']) {
      if (Object.keys(options).some(key => !['prepare-acceptance', 'out-dir'].includes(key))) refuse('invalid-arguments');
      const result = prepareReadyAdoptionFiles({ root, bundleFile: file('prepare-acceptance'), outDir: options['out-dir'] });
      out(`Ready for external acceptance ${result.candidateDigest}; no active writes or acceptance generated.`); return 0;
    }
    if (options['validate-adoption']) {
      if (Object.keys(options).some(key => !['validate-adoption', 'out-dir', 'cost-decision'].includes(key))) refuse('invalid-arguments');
      const result = prepareAcceptedAdoptionFiles({ root, bundleFile: file('validate-adoption'), costDecisionFile: file('cost-decision'), outDir: options['out-dir'] });
      out(`Validated external adoption ${result.candidateDigest}; proposed local changes only.`); return 0;
    }
    if (options['cost-decision']) refuse('invalid-arguments');
    const result = prepareAdoptionFiles({ root, preflightFile: file('preflight'), previousFile: file('previous'), scannerFile: file('scanner'),
      previousScannerFile: file('previous-scanner'), acceptanceFile: file('acceptance'), outDir: options['out-dir'] });
    out(`Prepared public proposal ${result.candidateDigest}; no active writes.`);
    return 0;
  } catch {
    err('PII evidence adoption preparation refused; check the pinned public inputs and a new scratch output directory.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
