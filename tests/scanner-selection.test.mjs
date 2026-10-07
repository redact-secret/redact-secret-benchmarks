import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectScanners, describeSelection, renderSelection, selectionRecord } from '../benchmarks/qualification/scanner-selection.ts';
import { receiptProblems } from '../benchmarks/qualification/receipt-reuse.ts';
import { planAccuracy, planExecution, renderExecutionPlan, Telemetry } from '../benchmarks/qualification/execution-plan.ts';
import { effectiveScannerIds, provisionedExecutables, controlScannerIds, controlRosterProblems } from '../scripts/official-run-selection.mjs';
import { replaySelectionProblems } from '../scripts/run-candidate-replay.mjs';
import { replayEntry, reusableRun, OPENREDACTION_RUN_NAME } from '../scripts/run-evidence-replay.mjs';
import { officialRunProblems } from '../scripts/check-official-runs.mjs';
import { runArtifactSchemaDigest } from '../benchmarks/qualification/run-artifact.ts';

// #812: the effective scanner-selection policy, on bounded fixtures only. Nothing here starts an engine, a scanner or a workflow, and no value read from a committed
// run, ledger or digest is asserted (a repin re-keys them): the roster and registry used by the policy tests are synthetic; the integration tests run the real driver in
// --dry-run against a fixture engine directory that holds configuration FILES (names only).

const root = new URL('..', import.meta.url).pathname;
const read = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const lit = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // a literal inside a RegExp, backslash included
const FULL = 'credential-public-v1.json';
const WITHOUT = 'credential-public-v1.without-openredaction.json';
const roster = {
  schemaVersion: 1, id: 'scanner-roster-v1',
  runClasses: { official: { required: ['flare-redact', 'gitleaks', 'redact-secret', 'trufflehog'], optional: ['openredaction', 'openredaction-credential-bearing'] } },
  optionalScanners: {
    openredaction: { label: 'OpenRedaction default (all patterns)', profile: 'default', reason: 'synthetic', withoutConfigs: { 'linux-x64': WITHOUT, 'darwin-arm64': 'credential-public-v1.without-openredaction.darwin-arm64.json' }, engineRelease: 'v0.0.0-synthetic' },
    'openredaction-credential-bearing': { label: 'OpenRedaction credential profile', profile: 'credential-bearing', profileOf: 'openredaction', reason: 'synthetic', withoutConfigs: {}, engineRelease: 'not needed' },
  },
};
const registryIds = ['flare-redact', 'gitleaks', 'openredaction', 'redact-secret', 'trufflehog'];
const REQUIRED = ['flare-redact', 'gitleaks', 'redact-secret', 'trufflehog'];
const engineWith = (...files) => file => files.includes(file);
const request = (over = {}) => ({ roster, registryScannerIds: registryIds, platform: 'linux-x64', fullConfig: FULL, engineHasConfig: engineWith(FULL, WITHOUT), engineTag: 'v0.0.0-pinned', ...over });

test('absent inputs select the four required scanners and the released without-OpenRedaction configuration; zero OpenRedaction invocations (#812 acceptance 1)', () => {
  const { selection, problems } = selectScanners(request());
  assert.deepEqual(problems, []);
  assert.deepEqual(selection.scanners, REQUIRED);
  assert.equal(selection.configFile, WITHOUT);
  assert.equal(selection.configKind, 'without-optional');
  assert.equal(selection.policy, 'default-omit-optional');
  assert.deepEqual(selection.omittedOptionalScanners, ['openredaction']);
  assert.deepEqual(selection.includedOptionalScanners, []);
  assert.deepEqual(selection.omission, { openredaction: 'default' });
  const d = describeSelection(selection, { roster, population: 'regression-corpus', runs: 2 });
  assert.deepEqual(d.optionalScannerRuns, { openredaction: 0 }, 'zero OpenRedaction scan invocations, derived from the selection');
  assert.equal(d.scannerRuns, 4 * 2);
  const text = renderSelection(selection, { roster, population: 'regression-corpus', runs: 2 });
  assert.match(text, /OpenRedaction default \(all patterns\): OMITTED \(optional, omitted by default\)/);
  assert.match(text, /openredaction scan invocations: 0/);
  assert.match(text, new RegExp(lit(WITHOUT)));
});

test('the platform variant is selected from the roster for darwin-arm64', () => {
  const darwin = 'credential-public-v1.without-openredaction.darwin-arm64.json';
  const { selection } = selectScanners(request({ platform: 'darwin-arm64', fullConfig: 'credential-public-v1.darwin-arm64.json', engineHasConfig: engineWith(darwin) }));
  assert.equal(selection.configFile, darwin);
});

test('explicit opt-in selects the full configuration under its own recorded identity (#812 acceptance 2)', () => {
  const { selection, problems } = selectScanners(request({ includeOptional: ['openredaction'], engineHasConfig: engineWith(FULL) }));
  assert.deepEqual(problems, []);
  assert.deepEqual(selection.scanners, registryIds);
  assert.equal(selection.configFile, FULL);
  assert.equal(selection.configKind, 'full');
  assert.equal(selection.policy, 'explicit-include-optional');
  assert.deepEqual(selection.includedOptionalScanners, ['openredaction']);
  assert.deepEqual(selection.omittedOptionalScanners, []);
  const d = describeSelection(selection, { roster, runs: 2 });
  assert.deepEqual(d.optionalScannerRuns, { openredaction: 2 });
  assert.match(renderSelection(selection, { roster, runs: 2 }), /INCLUDED by explicit opt-in/);
  const record = selectionRecord(selection, 'sha256:aa');
  assert.deepEqual([record.configFile, record.configHash, record.includedOptionalScanners, record.omittedOptionalScanners], [FULL, 'sha256:aa', ['openredaction'], []]);
});

test('a pinned engine that ships no without-OpenRedaction configuration is refused; the default never falls back to the full one (#812)', () => {
  const { selection, problems } = selectScanners(request({ engineHasConfig: engineWith(FULL) }));
  assert.equal(selection, null);
  assert.match(problems.join(' '), new RegExp(`the pinned engine v0\\.0\\.0-pinned has no configuration ${lit(WITHOUT)}`));
  assert.match(problems.join(' '), /never measured with openredaction by accident/);
  assert.match(problems.join(' '), /include_openredaction/, 'it names the explicit way to get the historical configuration');
  // The explicit opt-in on the same engine is the legacy reproduction: the full configuration, no without-config needed.
  assert.deepEqual(selectScanners(request({ engineHasConfig: engineWith(FULL), includeOptional: ['openredaction'] })).problems, []);
});

test('omit_optional stays working and is deprecated: it changes nothing and says so (#812)', () => {
  const plain = selectScanners(request()).selection, omitted = selectScanners(request({ omitOptional: ['openredaction'] })).selection;
  assert.deepEqual(omitted.scanners, plain.scanners);
  assert.equal(omitted.configFile, plain.configFile);
  assert.deepEqual(omitted.omission, { openredaction: 'omit-optional-input' });
  assert.match(omitted.notices.join(' '), /DEPRECATED/);
  assert.deepEqual(plain.notices, []);
  assert.match(selectScanners(request({ omitOptional: ['trufflehog'] })).problems.join(' '), /a required scanner cannot be omitted/);
  assert.match(selectScanners(request({ omitOptional: ['openredaction-credential-bearing'] })).problems.join(' '), /nothing to leave out/);
  assert.match(selectScanners(request({ omitOptional: ['openredaction'], includeOptional: ['openredaction'] })).problems.join(' '), /both included .* and omitted/);
  assert.match(selectScanners(request({ includeOptional: ['trufflehog'] })).problems.join(' '), /not an optional scanner/);
  assert.match(selectScanners(request({ includeOptional: ['openredaction-credential-bearing'] })).problems.join(' '), /nothing to include/);
});

test('an attribution run needs its own without-OpenRedaction configuration by default; the full roster is an explicit choice (#812)', () => {
  const attribution = { subject: 'attribution run core-beta.12', fullConfig: 'credential-public-v1.core-beta.12.json' };
  const refused = selectScanners(request({ ...attribution, withoutConfigs: {} }));
  assert.equal(refused.selection, null);
  assert.match(refused.problems.join(' '), /attribution run core-beta\.12 pins no configuration without openredaction/);
  assert.match(refused.problems.join(' '), /never falls back to the full configuration/);
  const explicit = selectScanners(request({ ...attribution, withoutConfigs: {}, includeOptional: ['openredaction'] }));
  assert.equal(explicit.selection.configFile, 'credential-public-v1.core-beta.12.json');
  const own = selectScanners(request({ ...attribution, withoutConfigs: { 'linux-x64': 'credential-public-v1.core-beta.12.without-openredaction.json' }, engineHasConfig: engineWith('credential-public-v1.core-beta.12.without-openredaction.json') }));
  assert.deepEqual(own.selection.scanners, REQUIRED);
});

test('a roster without a without-config for the platform is refused', () => {
  const { selection, problems } = selectScanners(request({ platform: 'plan9' }));
  assert.equal(selection, null);
  assert.match(problems.join(' '), /names no run configuration without openredaction for platform plan9/);
});

test('a retry or receipt of another selection is never reused: scanner set, configuration and opt-in all bind (#812 acceptance 3)', () => {
  const want = { population: 'regression-corpus', platform: 'linux-x64', methods: false, engineRevision: 'abc', runs: 2, candidateId: null, attributionId: null, evidenceTag: null };
  const record = (scanners, selection) => ({ schema: 'redact-secret-benchmarks/official-run-record/v1', population: 'regression-corpus', platform: 'linux-x64', engine: { revision: 'abc' }, artifact: { digest: 'sha256:aa' }, determinism: { runs: 2, semanticDigestsEqual: true }, scanners: scanners.map(id => ({ id })), ...(selection ? { scannerSelection: selection } : {}) });
  const dflt = { configFile: WITHOUT, includedOptionalScanners: [] }, opted = { configFile: FULL, includedOptionalScanners: ['openredaction'] };
  // A retry of a default run reuses a default receipt.
  assert.deepEqual(receiptProblems(record(REQUIRED, dflt), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }), []);
  // The default run never takes an opted-in receipt (it would turn OpenRedaction on), and an opted-in retry never takes a default one.
  assert.ok(receiptProblems(record(registryIds, opted), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }).length > 0);
  assert.ok(receiptProblems(record(REQUIRED, dflt), 'sha256:aa', { ...want, scannerIds: registryIds, scannerSelection: opted }).length > 0);
  // Same scanners, another configuration or another opt-in claim: rejected with the reason.
  assert.match(receiptProblems(record(REQUIRED, { configFile: 'other.json', includedOptionalScanners: [] }), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }).join(' '), /measured under configuration other\.json/);
  assert.match(receiptProblems(record(REQUIRED, { configFile: WITHOUT, includedOptionalScanners: ['openredaction'] }), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }).join(' '), /a retry never turns an optional scanner on or off/);
  // A receipt of an earlier workflow records no selection: its scanner set stays its whole identity.
  assert.deepEqual(receiptProblems(record(REQUIRED), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }), []);
  assert.ok(receiptProblems(record(registryIds), 'sha256:aa', { ...want, scannerIds: REQUIRED, scannerSelection: dflt }).length > 0, 'a legacy five-scanner receipt is not a default receipt');
});

test('the execution plan omits the optional scanner by default, states zero invocations, and carries an opt-in in the dispatch (#812)', () => {
  const reg = { scanners: registryIds.map(id => ({ id })), populations: [{ id: 'regression-corpus' }, { id: 'public-evidence-snapshot' }], runs: [] };
  const base = { registry: reg, platform: 'linux-x64', kinds: { 'accuracy-fixtures': ['fixtures/a.txt'] }, changedScanners: [], product: 'redact-secret', lane: 'official', engineRunsFor: p => (p === 'public-evidence-snapshot' ? 4 : 2) };
  const dflt = planAccuracy({ ...base, scannerSelection: { omittedOptional: ['openredaction'], includedOptional: [] } });
  assert.deepEqual(dflt.populations[0].scanners.map(s => s.scanner), REQUIRED);
  assert.deepEqual(dflt.scannerSelection, { omittedOptional: ['openredaction'], includedOptional: [], optionalScannerRuns: { openredaction: 0 } });
  const opted = planAccuracy({ ...base, scannerSelection: { omittedOptional: [], includedOptional: ['openredaction'] } });
  assert.deepEqual(opted.populations[0].scanners.map(s => s.scanner), registryIds);
  assert.equal(opted.scannerSelection.optionalScannerRuns.openredaction, 6, 'the engine runs that invoke it, across the fresh populations');
  // A diagnostic plan is not affected by the official selection.
  assert.equal(planAccuracy({ ...base, lane: 'diagnostic', scannerSelection: { omittedOptional: ['openredaction'], includedOptional: [] } }).populations[0].scanners.length, 5);
  // Without a selection the plan is what it was.
  assert.equal(planAccuracy(base).populations[0].scanners.length, 5);

  const axes = read('benchmarks/execution-axes.json');
  const plan = scannerSelection => planExecution({ axis: 'accuracy', files: ['fixtures/accuracy/a.txt'], axes, accuracy: { ...base, kinds: undefined, scannerSelection, telemetry: new Telemetry(null) } });
  const d = plan({ omittedOptional: ['openredaction'], includedOptional: [] });
  assert.deepEqual(d.dispatch.map(x => x.inputs), [{ mode: 'full' }], 'no input names OpenRedaction by default');
  assert.match(renderExecutionPlan(d), /Optional scanner openredaction: OMITTED \(optional, default\) - not planned; openredaction scan invocations: 0/);
  const o = plan({ omittedOptional: [], includedOptional: ['openredaction'] });
  assert.deepEqual(o.dispatch.map(x => x.inputs), [{ mode: 'full', include_openredaction: 'true' }]);
  assert.match(o.dispatch[0].command, /-f include_openredaction=true/);
});

test('provisioning follows the effective selection: an optional executable is fetched only on the opt-in (#812)', () => {
  const scanners = [{ id: 'gitleaks', kind: 'executable' }, { id: 'trufflehog', kind: 'executable' }, { id: 'optional-exe', kind: 'executable' }, { id: 'openredaction', kind: 'npm' }, { id: 'redact-secret', kind: 'npm' }];
  const r = { runClasses: { official: { optional: ['optional-exe', 'openredaction'] } } };
  assert.deepEqual(provisionedExecutables(scanners, r).map(s => s.id), ['gitleaks', 'trufflehog']);
  assert.deepEqual(provisionedExecutables(scanners, r, ['optional-exe']).map(s => s.id), ['gitleaks', 'trufflehog', 'optional-exe']);
  assert.deepEqual(effectiveScannerIds(scanners, r), ['gitleaks', 'trufflehog', 'redact-secret']);
  assert.deepEqual(effectiveScannerIds(scanners, r, ['openredaction']).sort(), ['gitleaks', 'openredaction', 'redact-secret', 'trufflehog']);
  // The real registry and roster agree with the TypeScript policy about what a default run measures.
  const real = effectiveScannerIds(read('benchmarks/official-runs.json').scanners, read('benchmarks/support/scanner-roster.json'));
  assert.ok(!real.includes('openredaction') && REQUIRED.every(id => real.includes(id)));
});

const recorded = (...ids) => ({ recordedRuns: [{ id: 'a', caseCounts: Object.fromEntries(ids.map(i => [i, 1])) }, { id: 'b', caseCounts: Object.fromEntries(ids.map(i => [i, 2])) }] });

test('a control and a candidate with different scanner rosters are reported as incompatible, never matched or spliced (#812 acceptance 3)', () => {
  assert.deepEqual(controlScannerIds(recorded('b', 'a')), ['a', 'b']);
  assert.equal(controlScannerIds({ recordedRuns: [] }), null);
  assert.equal(controlScannerIds({ recordedRuns: [{ caseCounts: { a: 1 } }, { caseCounts: { a: 1, b: 1 } }] }), null, 'runs of one control that disagree on the roster');
  assert.deepEqual(controlRosterProblems({ control: REQUIRED, selected: REQUIRED, roster }), []);
  const fiveControl = controlRosterProblems({ control: registryIds, selected: REQUIRED, roster });
  assert.match(fiveControl.join(' '), /incompatible scanner rosters/);
  assert.match(fiveControl.join(' '), /control measured the optional scanner openredaction/);
  assert.match(fiveControl.join(' '), /include_openredaction/);
  const fiveRun = controlRosterProblems({ control: REQUIRED, selected: registryIds, roster });
  assert.match(fiveRun.join(' '), /would measure the optional scanner openredaction and the control did not/);
  assert.match(fiveRun.join(' '), /run-evidence-replay\.mjs dispatch --include-openredaction/, 'it says how to create the matching control explicitly');
  assert.match(controlRosterProblems({ control: null, selected: REQUIRED, roster }).join(' '), /records no scanner set/);
  assert.match(controlRosterProblems({ control: ['a'], selected: ['b'], roster }).join(' '), /incompatible/);
});

test('a candidate replay dispatch checks the control of its adoption before spending CI (#812)', () => {
  const adoption = (...ids) => ({ state: 'accepted', candidate: { evidenceRelease: 'snapshot-2026.01.01', engine: { tag: 'v1' }, product: { version: '1' }, replay: { ...recorded(...ids), archive: { release: 'r' }, replayCopy: { release: 'copy', sha256: `sha256:${'a'.repeat(64)}` } } } });
  const officialRuns = { scanners: registryIds.map(id => ({ id })) };
  assert.deepEqual(replaySelectionProblems({ adoption: adoption(...REQUIRED), include: false, officialRuns, roster }), []);
  assert.match(replaySelectionProblems({ adoption: adoption(...REQUIRED), include: true, officialRuns, roster }).join(' '), /would measure the optional scanner openredaction and the control did not/);
  assert.match(replaySelectionProblems({ adoption: adoption(...registryIds), include: false, officialRuns, roster }).join(' '), /control measured the optional scanner openredaction/);
  assert.deepEqual(replaySelectionProblems({ adoption: adoption(...registryIds), include: true, officialRuns, roster }), [], 'a control and a candidate that both opted in are compatible');
  assert.match(replaySelectionProblems({ adoption: { state: 'pending' }, include: false, officialRuns, roster }).join(' '), /records no engineCandidate/);
});

test('a control replay records the roster it measured and refuses a run made for another selection (#812)', () => {
  const rec = (scanners, selection) => ({ engine: { revision: 'rev' }, benchmarkRevision: 'sha', determinism: { semanticDigestsEqual: true }, population: 'regression-corpus', platform: 'linux-x64', evidence: { release: { tag: 'snapshot-x' } }, artifact: { semanticDigest: 'd', digest: 'e' }, configHash: 'h', caseCounts: Object.fromEntries(scanners.map(i => [i, 1])), scanners: scanners.map(id => ({ id })), ...(selection ? { scannerSelection: selection } : {}) });
  const args = records => ({ records: records.map(record => ({ rel: 'regression-corpus', record })), ec: { engine: { revision: 'rev' } }, tag: 'snapshot-x', runId: '1', sha: 'sha', branch: 'b', archive: { release: 'r', sha256: 'x' }, patchPath: 'p' });
  const entry = replayEntry(args([rec(REQUIRED)]));
  assert.deepEqual(entry.scannerSelection, { scanners: REQUIRED, includedOptionalScanners: [], omittedOptionalScanners: ['openredaction'] });
  assert.throws(() => replayEntry(args([rec(registryIds, { includedOptionalScanners: ['openredaction'] })])), /measured OpenRedaction, this control was asked to omit it/);
  assert.throws(() => replayEntry({ ...args([rec(REQUIRED)]), includeOpenRedaction: true }), /did not measure OpenRedaction, this control was asked to include it/);
  const opted = replayEntry({ ...args([rec(registryIds, { includedOptionalScanners: ['openredaction'] })]), includeOpenRedaction: true });
  assert.deepEqual(opted.scannerSelection.includedOptionalScanners, ['openredaction']);
  assert.throws(() => replayEntry(args([rec(REQUIRED), rec(registryIds)])), /different scanner rosters/);
  // The roster of the control is readable back from its recorded runs, which is what a candidate replay is compared with.
  assert.deepEqual(controlScannerIds(entry), REQUIRED);
});

test('a control run dispatched for another selection is never reused (#812)', () => {
  const run = (displayTitle, over = {}) => ({ event: 'workflow_dispatch', headSha: 'sha', conclusion: 'success', createdAt: '2026-10-07T00:00:00Z', databaseId: 1, displayTitle, ...over });
  assert.equal(reusableRun([run('Official credential-eval runs')], 'sha')?.databaseId, 1);
  assert.equal(reusableRun([run('Official credential-eval runs')], 'sha', true), undefined, 'a default run is not the opted-in control');
  assert.equal(reusableRun([run(`Official credential-eval runs ${OPENREDACTION_RUN_NAME}`)], 'sha'), undefined, 'an opted-in run is not the default control');
  assert.equal(reusableRun([run(`Official credential-eval runs ${OPENREDACTION_RUN_NAME}`)], 'sha', true)?.databaseId, 1);
});

test('the registry check binds a recorded scanner selection to what the run measured (#812)', () => {
  const registry = read('benchmarks/official-runs.json');
  const context = { schemaDigest: runArtifactSchemaDigest(), inputs: read('benchmarks/qualification-inputs.json') };
  const mutate = change => { const r = structuredClone(registry); change(r.runs[0]); return officialRunProblems(r, context); };
  const ids = run => run.scanners.map(s => s.id);
  assert.deepEqual(mutate(() => {}).filter(p => /scannerSelection/.test(p)), []);
  assert.deepEqual(mutate(run => { run.scannerSelection = { configFile: 'x.json', scanners: ids(run), includedOptionalScanners: [], omittedOptionalScanners: run.omittedOptionalScanners ?? [] }; }).filter(p => /scannerSelection/.test(p)), []);
  assert.ok(mutate(run => { run.scannerSelection = { configFile: 'x.json', scanners: [...ids(run), 'extra'], includedOptionalScanners: [], omittedOptionalScanners: [] }; }).some(p => /scannerSelection names the scanners/.test(p)));
  assert.ok(mutate(run => { run.scannerSelection = { configFile: 'x.json', scanners: ids(run), includedOptionalScanners: ['openredaction'], omittedOptionalScanners: [] }; }).some(p => /scannerSelection includes openredaction, which is not an optional scanner this run measured/.test(p)) || ids(registry.runs[0]).includes('openredaction'));
  assert.ok(mutate(run => { run.scannerSelection = { configFile: 'x.json', scanners: ids(run), includedOptionalScanners: [], omittedOptionalScanners: ['openredaction'] }; delete run.omittedOptionalScanners; }).some(p => /omittedOptionalScanners does not say so/.test(p)));
  assert.ok(mutate(run => { run.scannerSelection = { scanners: ids(run), includedOptionalScanners: [], omittedOptionalScanners: [] }; }).some(p => /names no configuration file/.test(p)));
});

// ---- the real driver, --dry-run, against a fixture engine directory (configuration file names only; no engine is built or run)

const scratch = mkdtempSync(path.join(os.tmpdir(), 'scanner-selection-'));
const fixtureEngine = (...files) => { const dir = mkdtempSync(path.join(scratch, 'engine-')); mkdirSync(path.join(dir, 'configs/official'), { recursive: true }); for (const f of files) writeFileSync(path.join(dir, 'configs/official', f), '{}\n'); return dir; };
const driver = (engine, extra = []) => spawnSync('node', ['--import', 'tsx', 'scripts/run-official-credential-eval.ts', '--population', 'regression-corpus', '--engine-dir', engine, '--platform', 'linux-x64', '--runs', '2', ...extra], { cwd: root, encoding: 'utf8' });
const registry = read('benchmarks/official-runs.json');
const realRoster = read('benchmarks/support/scanner-roster.json');
const realFull = registry.config.platforms['linux-x64'].file, realWithout = realRoster.optionalScanners.openredaction.withoutConfigs['linux-x64'];

test('driver --dry-run, no inputs: four required scanners, the without-OpenRedaction config, zero OpenRedaction invocations, nothing started (#812 acceptance 1, 5)', () => {
  const out = path.join(scratch, 'out-default');
  const r = driver(fixtureEngine(realFull, realWithout), ['--dry-run', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OpenRedaction default \(all patterns\): OMITTED/);
  assert.match(r.stdout, /openredaction scan invocations: 0/);
  assert.match(r.stdout, new RegExp(lit(realWithout)));
  assert.match(r.stdout, /nothing was started/);
  const described = JSON.parse(readFileSync(path.join(out, 'scanner-selection.json'), 'utf8'));
  assert.deepEqual(described.scanners, registry.scanners.map(s => s.id).filter(id => id !== 'openredaction'));
  assert.deepEqual(described.optionalScannerRuns, { openredaction: 0 });
  assert.ok(!existsSync(path.join(out, 'artifact-1.json')) && !existsSync(path.join(out, 'run-record.json')), 'a dry run writes the selection only');
});

test('driver --dry-run --include-optional openredaction: the opt-in is visible in the plan and selects the full configuration (#812 acceptance 2)', () => {
  const r = driver(fixtureEngine(realFull, realWithout), ['--dry-run', '--include-optional', 'openredaction']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /EXPLICIT opt-in/);
  assert.match(r.stdout, /INCLUDED by explicit opt-in/);
  assert.match(r.stdout, /openredaction scan invocations: 2/);
  assert.match(r.stdout, new RegExp(lit(realFull)));
});

test('driver --dry-run, legacy reproduction: an engine without the without-config still reproduces the full configuration on the opt-in only (#812)', () => {
  const legacy = fixtureEngine(realFull);
  const refused = driver(legacy, ['--dry-run']);
  assert.equal(refused.status, 4);
  assert.match(refused.stderr, /has no configuration/);
  assert.match(refused.stderr, /never measured with openredaction by accident/);
  const reproduced = driver(legacy, ['--dry-run', '--include-optional', 'openredaction']);
  assert.equal(reproduced.status, 0, reproduced.stderr);
  assert.match(reproduced.stdout, new RegExp(lit(realFull)));
});

test('driver --dry-run, deprecated --omit-optional: accepted, says it is deprecated, selects the same as the default (#812)', () => {
  const r = driver(fixtureEngine(realFull, realWithout), ['--dry-run', '--omit-optional', 'openredaction']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /notice: --omit-optional openredaction is DEPRECATED/);
  assert.match(r.stdout, /openredaction scan invocations: 0/);
  const both = driver(fixtureEngine(realFull, realWithout), ['--dry-run', '--omit-optional', 'openredaction', '--include-optional', 'openredaction']);
  assert.equal(both.status, 4);
  assert.match(both.stderr, /both included .* and omitted/);
  assert.equal(driver(fixtureEngine(realFull, realWithout), ['--dry-run', '--omit-optional', 'trufflehog']).status, 4);
});

test('driver, candidate replay against an incompatible control is refused before anything runs (#812 acceptance 3)', () => {
  const candidates = read('benchmarks/product-candidates.json').candidates;
  if (!candidates.length) return;
  const engine = fixtureEngine(realFull, realWithout);
  // The control of the accepted adoption records its scanner roster; the opposite selection is incompatible with it. Both directions are exercised through the pure check above; here the driver must
  // refuse an incompatible selection, whichever way the committed control points, with the incompatibility named.
  const dflt = driver(engine, ['--dry-run', '--candidate', candidates[0].id]);
  const opted = driver(engine, ['--dry-run', '--candidate', candidates[0].id, '--include-optional', 'openredaction']);
  for (const r of [dflt, opted]) if (r.status !== 0) { assert.equal(r.status, 4); assert.match(r.stderr, /incompatible scanner rosters/); }
  // At most one of the two selections can match one control's roster.
  assert.ok(!(dflt.status === 0 && opted.status === 0), 'one control cannot accept both selections');
});

test('the workflow wires the positive opt-in, deprecates omit_optional and never turns OpenRedaction on by itself (#812)', () => {
  const yml = readFileSync(path.join(root, '.github/workflows/official-runs.yml'), 'utf8');
  const code = yml.replace(/^\s*#.*$/gm, '');
  assert.match(code, /include_openredaction:\n\s+description: .*\n\s+required: false\n\s+default: false\n\s+type: boolean/, 'a boolean input, off by default');
  assert.match(code, /omit_optional:\n\s+description: DEPRECATED/);
  assert.match(code, /INCLUDE_OPTIONAL: \$\{\{ inputs\.include_openredaction && 'openredaction' \|\| '' \}\}/);
  assert.equal((code.match(/\$\{INCLUDE_OPTIONAL:\+--include-optional "\$INCLUDE_OPTIONAL"\}/g) ?? []).length, 3, 'the plain run, the methods run and the provisioning all take the same opt-in');
  assert.match(code, /include_openredaction measures OpenRedaction in a full scan: it is exclusive with diagnostic mode, the view-only reuse inputs/);
  assert.match(code, /include_openredaction and omit_optional contradict each other/);
  assert.match(code, /Scanner selection: default - flare-redact, gitleaks, redact-secret, trufflehog\. OpenRedaction \(optional\) is OMITTED; zero OpenRedaction scan invocations/);
  assert.match(code, /run-name: .*OpenRedaction included/);
  // A retry carries no opt-in of its own: the retry step downloads receipts, and the driver (which holds the selection) judges them.
  assert.doesNotMatch(code.split('scripts/retry-receipts.mjs')[1].split('\n')[0], /INCLUDE_OPTIONAL|openredaction/);
  assert.match(yml, /Scanner selection of each finished stage/);
});

test('the control replay checks the engine tree for the configuration its selection needs before any branch or CI minute (#812)', async () => {
  const { requiredEngineConfig } = await import('../scripts/run-evidence-replay.mjs');
  const registryFixture = { config: { platforms: { 'linux-x64': { file: FULL } } } };
  assert.equal(requiredEngineConfig({ roster, registry: registryFixture, includeOpenRedaction: false }), WITHOUT);
  assert.equal(requiredEngineConfig({ roster, registry: registryFixture, includeOpenRedaction: true }), FULL);
});
