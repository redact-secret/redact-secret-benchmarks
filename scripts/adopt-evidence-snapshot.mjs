/**
 * Evidence adoption entry point (#690). One documented command per step; `.github/workflows/adopt-evidence-snapshot.yml` runs the
 * first two. Spec: docs/specs/evidence-adoption.md.
 *
 *   preflight --tag T --manifest-digest D [--dir DIR] [--engine-schema FILE] [--out FILE]
 *       Verify the immutable release assets and that the pinned engine can read the snapshot. Changes nothing.
 *       Exit 0 ready or already adopted (no-op), 3 identity/digest failure, 4 engine incompatibility, 5 conflicting adoption, 2 usage.
 *   prepare   (same arguments, plus [--previous-dir DIR] [--summary FILE])
 *       After a passing preflight: write the candidate record and the change report. Never touches a pin or the authority file.
 *   Both take [--engine-tag T --engine-revision SHA --engine-run-schema FILE]: the engine the candidate is read and replayed by, when it is
 *   not the registry's active pin (a snapshot that needs a newer engine). The record then carries `engineChange`; the active registry is untouched.
 *   Both take [--supersede]: a recorded candidate of another adoption is replaced (recorded as `supersedesCandidate`; its prepared acceptance
 *   patch is removed because it no longer matches the record) instead of exiting 5. The owner must be told to accept the new one.
 *   Same-evidence adoption (#697): when --tag and --manifest-digest are the accepted pin and the engine or product build differs from the registry's (--engine-tag with
 *   --engine-revision/--engine-run-schema, and/or --product-version with --product-integrity), the outcome is not already-pinned: the engine candidate is recorded next to the accepted
 *   adoption as `engineCandidate` (never in place of it), with --supersede replacing a recorded one.
 *   compare-runs --report FILE --old OLD_ARTIFACT --new NEW_ARTIFACT
 *       Add outcome drift between two official replays to a change report, common cases apart from added cases.
 *   repin     [--superseded-on YYYY-MM-DD]
 *       Owner acceptance branch only: move the floors pin to the recorded candidate and keep the previous runs as historical receipts.
 *       The authority file is not read or written; the owner renews it separately.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineCandidateRecord, reviewStateSummary, representationSummary, adoptionBranch, adoptionKey, candidateRecord, diffRunArtifacts, diffSnapshots, incompatibilityMessage, releaseIdentityProblems, repinPopulation, sha256Digest, snapshotCompatibility } from './evidence-adoption.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const ADOPTION_FILE = 'benchmarks/evidence-adoption.json';
const SOURCE = 'redact-secret/credential-evidence';
const POPULATION = 'public-evidence-snapshot';
const readJson = file => JSON.parse(readFileSync(path.resolve(root, file), 'utf8'));
const writeJson = (file, value) => { mkdirSync(path.dirname(path.resolve(root, file)), { recursive: true }); writeFileSync(path.resolve(root, file), `${JSON.stringify(value, null, 2)}\n`); };

const [command, ...rest] = process.argv.slice(2);
const options = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) options[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? 'true' : rest[++i];
const usage = message => { console.error(`${message}\nusage: adopt-evidence-snapshot.mjs preflight|prepare --tag <tag> --manifest-digest <sha256:...> | repin`); process.exit(2); };
const output = (name, value) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); };

function assets(tag, dir) {
  mkdirSync(dir, { recursive: true });
  // Older releases may not list every optional asset; only the manifest and the snapshot are required.
  if (!['release-manifest.json', 'credential-eval-corpus-snapshot.json', 'records-bundle.json', 'fixtures-materialized-manifest.json'].every(f => existsSync(path.join(dir, f))))
    try {
      execFileSync('gh', ['release', 'download', tag, '-R', SOURCE, '-D', dir, '-p', 'release-manifest.json', '-p', 'credential-eval-corpus-snapshot.json', '-p', 'records-bundle.json', '-p', 'fixtures-materialized-manifest.json', '--clobber'], { stdio: 'inherit' });
    } catch (error) {
      if (!['release-manifest.json', 'credential-eval-corpus-snapshot.json'].every(f => existsSync(path.join(dir, f)))) throw error;
    }
  const manifestBytes = readFileSync(path.join(dir, 'release-manifest.json'));
  const snapshotBytes = readFileSync(path.join(dir, 'credential-eval-corpus-snapshot.json'));
  const manifest = JSON.parse(manifestBytes);
  // The review state is read from the records bundle and the materialized manifest, each verified against the release manifest's listed digest.
  const extra = {};
  for (const [asset, key] of [['records-bundle.json', 'bundle'], ['fixtures-materialized-manifest.json', 'materialized']]) {
    const bytes = existsSync(path.join(dir, asset)) ? readFileSync(path.join(dir, asset)) : null;
    const listed = manifest.files?.find(f => f.asset === asset);
    extra[key] = bytes && listed && sha256Digest(bytes) === `sha256:${listed.sha256}` ? JSON.parse(bytes) : null;
  }
  return { manifestBytes, manifest, snapshotBytes, snapshot: JSON.parse(snapshotBytes), ...extra };
}

const registry = readJson('benchmarks/official-runs.json');
const inputs = readJson('benchmarks/qualification-inputs.json');
const supersede = options.supersede === 'true';
// The engine that reads (and later replays) the candidate: the active pin unless the caller names a newer tag.
const engineOverride = options['engine-tag'] !== undefined;
if (engineOverride && !/^v\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(options['engine-tag'])) usage('--engine-tag must look like v0.1.0-alpha.4');
if (engineOverride && !/^[0-9a-f]{40}$/.test(options['engine-revision'] ?? '')) usage('--engine-revision (the 40-hex commit of the engine tag) is required with --engine-tag');
if (engineOverride && !options['engine-run-schema']) usage('--engine-run-schema (the engine run-artifact schema at that tag) is required with --engine-tag');
const engine = !engineOverride ? registry.engine : {
  ...registry.engine, tag: options['engine-tag'], revision: options['engine-revision'], version: options['engine-tag'].replace(/^v/, ''),
  runArtifactSchema: { ...registry.engine.runArtifactSchema, sha256: sha256Digest(readFileSync(options['engine-run-schema'])) },
};
// The product build the replay scans, when it is not the registry's (#697): the same-evidence engine candidate.
const productOverride = options['product-version'] !== undefined;
if (productOverride && !/^sha512-[A-Za-z0-9+/=]+$/.test(options['product-integrity'] ?? '')) usage('--product-integrity (sha512-...) is required with --product-version');
const activeProduct = registry.scanners.find(s => s.id === 'redact-secret');
const product = productOverride ? { package: activeProduct.package, version: options['product-version'], integrity: options['product-integrity'] } : activeProduct;
const keyRegistry = { ...registry, engine, scanners: registry.scanners.map(s => (s.id === 'redact-secret' ? { ...s, version: product.version, integrity: product.integrity } : s)) };
const pinned = inputs.populations.find(p => p.id === POPULATION).pin;
const adoption = existsSync(path.join(root, ADOPTION_FILE)) ? readJson(ADOPTION_FILE) : { schema: 'redact-secret/evidence-adoption/v1', state: 'none' };

let lastReport;
function preflight() {
  const tag = options.tag ?? usage('--tag is required');
  const expectedManifestDigest = options['manifest-digest'] ?? usage('--manifest-digest is required');
  const dir = path.resolve(options.dir ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${tag}`));
  const report = { tag, expectedManifestDigest, engine: { tag: engine.tag, protocol: engine.protocol }, outcome: 'ready', problems: [] };
  const finish = (outcome, code, message) => {
    report.outcome = outcome;
    lastReport = report;
    if (message) report.message = message;
    if (options.out) writeJson(options.out, report);
    output('outcome', outcome);
    (code === 0 ? console.log : console.error)(message ?? `${outcome}: ${tag}`);
    return code;
  };
  const engineCandidateMode = tag === pinned.evidenceRelease && expectedManifestDigest === pinned.manifestDigest && (engine.tag !== registry.engine.tag || product.version !== activeProduct.version);
  if (tag === pinned.evidenceRelease && !engineCandidateMode) {
    if (expectedManifestDigest === pinned.manifestDigest) return finish('already-pinned', 0, `${tag} is already the pinned evidence release; nothing to adopt.`);
    return finish('identity-failed', 3, `${tag} is the pinned tag but ${expectedManifestDigest} is not its pinned manifest digest ${pinned.manifestDigest}: a release tag is immutable.`);
  }
  const a = assets(tag, dir);
  const identity = releaseIdentityProblems({ tag, expectedManifestDigest, ...a });
  if (identity.length) { report.problems = identity; return finish('identity-failed', 3, `Release identity failed (not an engine incompatibility):\n${identity.map(p => `  - ${p}`).join('\n')}`); }
  const snapshotDigest = a.snapshot.identity.corpus_digest;
  const key = adoptionKey({ tag, manifestDigest: expectedManifestDigest, snapshotDigest, registry: keyRegistry });
  report.snapshotDigest = snapshotDigest;
  report.adoptionKey = `sha256:${key}`;
  report.branch = adoptionBranch(tag, key);
  output('key', key);
  output('branch', report.branch);

  const vendored = readFileSync(path.join(root, 'schemas/credential-eval-corpus-snapshot-v1.json'));
  let schemaBytes = vendored;
  if (options['engine-schema']) {
    schemaBytes = readFileSync(options['engine-schema']);
    report.engineSchemaDigest = sha256Digest(schemaBytes);
    if (sha256Digest(vendored) !== report.engineSchemaDigest) report.problems.push(`the vendored corpus-snapshot schema (${sha256Digest(vendored)}) differs from the engine's at ${engine.tag} (${report.engineSchemaDigest}); the engine's is used`);
  } else report.engineSchemaDigest = `${sha256Digest(vendored)} (vendored; the workflow checks it against the engine tag)`;
  const compat = snapshotCompatibility(a.snapshot, JSON.parse(schemaBytes));
  report.compatibility = compat;
  if (!compat.compatible) return finish('incompatible', 4, incompatibilityMessage(compat, engine));

  if (engineCandidateMode) {
    if (adoption.state !== 'accepted') return finish('conflict', 5, `The evidence ${tag} is the pin but the adoption record is ${adoption.state}, not accepted; an engine candidate rides on an accepted adoption.`);
    const ec = adoption.engineCandidate;
    if (ec?.adoptionKey === `sha256:${key}`) return finish('already-prepared', 0, `Engine candidate ${key.slice(0, 12)} is already recorded; nothing to do.`);
    if (ec && !supersede) return finish('conflict', 5, `A different engine candidate (${ec.engine.tag}, ${ec.product.version}) is recorded; pass --supersede to replace it.`);
    return finish('ready', 0, `Ready: ${tag} (the accepted pin) is readable by ${engine.tag}; engine candidate ${engine.tag} with @redact-secret/core ${product.version}${ec ? ' supersedes the recorded one' : ''}. Key ${key.slice(0, 12)}.`);
  }
  if (adoption.state === 'accepted' && adoption.evidenceCandidate) {
    if (adoption.evidenceCandidate.adoptionKey === `sha256:${key}`) return finish('already-prepared', 0, `Adoption ${key.slice(0, 12)} of ${tag} is already recorded as the evidence candidate; nothing to do.`);
    if (!supersede) return finish('conflict', 5, `A different evidence candidate (${adoption.evidenceCandidate.evidenceRelease}) is recorded next to the accepted adoption; pass --supersede to replace it.`);
    report.supersedes = { evidenceRelease: adoption.evidenceCandidate.evidenceRelease, adoptionKey: adoption.evidenceCandidate.adoptionKey };
  }
  if (adoption.state === 'candidate') {
    if (adoption.candidate.adoptionKey === `sha256:${key}`) return finish('already-prepared', 0, `Adoption ${key.slice(0, 12)} of ${tag} is already recorded as the candidate; nothing to do.`);
    if (supersede) { report.supersedes = { evidenceRelease: adoption.candidate.evidenceRelease, adoptionKey: adoption.candidate.adoptionKey }; return finish('ready', 0, `Ready: ${tag} is verified and readable by ${engine.tag}; it supersedes the recorded candidate ${adoption.candidate.evidenceRelease} (${adoption.candidate.adoptionKey.slice(0, 19)}). Adoption key ${key.slice(0, 12)}.`); }
    return finish('conflict', 5, `A different adoption (${adoption.candidate.evidenceRelease}, ${adoption.candidate.adoptionKey.slice(0, 19)}) is still the candidate. Accept or withdraw it (docs/specs/evidence-adoption.md) before adopting ${tag}, or pass --supersede (workflow input supersede) to replace it.`);
  }
  return finish('ready', 0, `Ready: ${tag} is verified and readable by ${engine.tag}. Adoption key ${key.slice(0, 12)}.`);
}

function prepare() {
  const code = preflight();
  if (code !== 0) process.exit(code);
  if (lastReport.outcome !== 'ready') return;
  const tag = options.tag;
  const dir = path.resolve(options.dir ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${tag}`));
  const next = assets(tag, dir);
  if (tag === pinned.evidenceRelease) return prepareEngineCandidate(next);
  const previous = assets(pinned.evidenceRelease, path.resolve(options['previous-dir'] ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${pinned.evidenceRelease}`)));
  if (sha256Digest(previous.manifestBytes) !== pinned.manifestDigest) { console.error('the previous release manifest differs from its pin'); process.exit(3); }
  const diff = diffSnapshots(previous.snapshot, next.snapshot);
  const key = adoptionKey({ tag, manifestDigest: options['manifest-digest'], snapshotDigest: next.snapshot.identity.corpus_digest, registry: keyRegistry });
  const compat = lastReport.compatibility;
  const old = adoption.state === 'candidate' && supersede ? adoption.candidate : null;
  const supersededCandidate = old && {
    evidenceRelease: old.evidenceRelease, manifestDigest: old.manifestDigest, adoptionKey: old.adoptionKey, engine: old.engine,
    changeReport: old.changeReport, ...(old.acceptance ? { report: old.acceptance.report, comparison: old.acceptance.comparison, removedAcceptancePatch: old.acceptance.patch } : {}),
    note: `Superseded before acceptance by ${tag}. Its prepared acceptance patch is removed: the owner accepts the new candidate, never this one. Its report and data stay as history.`,
  };
  const record = candidateRecord({ tag, manifest: next.manifest, manifestDigest: options['manifest-digest'], snapshotIdentity: next.snapshot.identity, key, compat, diff, registry, engine, supersededCandidate, previous: { evidenceRelease: pinned.evidenceRelease, manifestDigest: pinned.manifestDigest } });
  let supersededDiff = null;
  if (old) {
    const prior = assets(old.evidenceRelease, path.resolve(options['superseded-dir'] ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${old.evidenceRelease}`)));
    if (sha256Digest(prior.manifestBytes) !== old.manifestDigest) { console.error('the superseded candidate release manifest differs from its record'); process.exit(3); }
    supersededDiff = { from: old.evidenceRelease, to: tag, diff: diffSnapshots(prior.snapshot, next.snapshot), representation: { from: representationSummary(prior.snapshot, prior.manifest), to: representationSummary(next.snapshot, next.manifest) } };
  }
  const removed = [];
  if (old?.acceptance) for (const f of [old.acceptance.patch, old.acceptance.patchDigestFile]) if (f && existsSync(path.join(root, f))) { rmSync(path.join(root, f)); removed.push(f); }
  if (options['removed-list']) writeFileSync(options['removed-list'], removed.map(f => `${f}\n`).join(''));
  // After an acceptance the accepted adoption stays as the record (it is the active pin's); a newer evidence release rides next to it as `evidenceCandidate`, superseding a recorded one
  // only with --supersede, and the engine candidate on the accepted evidence is untouched.
  if (adoption.state === 'accepted') {
    if (adoption.evidenceCandidate && adoption.evidenceCandidate.adoptionKey !== record.candidate.adoptionKey && !supersede) { console.error(`A different evidence candidate (${adoption.evidenceCandidate.evidenceRelease}) is recorded; pass --supersede to replace it.`); process.exit(5); }
    writeJson(ADOPTION_FILE, { ...adoption, evidenceCandidate: { ...record.candidate, product: { package: product.package, version: product.version, integrity: product.integrity }, ...(adoption.evidenceCandidate && supersede ? { supersedesEvidenceCandidate: { evidenceRelease: adoption.evidenceCandidate.evidenceRelease, adoptionKey: adoption.evidenceCandidate.adoptionKey } } : {}) } });
  } else writeJson(ADOPTION_FILE, record);
  writeJson(record.candidate.changeReport, {
    schema: 'redact-secret/evidence-adoption-change-report/v1', evidenceRelease: tag, previous: record.candidate.supersedes, adoptionKey: record.candidate.adoptionKey,
    scope: 'Corpus evidence only: scanner and configuration pins are unchanged'+(engine.tag !== registry.engine.tag ? `; the engine moves from ${registry.engine.tag} to ${engine.tag}, so a later difference is the corpus and the engine together and is reported apart by the replay` : ', and so is the engine, so any later difference in results is the changed corpus, not a product version')+'.',
    diff,
    representation: representationSummary(next.snapshot, next.manifest),
    reviewState: { previous: reviewStateSummary(previous.manifest, previous.bundle, previous.materialized), candidate: reviewStateSummary(next.manifest, next.bundle, next.materialized) },
    ...(supersededDiff ? { supersededCandidateDiff: supersededDiff } : {}),
    replay: { state: 'pending', note: 'Outcome drift, added-case outcomes, unmeasured/errors and qualification changes are added from the official replay (adopt-evidence-snapshot.mjs compare-runs).' },
  });
  const lines = [
    `# Evidence adoption candidate: ${tag}`, '',
    `Adoption key \`${key.slice(0, 12)}\`; supersedes \`${pinned.evidenceRelease}\`${old ? ` and replaces the recorded candidate \`${old.evidenceRelease}\` (${old.engine.tag}); the owner accepts this one, not that one` : ''}. Engine \`${engine.tag}\`${engine.tag !== registry.engine.tag ? ' (a candidate pin only; the active pin is ' + registry.engine.tag + ')' : ''}. Active pins and the authority file are unchanged; this PR records a candidate only.`, '',
    `Cases: ${diff.cases.old} -> ${diff.cases.new} (added ${diff.cases.added}, removed ${diff.cases.removed}, changed ${diff.cases.changed}, unchanged ${diff.cases.unchanged}).`,
    `Added by kind: ${JSON.stringify(diff.addedByKind)}; by evidence class: ${JSON.stringify(diff.addedByEvidenceClass)}.`,
    `New providers: ${diff.diversity.providers.added.length}; new families: ${diff.diversity.families.addedFamilies.length}.`, '',
    `Full report: \`${record.candidate.changeReport}\`. Owner acceptance: none recorded.`,
  ];
  if (options.summary) writeFileSync(options.summary, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

function prepareEngineCandidate(next) {
  const key = adoptionKey({ tag: options.tag, manifestDigest: options['manifest-digest'], snapshotDigest: next.snapshot.identity.corpus_digest, registry: keyRegistry });
  const old = adoption.engineCandidate && supersede ? adoption.engineCandidate : null;
  const supersededCandidate = old && { adoptionKey: old.adoptionKey, engine: old.engine, product: old.product, changeReport: old.changeReport, note: `Superseded before acceptance by engine candidate ${engine.tag} with ${product.version}.` };
  const record = engineCandidateRecord({ pinned, manifestDigest: options['manifest-digest'], key, compat: lastReport.compatibility, registry, engine, product, previousProduct: activeProduct, supersededCandidate });
  const diff = diffSnapshots(next.snapshot, next.snapshot);
  writeJson(ADOPTION_FILE, { ...adoption, engineCandidate: record });
  writeJson(record.changeReport, {
    schema: 'redact-secret/evidence-adoption-change-report/v1', kind: 'engine-product', evidenceRelease: options.tag, adoptionKey: record.adoptionKey,
    scope: `Identical evidence bytes (${pinned.snapshotDigest}). The engine moves from ${registry.engine.tag} to ${engine.tag} and @redact-secret/core from ${activeProduct.version} to ${product.version}; a later difference is an engine, configuration or product effect, separated by the attribution run (the previous product build on the new engine). Nothing is accepted.`,
    engineChange: record.engineChange, productChange: record.productChange, diff,
    replay: { state: 'pending', note: 'Filled from the official replay and the attribution run (docs/specs/evidence-adoption.md, "Engine candidate").' },
  });
  console.log(`Engine candidate recorded: ${engine.tag}, @redact-secret/core ${product.version}. Report: ${record.changeReport}. Owner acceptance: none.`);
}

function repin() {
  const c = adoption.state === 'candidate' ? adoption.candidate : adoption.state === 'accepted' ? adoption.evidenceCandidate : undefined;
  if (!c) usage('there is no candidate adoption to accept');
  const date = options['superseded-on'] ?? usage('--superseded-on YYYY-MM-DD is required (the owner acceptance date)');
  const result = repinPopulation({ registry, inputs, population: POPULATION, candidate: c, supersededOn: date });
  writeJson('benchmarks/official-runs.json', result.registry);
  writeJson('benchmarks/qualification-inputs.json', result.inputs);
  console.log(`Repinned ${POPULATION} to ${c.evidenceRelease}. Kept as historical receipts: ${result.movedRunIds.join(', ') || 'none'}.\nNext: replay officially (official-runs.yml), record the runs, then the owner renews the authority and sets ownerAcceptance in ${ADOPTION_FILE}.`);
}

function compareRuns() {
  const report = readJson(options.report ?? usage('--report <change report json> is required'));
  const drift = diffRunArtifacts(JSON.parse(readFileSync(options.old ?? usage('--old <artifact> is required'), 'utf8')), JSON.parse(readFileSync(options.new ?? usage('--new <artifact> is required'), 'utf8')), { addedIds: report.diff.added });
  report.replay = { state: 'compared', scanners: drift };
  writeJson(options.report, report);
  console.log(JSON.stringify(drift, null, 2));
}

if (command === 'preflight') process.exit(preflight());
else if (command === 'prepare') prepare();
else if (command === 'repin') repin();
else if (command === 'compare-runs') compareRuns();
else usage('unknown command');
