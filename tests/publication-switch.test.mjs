import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { AUTHORITY_FILE, AUTHORITY_READERS, unlistedReaders } from '../benchmarks/qualification/authority.ts';
import { buildMatrixArtifact } from '../benchmarks/qualification/matrix-artifact.ts';
import { isViewMatrix, loadViewSupportContext, viewMatrixIdentity, viewMatrixProblems } from '../benchmarks/qualification/matrix-publication.ts';
import { supportMatrixProblem } from '../benchmarks/shared/support-model.ts';
import { candidateDiffFreshnessProblems, planCandidate, readAuthority } from '../scripts/credential-publication.ts';

// The publication switch of #657. Synthetic data over the committed pins: the artifacts are built here from the registry, the taxonomy, the policy
// revision and the scanner roster of this checkout, and no ledger value, count or digest is asserted, so a repin re-keys nothing in this file.

const root = path.resolve(import.meta.dirname, '..');
const context = await loadViewSupportContext();
const D = n => `sha256:${String(n).padStart(64, '0')}`;

const populationsOf = (ctx, over = {}) => ctx.registry.runs.filter(r => r.canonical && r.platform === 'linux-x64' && r.kind !== 'methods').map(r => ({
  population: r.population, runClass: 'public',
  artifact: { semanticDigest: r.artifact.semanticDigest, artifactDigest: D(9), engine: { name: 'credential-eval', version: ctx.registry.engine.version }, scanners: ctx.roster.required.map(id => ({ id, version: ctx.registry.scanners.find(s => s.id === id).version, build: 'released' })) },
  ...over,
}));
const entry = f => ({ provider: f.provider, family: f.id, familyName: f.name, status: 'pending', evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null, detectors: [], reason: 'synthetic' });
const view = (ctx = context, over = {}) => ({
  schema: 'qualification-view/v1', publication: 'public', policy: { revision: ctx.policyRevision }, adapter: { id: 'adapter', version: 1 },
  populations: populationsOf(ctx),
  supportMatrix: {
    distribution: { stable: 0, provisional: 0, pending: ctx.taxonomy.length, unsupported: 0 }, stableDistribution: { documented: 0, empirical: 0, 'policy-qualified': 0 },
    families: ctx.taxonomy.map(entry),
  },
  ...over,
});
const published = (v = view()) => buildMatrixArtifact(v, 'published');
const problems = (artifact, ctx = context) => viewMatrixProblems(artifact, ctx);

test('a published view matrix at the current pins, policy, taxonomy and roster has no problem and carries its identity', () => {
  const artifact = published();
  assert.ok(isViewMatrix(artifact));
  assert.deepEqual(problems(artifact), []);
  const identity = viewMatrixIdentity(artifact);
  assert.equal(identity.source, 'qualification-view');
  assert.equal(identity.policyRevision, context.policyRevision);
  assert.deepEqual(identity.populations.map(p => p.population).sort(), [...new Set(context.registry.runs.filter(r => r.canonical && r.kind !== 'methods').map(r => r.population))].sort());
});

test('wrong artifacts are refused: a candidate projection, an internal run, a candidate build, an unrecorded digest', () => {
  const projection = buildMatrixArtifact(view(context, { publication: 'internal', populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, runClass: 'internal', artifact: { ...p.artifact, scanners: p.artifact.scanners.map(s => ({ ...s, build: 'candidate' })) } } : p) }), 'candidate-projection');
  assert.ok(problems(projection).some(p => p.includes('only a published, public matrix')), 'a candidate projection is never read by a publication');
  assert.ok(problems({ ...published(), publication: 'internal' }).length > 0);
  const internalRun = published(view(context, { populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, runClass: 'internal' } : p) }));
  assert.ok(problems(internalRun).some(p => p.includes('public runs only')));
  const candidateBuild = published(view(context, { populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, scanners: p.artifact.scanners.map(s => ({ ...s, build: 'candidate' })) } } : p) }));
  assert.ok(problems(candidateBuild).some(p => p.includes('never carries one')));
  const unrecorded = published(view(context, { populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, semanticDigest: D(7) } } : p) }));
  assert.ok(problems(unrecorded).some(p => p.includes('not a canonical official run')));
});

test('missing artifacts are refused: a recorded population absent from the matrix source, no population at all', () => {
  const [first, ...rest] = populationsOf(context);
  assert.ok(problems(published(view(context, { populations: rest }))).some(p => p.includes('absent from the matrix source')), first.population);
  assert.ok(problems(published(view(context, { populations: [] }))).length > 0);
  assert.ok(problems({ schema: 'something-else' })[0].includes('not a'));
  assert.ok(problems(null)[0].includes('not a'));
});

test('stale artifacts are refused: another engine, another policy revision, another taxonomy, a changed key set', () => {
  const artifact = published();
  assert.ok(problems(artifact, { ...context, registry: { ...context.registry, engine: { ...context.registry.engine, version: '0.0.0-other' } } }).some(p => p.includes('the pin is')));
  assert.ok(problems(artifact, { ...context, policyRevision: 'rs-policy-1:sha256:other' }).some(p => p.includes('policy')));
  assert.ok(problems(artifact, { ...context, taxonomy: context.taxonomy.slice(1) }).some(p => p.includes('lists') || p.includes('taxonomy')));
  assert.ok(problems(artifact, { ...context, taxonomy: context.taxonomy.map((f, i) => i === 0 ? { ...f, name: `${f.name} renamed` } : f) }).some(p => p.includes('does not match the taxonomy')));
  assert.ok(problems({ ...artifact, notes: 'x' }).some(p => p.includes('outside the allowlist')));
});

test('the scanner roster binds the matrix: a run that skipped a required scanner or measured one outside the roster is refused (#812)', () => {
  const required = context.roster.required;
  const without = populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, scanners: p.artifact.scanners.slice(1) } } : p);
  assert.ok(problems(published(view(context, { populations: without }))).some(p => p.includes(`did not measure the required scanner ${required[0]}`)));
  const extra = populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, scanners: [...p.artifact.scanners, { id: 'not-in-the-roster', version: '1', build: 'released' }] } } : p);
  assert.ok(problems(published(view(context, { populations: extra }))).some(p => p.includes('not in the official scanner roster')));
  // An optional scanner of the roster may be present: the default full run is the four required scanners, OpenRedaction is a positive opt-in.
  const optional = context.roster.optional[0];
  if (optional) {
    const withOptional = populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, scanners: [...p.artifact.scanners, { id: optional, version: context.registry.scanners.find(s => s.id === optional).version, build: 'released' }] } } : p);
    assert.deepEqual(problems(published(view(context, { populations: withOptional }))), []);
  }
});

test('neither validator accepts the other kind of file', () => {
  assert.notEqual(supportMatrixProblem(published()), null, 'the legacy validator refuses the view matrix');
  assert.ok(problems({ schemaVersion: 1, families: [], sourceReport: {} })[0].includes('not a'), 'the view validator refuses a legacy matrix');
});

const run = (args, options = {}) => spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: root, encoding: 'utf8', ...options });
const scratch = () => mkdtempSync(path.join(os.tmpdir(), 'publication-switch-'));

test('eval:publish:matrix --from-view publishes a valid view matrix as its own file and refuses every wrong one without writing', () => {
  const dir = scratch();
  const ok = path.join(dir, 'in.json'), out = path.join(dir, 'out', 'support-matrix-view-v1.json');
  writeFileSync(ok, JSON.stringify(published()));
  const good = run(['scripts/publish-support-matrix.ts', '--from-view', `--input=${ok}`, `--output=${out}`]);
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), published());
  const refusals = {
    'a legacy-shaped file': { schemaVersion: 1, families: [] },
    'a candidate projection': buildMatrixArtifact(view(context, { publication: 'internal', populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, runClass: 'internal' } : p) }), 'candidate-projection'),
    'a stale policy': { ...published(), source: { ...published().source, view: { ...published().source.view, policyRevision: 'rs-policy-1:sha256:stale' } } },
    'an unrecorded digest': published(view(context, { populations: populationsOf(context).map((p, i) => i === 0 ? { ...p, artifact: { ...p.artifact, semanticDigest: D(5) } } : p) })),
  };
  for (const [name, artifact] of Object.entries(refusals)) {
    const file = path.join(dir, 'bad.json'), target = path.join(dir, `bad-${name.replaceAll(' ', '-')}.json`);
    writeFileSync(file, JSON.stringify(artifact));
    const refused = run(['scripts/publish-support-matrix.ts', '--from-view', `--input=${file}`, `--output=${target}`]);
    assert.notEqual(refused.status, 0, `${name} must be refused`);
    assert.ok(!existsSync(target), `${name}: nothing is written`);
  }
  const missing = run(['scripts/publish-support-matrix.ts', '--from-view', `--input=${path.join(dir, 'absent.json')}`, `--output=${path.join(dir, 'none.json')}`]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /qualification:matrix/, 'a missing matrix says which command produces it');
  // Without the flag the legacy validator applies and the view matrix is refused (the rollback path keeps its own contract).
  const legacy = run(['scripts/publish-support-matrix.ts', `--input=${ok}`, `--output=${path.join(dir, 'legacy.json')}`]);
  assert.notEqual(legacy.status, 0);
  assert.ok(!existsSync(path.join(dir, 'legacy.json')));
});

test('the provider roadmap reads a view matrix with the view identity and refuses a stale or wrong one', () => {
  const dir = scratch();
  const file = path.join(dir, 'matrix.json'), out = path.join(dir, 'dossiers.json');
  writeFileSync(file, JSON.stringify(published()));
  const good = run(['benchmarks/generate-provider-dossiers.ts', '--require-matrix', `--matrix=${file}`, `--output=${out}`]);
  assert.equal(good.status, 0, good.stderr);
  const roadmap = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(roadmap.supportMatrix, viewMatrixIdentity(published()));
  assert.equal(roadmap.stageDistribution.measured, 0, 'a pending family is not measured');
  const stale = path.join(dir, 'stale.json'), staleOut = path.join(dir, 'stale-out.json');
  writeFileSync(stale, JSON.stringify({ ...published(), source: { ...published().source, view: { ...published().source.view, policyRevision: 'rs-policy-1:sha256:stale' } } }));
  const refused = run(['benchmarks/generate-provider-dossiers.ts', '--require-matrix', `--matrix=${stale}`, `--output=${staleOut}`]);
  assert.notEqual(refused.status, 0);
  assert.ok(!existsSync(staleOut));
  const absent = run(['benchmarks/generate-provider-dossiers.ts', '--require-matrix', `--matrix=${path.join(dir, 'absent.json')}`, `--output=${path.join(dir, 'x.json')}`]);
  assert.notEqual(absent.status, 0, 'a roadmap that requires the matrix fails without it');
});

const candidate = (id, commit, core, replay) => ({ id, product: { commit }, packages: [{ name: '@redact-secret/core', sha256: `sha256:${core}`, platform: null }, { name: '@redact-secret/node-linux-x64-gnu', sha256: D(1), platform: 'linux-x64' }], ...(replay ? { replay } : {}) });
const commitA = 'a'.repeat(40), commitB = 'b'.repeat(40), coreA = 'c'.repeat(64), coreB = 'd'.repeat(64);
const archive = { release: 'candidate-runs-1', sha256: D(2) };

test('the candidate step looks the qualified candidate up by its exact tarball digest and commit and never measures one', () => {
  const registry = { candidates: [candidate('replayed', commitA, coreA, { state: 'replayed', archive }), candidate('never', commitB, coreB, { state: 'pending' })] };
  assert.deepEqual(planCandidate(registry, { coreSha256: coreA, productCommit: commitA }), { state: 'replayed', id: 'replayed', archive });
  assert.deepEqual(planCandidate(registry, { coreSha256: `sha256:${coreA}`, productCommit: commitA }).state, 'replayed', 'the prefix is tolerated');
  assert.deepEqual(planCandidate(registry, { coreSha256: coreB, productCommit: commitB }), { state: 'unreplayed', id: 'never' });
  assert.deepEqual(planCandidate(registry, { coreSha256: 'e'.repeat(64), productCommit: 'f'.repeat(40) }), { state: 'unregistered' });
  assert.deepEqual(planCandidate({}, { coreSha256: coreA, productCommit: commitA }), { state: 'unregistered' });
  // The artifacts are not what they claim: a registered digest at another commit, or a registered commit at another digest, is refused, not matched.
  assert.equal(planCandidate(registry, { coreSha256: coreA, productCommit: commitB }).state, 'conflict');
  assert.equal(planCandidate(registry, { coreSha256: 'e'.repeat(64), productCommit: commitA }).state, 'conflict');
});

const registryForDiff = { scanners: context.registry.scanners, runs: context.registry.runs };
const pinnedVersion = context.registry.scanners.find(s => s.id === 'redact-secret').version;
const currentDiff = () => ({
  candidate: { version: pinnedVersion },
  baseline: { productVersion: pinnedVersion, archive: { semanticDigests: Object.fromEntries(context.registry.runs.filter(r => r.canonical && r.platform === 'linux-x64').map(r => [r.id.replace(/@linux-x64$/, ''), r.artifact.semanticDigest])) } },
});

test('a candidate diff is published only when its control is the release and the canonical runs the registry pins now (beta.13 evidence is history)', () => {
  assert.deepEqual(candidateDiffFreshnessProblems(currentDiff(), registryForDiff), []);
  const oldRelease = currentDiff();
  oldRelease.baseline.productVersion = '0.1.0-beta.0';
  assert.ok(candidateDiffFreshnessProblems(oldRelease, registryForDiff).some(p => p.includes('the registry pins')));
  const oldEngine = currentDiff();
  const first = Object.keys(oldEngine.baseline.archive.semanticDigests)[0];
  oldEngine.baseline.archive.semanticDigests[first] = D(3);
  assert.ok(candidateDiffFreshnessProblems(oldEngine, registryForDiff).some(p => p.includes(first) && p.includes('canonical official run')));
  const missing = currentDiff();
  delete missing.baseline.archive.semanticDigests[first];
  assert.ok(candidateDiffFreshnessProblems(missing, registryForDiff).some(p => p.includes(first)));
  const earlier = currentDiff();
  earlier.candidate.version = pinnedVersion.replace(/\.(\d+)$/, (_, n) => `.${Number(n) - 1}`);
  assert.ok(candidateDiffFreshnessProblems(earlier, registryForDiff).some(p => p.includes('earlier build')));
  const later = currentDiff();
  later.candidate.version = pinnedVersion.replace(/\.(\d+)$/, (_, n) => `.${Number(n) + 1}`);
  assert.deepEqual(candidateDiffFreshnessProblems(later, registryForDiff), [], 'a build after the pinned release is the candidate this publication is about');
  const otherLine = currentDiff();
  otherLine.candidate.version = '9.9.9-beta.1';
  assert.ok(candidateDiffFreshnessProblems(otherLine, registryForDiff).some(p => p.includes('not a build of the pinned release line')));
  assert.ok(candidateDiffFreshnessProblems({}, registryForDiff).length > 0);
});

test('the binding reads the control digests where a real candidate diff records them: on its populations and its methods entry (#658)', () => {
  // `buildCandidateDiff` writes `baseline.archive` as only { release, sha256 }; the control's semantic digests are on each population and on `methods`.
  const canonical = Object.fromEntries(context.registry.runs.filter(r => r.canonical && r.platform === 'linux-x64').map(r => [r.id.replace(/@linux-x64$/, ''), r.artifact.semanticDigest]));
  const methodsKey = 'public-evidence-snapshot+methods';
  const real = () => ({
    candidate: { version: pinnedVersion },
    baseline: { productVersion: pinnedVersion, archive: { release: 'official-runs-1', sha256: `sha256:${'a'.repeat(64)}` } },
    methods: { baselineSemanticDigest: canonical[methodsKey] ?? null },
    populations: Object.entries(canonical).filter(([key]) => key !== methodsKey).map(([population, baseline]) => ({ population, semanticDigest: { baseline, candidate: D(7) } })),
  });
  assert.deepEqual(candidateDiffFreshnessProblems(real(), registryForDiff), []);
  const stale = real();
  stale.populations[0].semanticDigest.baseline = D(3);
  assert.ok(candidateDiffFreshnessProblems(stale, registryForDiff).some(p => p.includes(stale.populations[0].population)));
  const noMethods = real();
  noMethods.methods.baselineSemanticDigest = null;
  if (canonical[methodsKey]) assert.ok(candidateDiffFreshnessProblems(noMethods, registryForDiff).some(p => p.includes(methodsKey)));
});

test('the candidate step needs a digest and a commit and writes nothing for an unregistered candidate', () => {
  const dir = scratch();
  const out = path.join(dir, 'diff.json');
  assert.notEqual(run(['scripts/credential-publication.ts', 'candidate']).status, 0);
  assert.notEqual(run(['scripts/credential-publication.ts', 'candidate', '--core-sha256', 'zz', '--product-commit', commitA]).status, 0);
  const none = run(['scripts/credential-publication.ts', 'candidate', '--core-sha256', 'e'.repeat(64), '--product-commit', 'f'.repeat(40), '--out', out]);
  assert.equal(none.status, 0, none.stderr);
  assert.match(none.stdout, /No candidate diff/);
  assert.ok(!existsSync(out));
});

test('the publication seam reads the committed authority and the one-value rollback flips it for the command only', () => {
  const file = path.join(root, AUTHORITY_FILE);
  const before = readFileSync(file);
  const committed = readAuthority();
  assert.ok(['new', 'legacy'].includes(committed));
  const printed = run(['scripts/credential-publication.ts', 'authority']);
  assert.equal(printed.stdout.trim(), committed);
  for (const value of ['legacy', 'new']) {
    const flipped = spawnSync(process.execPath, ['web/scripts/with-authority.mjs', value, '--', process.execPath, '--import', 'tsx', 'scripts/credential-publication.ts', 'authority'], { cwd: root, encoding: 'utf8' });
    assert.equal(flipped.status, 0, flipped.stderr);
    assert.match(flipped.stdout, new RegExp(`^${value}$`, 'm'), `the publication seam reads ${value} while the value is flipped`);
    assert.ok(readFileSync(file).equals(before), 'the committed file is byte-identical afterwards');
  }
  assert.ok(readFileSync(file).equals(before));
  assert.ok(AUTHORITY_READERS.some(r => r.path === 'scripts/credential-publication.ts' && r.why.length > 10));
  assert.deepEqual(unlistedReaders(['scripts/credential-publication.ts']), []);
});

const workflow = YAML.parse(readFileSync(path.join(root, '.github/workflows/publish-site.yml'), 'utf8'));
const steps = workflow.jobs.publish.steps;
const stepNamed = prefix => { const step = steps.find(s => s.name?.startsWith(prefix)); assert.ok(step, `publish-site.yml has no step "${prefix}"`); return step; };
const indexOfStep = prefix => steps.indexOf(stepNamed(prefix));

test('publish-site.yml learns the authority from the seam only, and only legacy steps run the legacy measurements', () => {
  const text = readFileSync(path.join(root, '.github/workflows/publish-site.yml'), 'utf8');
  assert.ok(!text.includes(path.basename(AUTHORITY_FILE)), 'the workflow never reads the committed file itself');
  const authority = stepNamed('Read the credential qualification authority');
  assert.equal(authority.id, 'authority');
  assert.match(authority.run, /scripts\/credential-publication\.ts authority/);
  assert.ok(steps.indexOf(authority) < indexOfStep('Fetch the canonical official RunArtifacts'));
  const LEGACY = /\bnpm run eval:(qualify|candidate|classify|matrix)\b/;
  for (const step of steps) {
    if (!LEGACY.test(step.run ?? '')) continue;
    const guarded = /steps\.authority\.outputs\.authority == 'legacy'/.test(step.if ?? '');
    const inBranch = /if \[ "\$AUTHORITY" = legacy \]; then[\s\S]*?npm run eval:qualify/.test(step.run);
    assert.ok(guarded || inBranch, `"${step.name}" runs a legacy measurement outside the legacy authority`);
    if (!guarded) assert.equal((step.run.match(LEGACY) ?? []).length, 2, 'only eval:qualify (the match and its group) is in the shared step');
  }
  assert.match(stepNamed('Measure the qualified redact-secret commit as candidate evidence').if, /'legacy'/);
  assert.match(stepNamed('Classify support (legacy authority)').if, /'legacy'/);
  assert.match(stepNamed('Read the candidate diff from the recorded candidate replay').if, /TARGET == 'staging' && steps\.authority\.outputs\.authority == 'new'/);
  assert.match(stepNamed('Support matrix from the qualification view').if, /== 'new'/);
});

test('publish-site.yml builds the view and the matrix before anything slow runs, and every consumer takes the file of its authority', () => {
  assert.ok(indexOfStep('Fetch the canonical official RunArtifacts') < indexOfStep('Build the qualification view'));
  assert.ok(indexOfStep('Build the qualification view') < indexOfStep('Support matrix from the qualification view'));
  assert.ok(indexOfStep('Support matrix from the qualification view') < indexOfStep('Measure the corpus'), 'a wrong or stale artifact fails before the measurement');
  const consumers = stepNamed('Publish the provider roadmap, the domain gate and the PII support').run;
  assert.match(consumers, /support=public\/results\/support-matrix-view-v1\.json/);
  assert.match(consumers, /support=public\/results\/support-matrix-v1\.json\n\s+roadmap_matrix=results-output\/support-matrix\.json/, 'the legacy rollback keeps the legacy files');
  assert.match(consumers, /dossiers:publish -- --require-matrix --matrix="\$roadmap_matrix"/);
  assert.match(consumers, /eval:publish:domains -- --support="\$support"/);
  assert.equal((consumers.match(/--credential-support="\$support"/g) ?? []).length, 1, 'the PII index call read the credential support of the authority');
  // The independent PII authority preserves transport bindings and the isolated job.
  for (const flag of ['--pii-eval-pins=benchmarks/pii-eval-public-synthetic-pins.json', '--pii-eval-pins=benchmarks/pii-eval-population-pins.json', '--pii-eval-artifact="$RUNNER_TEMP/pii-eval-public/public-synthetic-artifact.json"', '--product-commit="$PRODUCT_COMMIT"', '--population-mode=not-measured'])
    assert.ok(consumers.includes(flag), flag);
  assert.equal(workflow.jobs['pii-public-synthetic'].uses, './.github/workflows/pii-public-synthetic.yml');
  assert.equal(workflow.jobs.publish.needs, 'pii-public-synthetic');
});

test('the new authority publishes no candidate-evidence file and the candidate step has no write access to public/', () => {
  const step = stepNamed('Read the candidate diff from the recorded candidate replay');
  assert.ok(!/public\/results/.test(step.run), 'the candidate diff is internal and never placed under public/');
  assert.ok(!/--output-dir/.test(step.run));
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'read', 'id-token': 'write' });
});

// Execute the real workflow shell with command recording instead of scanners.
test('publication executes only the selected independent credential and PII producers', () => {
  const dir = scratch();
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const calls = path.join(dir, 'calls');
  writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nprintf "%s\n" "$*" >> "$CALLS"\n');
  chmodSync(path.join(bin, 'npm'), 0o755);
  mkdirSync(path.join(dir, 'results-output/pii'), { recursive: true });
  const producer = stepNamed('Measure the corpus').run;
  const observer = stepNamed('Observe PII populations');
  assert.match(stepNamed('Measure the corpus').if, /steps\.authority\.outputs\.authority == 'legacy'/);
  assert.match(observer.if, /steps\.pii-authority\.outputs\.authority == 'legacy'/);
  const consumer = stepNamed('Publish the provider roadmap').run;
  for (const credential of ['new', 'legacy']) for (const pii of ['new', 'legacy']) {
    writeFileSync(calls, '');
    // A stale bundle must not turn on the old path under new authority.
    writeFileSync(path.join(dir, 'results-output/pii/population-release-v1.json'), '{}');
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CALLS: calls, TARGET: 'staging', AUTHORITY: credential, PII_AUTHORITY: pii,
      PRODUCT_COMMIT: 'a'.repeat(40), CORE_PACKAGE: 'core.tgz', NODE_PACKAGE: 'node.tgz', WASM_PACKAGE: 'wasm.tgz', RUNNER_TEMP: dir };
    const execute = shell => {
      const result = spawnSync('bash', ['-c', shell], { cwd: dir, env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    if (credential === 'legacy') execute(producer);
    if (pii === 'legacy') execute(observer.run);
    execute(consumer);
    const commands = readFileSync(calls, 'utf8');
    assert.equal(/run bench /.test(commands), credential === 'legacy');
    assert.equal(/run pii:observe:populations /.test(commands), pii === 'legacy');
    assert.equal(commands.includes('--bounded-population-oracle'), pii === 'legacy');
    assert.equal(commands.includes('--population-mode=not-measured'), pii === 'new');
    assert.ok(commands.includes('--pii-eval-artifact=benchmarks/pii-eval-official-run/qualification-plan.public-synthetic-artifact.json'));
    assert.ok(commands.includes(`--credential-support=public/results/support-matrix-${credential === 'new' ? 'view-v1' : 'v1'}.json`));
  }
  rmSync(dir, { recursive: true, force: true });
});

test('publication keeps discovery live and passes the validated credential authority to assembly', () => {
  const discovery = stepNamed('Produce the evaluation reports').run;
  assert.match(discovery, /npm run eval:discover -- --scanner=/);
  const assembly = stepNamed('Assemble the site root').run;
  assert.match(assembly, /assemble-site\.mjs --credential-authority "\$AUTHORITY"/);
  assert.match(assembly, /if \[ "\$AUTHORITY" = legacy \]; then test -s dist\/results\/run\.json/);
  assert.ok(indexOfStep('Assemble the site root') < steps.findIndex(s => s.uses?.startsWith('aws-actions/configure-aws-credentials@')));
});
