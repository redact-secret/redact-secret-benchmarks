/**
 * Evidence adoption entry point (#690). One documented command per step; `.github/workflows/adopt-evidence-snapshot.yml` runs the
 * first two. Spec: docs/specs/evidence-adoption.md.
 *
 *   preflight --tag T --manifest-digest D [--dir DIR] [--engine-schema FILE] [--out FILE]
 *       Verify the immutable release assets and that the pinned engine can read the snapshot. Changes nothing.
 *       Exit 0 ready or already adopted (no-op), 3 identity/digest failure, 4 engine incompatibility, 5 conflicting adoption, 2 usage.
 *   prepare   (same arguments, plus [--previous-dir DIR] [--summary FILE])
 *       After a passing preflight: write the candidate record and the change report. Never touches a pin or the authority file.
 *   compare-runs --report FILE --old OLD_ARTIFACT --new NEW_ARTIFACT
 *       Add outcome drift between two official replays to a change report, common cases apart from added cases.
 *   repin     [--superseded-on YYYY-MM-DD]
 *       Owner acceptance branch only: move the floors pin to the recorded candidate and keep the previous runs as historical receipts.
 *       The authority file is not read or written; the owner renews it separately.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adoptionBranch, adoptionKey, candidateRecord, diffRunArtifacts, diffSnapshots, incompatibilityMessage, releaseIdentityProblems, repinPopulation, sha256Digest, snapshotCompatibility } from './evidence-adoption.mjs';

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
  if (!existsSync(path.join(dir, 'release-manifest.json')) || !existsSync(path.join(dir, 'credential-eval-corpus-snapshot.json')))
    execFileSync('gh', ['release', 'download', tag, '-R', SOURCE, '-D', dir, '-p', 'release-manifest.json', '-p', 'credential-eval-corpus-snapshot.json', '--clobber'], { stdio: 'inherit' });
  const manifestBytes = readFileSync(path.join(dir, 'release-manifest.json'));
  const snapshotBytes = readFileSync(path.join(dir, 'credential-eval-corpus-snapshot.json'));
  return { manifestBytes, manifest: JSON.parse(manifestBytes), snapshotBytes, snapshot: JSON.parse(snapshotBytes) };
}

const registry = readJson('benchmarks/official-runs.json');
const inputs = readJson('benchmarks/qualification-inputs.json');
const pinned = inputs.populations.find(p => p.id === POPULATION).pin;
const adoption = existsSync(path.join(root, ADOPTION_FILE)) ? readJson(ADOPTION_FILE) : { schema: 'redact-secret/evidence-adoption/v1', state: 'none' };

let lastReport;
function preflight() {
  const tag = options.tag ?? usage('--tag is required');
  const expectedManifestDigest = options['manifest-digest'] ?? usage('--manifest-digest is required');
  const dir = path.resolve(options.dir ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${tag}`));
  const report = { tag, expectedManifestDigest, engine: { tag: registry.engine.tag, protocol: registry.engine.protocol }, outcome: 'ready', problems: [] };
  const finish = (outcome, code, message) => {
    report.outcome = outcome;
    lastReport = report;
    if (message) report.message = message;
    if (options.out) writeJson(options.out, report);
    output('outcome', outcome);
    (code === 0 ? console.log : console.error)(message ?? `${outcome}: ${tag}`);
    return code;
  };
  if (tag === pinned.evidenceRelease) {
    if (expectedManifestDigest === pinned.manifestDigest) return finish('already-pinned', 0, `${tag} is already the pinned evidence release; nothing to adopt.`);
    return finish('identity-failed', 3, `${tag} is the pinned tag but ${expectedManifestDigest} is not its pinned manifest digest ${pinned.manifestDigest}: a release tag is immutable.`);
  }
  const a = assets(tag, dir);
  const identity = releaseIdentityProblems({ tag, expectedManifestDigest, ...a });
  if (identity.length) { report.problems = identity; return finish('identity-failed', 3, `Release identity failed (not an engine incompatibility):\n${identity.map(p => `  - ${p}`).join('\n')}`); }
  const snapshotDigest = a.snapshot.identity.corpus_digest;
  const key = adoptionKey({ tag, manifestDigest: expectedManifestDigest, snapshotDigest, registry });
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
    if (sha256Digest(vendored) !== report.engineSchemaDigest) report.problems.push(`the vendored corpus-snapshot schema (${sha256Digest(vendored)}) differs from the engine's at ${registry.engine.tag} (${report.engineSchemaDigest}); the engine's is used`);
  } else report.engineSchemaDigest = `${sha256Digest(vendored)} (vendored; the workflow checks it against the engine tag)`;
  const compat = snapshotCompatibility(a.snapshot, JSON.parse(schemaBytes));
  report.compatibility = compat;
  if (!compat.compatible) return finish('incompatible', 4, incompatibilityMessage(compat, registry.engine));

  if (adoption.state === 'candidate') {
    if (adoption.candidate.adoptionKey === `sha256:${key}`) return finish('already-prepared', 0, `Adoption ${key.slice(0, 12)} of ${tag} is already recorded as the candidate; nothing to do.`);
    return finish('conflict', 5, `A different adoption (${adoption.candidate.evidenceRelease}, ${adoption.candidate.adoptionKey.slice(0, 19)}) is still the candidate. Accept or withdraw it (docs/specs/evidence-adoption.md) before adopting ${tag}.`);
  }
  return finish('ready', 0, `Ready: ${tag} is verified and readable by ${registry.engine.tag}. Adoption key ${key.slice(0, 12)}.`);
}

function prepare() {
  const code = preflight();
  if (code !== 0) process.exit(code);
  if (lastReport.outcome !== 'ready') return;
  const tag = options.tag;
  const dir = path.resolve(options.dir ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${tag}`));
  const next = assets(tag, dir);
  const previous = assets(pinned.evidenceRelease, path.resolve(options['previous-dir'] ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', `adopt-${pinned.evidenceRelease}`)));
  if (sha256Digest(previous.manifestBytes) !== pinned.manifestDigest) { console.error('the previous release manifest differs from its pin'); process.exit(3); }
  const diff = diffSnapshots(previous.snapshot, next.snapshot);
  const key = adoptionKey({ tag, manifestDigest: options['manifest-digest'], snapshotDigest: next.snapshot.identity.corpus_digest, registry });
  const compat = lastReport.compatibility;
  const record = candidateRecord({ tag, manifest: next.manifest, manifestDigest: options['manifest-digest'], snapshotIdentity: next.snapshot.identity, key, compat, diff, registry, previous: { evidenceRelease: pinned.evidenceRelease, manifestDigest: pinned.manifestDigest } });
  writeJson(ADOPTION_FILE, record);
  writeJson(record.candidate.changeReport, {
    schema: 'redact-secret/evidence-adoption-change-report/v1', evidenceRelease: tag, previous: record.candidate.supersedes, adoptionKey: record.candidate.adoptionKey,
    scope: 'Corpus evidence only: scanner, engine and configuration pins are unchanged, so any later difference in results is the changed corpus, not a product version.',
    diff,
    replay: { state: 'pending', note: 'Outcome drift, added-case outcomes, unmeasured/errors and qualification changes are added from the official replay (adopt-evidence-snapshot.mjs compare-runs).' },
  });
  const lines = [
    `# Evidence adoption candidate: ${tag}`, '',
    `Adoption key \`${key.slice(0, 12)}\`; supersedes \`${pinned.evidenceRelease}\`. Active pins and the authority file are unchanged; this PR records a candidate only.`, '',
    `Cases: ${diff.cases.old} -> ${diff.cases.new} (added ${diff.cases.added}, removed ${diff.cases.removed}, changed ${diff.cases.changed}, unchanged ${diff.cases.unchanged}).`,
    `Added by kind: ${JSON.stringify(diff.addedByKind)}; by evidence class: ${JSON.stringify(diff.addedByEvidenceClass)}.`,
    `New providers: ${diff.diversity.providers.added.length}; new families: ${diff.diversity.families.addedFamilies.length}.`, '',
    `Full report: \`${record.candidate.changeReport}\`. Owner acceptance: none recorded.`,
  ];
  if (options.summary) writeFileSync(options.summary, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

function repin() {
  if (adoption.state !== 'candidate') usage('there is no candidate adoption to accept');
  const c = adoption.candidate;
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
