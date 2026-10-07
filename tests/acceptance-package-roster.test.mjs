// The scanner-selection identity of an acceptance package (#773): the four-required-scanner shape (flare-redact, gitleaks, redact-secret, trufflehog; optional OpenRedaction omitted) of the
// retained run 37630100920, reconciled across the recorder, the archive, the derived inputs, the view and the parity report, and the refusals of a mismatched roster or a stale control.
// Bounded: a retained slice of the run's identity (tests/fixtures/acceptance-package/four-scanner-control.json) and synthetic surfaces; no network, no scanner, no replay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  RECONCILED_SURFACES, acceptanceSelection, acceptanceSelectionProblems, archiveProblems, controlRecordProblems, derivedInputProblems, packageSelection, parityProblems, recordedRunProblems, viewProblems,
} from '../scripts/acceptance-roster.mjs';
import { evidenceCandidateProblems } from '../scripts/check-evidence-adoption.mjs';
import { acceptedRecord } from '../scripts/prepare-acceptance-package.mjs';

const read = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const readJson = f => JSON.parse(read(f));
const fixture = readJson('tests/fixtures/acceptance-package/four-scanner-control.json');
const roster = readJson('benchmarks/support/scanner-roster.json');
const registryScanners = readJson('benchmarks/official-runs.json').scanners;
const clone = v => structuredClone(v);
const REQUIRED = ['flare-redact', 'gitleaks', 'redact-secret', 'trufflehog'];
const TAG = 'snapshot-2026.10.06.4';

/** The adoption record's control replay, as scripts/run-evidence-replay.mjs records it; `recorded` adds the #812 scannerSelection block. */
const controlReplay = ({ recorded = false, extra = [] } = {}) => {
  const recordedRuns = fixture.runs.map(r => ({ id: r.id, semanticDigest: r.semanticDigest, byteDigest: r.byteDigest, configHash: r.configHash, caseCounts: { ...r.caseCounts, ...Object.fromEntries(extra.map(id => [id, 1])) } })).sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    state: 'replayed', ciRun: `https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/${fixture.ciRun}`, benchmarkRevision: fixture.benchmarkRevision,
    archive: { release: 'official-runs-x', sha256: `sha256:${'a'.repeat(64)}` },
    semanticDigests: Object.fromEntries(fixture.runs.map(r => [r.id.replace(/@.*$/, ''), r.semanticDigest])),
    recordedRuns,
    ...(recorded ? { scannerSelection: { scanners: [...REQUIRED, ...extra].sort(), includedOptionalScanners: extra, omittedOptionalScanners: extra.length ? [] : ['openredaction'] } } : {}),
  };
};
const candidate = replay => ({ evidenceRelease: TAG, engine: { tag: 'v0.1.0-alpha.16', revision: fixture.engineRevision }, replay });
/** The run-record.json files of the control's archive, from the retained identity. */
const records = ({ selection = false } = {}) => fixture.runs.map(r => ({
  rel: `${r.population}${r.methods ? '/methods' : ''}/run-record.json`,
  record: {
    population: r.population, kind: r.methods ? 'methods' : 'plain', platform: r.platform, configHash: r.configHash, caseCounts: r.caseCounts,
    artifact: { semanticDigest: r.semanticDigest, digest: r.byteDigest }, engine: { revision: fixture.engineRevision }, benchmarkRevision: fixture.benchmarkRevision,
    evidence: { release: { tag: r.evidenceTag } }, scanners: r.scanners.map(id => ({ id })), omittedOptionalScanners: r.omittedOptionalScanners,
    ...(selection ? { scannerSelection: { configFile: 'credential-public-v1.without-openredaction.json', configHash: r.configHash, scanners: r.scanners, includedOptionalScanners: [], omittedOptionalScanners: r.omittedOptionalScanners } } : {}),
  },
}));
const select = (replay, includeOpenRedaction = false) => packageSelection({ replay, roster, registryScanners, includeOpenRedaction });
const four = () => { const { selection, problems } = select(controlReplay()); assert.deepEqual(problems, []); return selection; };

const view = (selection, replay) => ({
  scanners: selection.scanners,
  scannerRoster: { measured: selection.scanners, notMeasured: selection.omittedOptionalScanners.map(scanner => ({ scanner, statement: `${scanner}: not measured in this run (optional)` })) },
  populations: replay.recordedRuns.filter(r => !r.id.includes('+methods')).map(r => ({ population: r.id.replace(/@.*$/, ''), artifact: { artifactDigest: r.byteDigest, configHash: r.configHash } })),
});
const parity = (selection, replay) => ({
  summary: { unexplained: 0 },
  identities: { new: { scanners: Object.fromEntries(selection.scanners.map(id => [id, '1'])), populations: replay.recordedRuns.map(r => ({ run: r.id, semanticDigest: r.semanticDigest, configHash: r.configHash })) } },
});

test('the retained run 37630100920 is the four-required-scanner shape: the required scanners, OpenRedaction omitted, no scannerSelection recorded (pre-#813 dispatch)', () => {
  const { selection, problems } = select(controlReplay());
  assert.deepEqual(problems, []);
  assert.deepEqual(selection.scanners, REQUIRED);
  assert.deepEqual(selection.required, REQUIRED);
  assert.deepEqual(selection.includedOptionalScanners, []);
  assert.deepEqual(selection.omittedOptionalScanners, ['openredaction']);
  assert.equal(selection.policy, 'default-omit-optional');
  assert.equal(selection.basis, 'derived-from-case-counts');
  // The #813 shape, which records its own selection, gives the same package selection from the same runs.
  const recorded = select(controlReplay({ recorded: true }));
  assert.deepEqual(recorded.problems, []);
  assert.equal(recorded.selection.basis, 'recorded');
  assert.deepEqual({ ...recorded.selection, basis: null }, { ...selection, basis: null });
});

test('a control of another roster is refused: OpenRedaction measured without the opt-in, or omitted when the opt-in is asked for', () => {
  const withOpen = controlReplay({ extra: ['openredaction'] });
  assert.match(select(withOpen).problems.join(), /incompatible scanner rosters/);
  assert.match(select(withOpen).problems.join(), /include-openredaction/);
  const opted = select(withOpen, true);
  assert.deepEqual(opted.problems, []);
  assert.equal(opted.selection.policy, 'explicit-include-optional');
  assert.deepEqual(opted.selection.includedOptionalScanners, ['openredaction']);
  assert.deepEqual(opted.selection.omittedOptionalScanners, []);
  const refused = select(controlReplay(), true);
  assert.match(refused.problems.join(), /incompatible scanner rosters/);
  assert.equal(refused.selection, null);
});

test('a control without a required scanner, with an unknown one, with no scanner set or contradicting its own record is refused', () => {
  const dropped = controlReplay();
  for (const r of dropped.recordedRuns) delete r.caseCounts.gitleaks;
  assert.match(select(dropped).problems.join(), /lacks the required scanner\(s\) gitleaks/);
  assert.match(select(controlReplay({ extra: ['mystery-scanner'] })).problems.join(), /mystery-scanner, which the scanner roster .* does not name/);
  assert.match(select(controlReplay({ extra: ['openredaction-credential-bearing'] })).problems.join(), /in no official configuration/);
  const blank = controlReplay();
  blank.recordedRuns[0].caseCounts = {};
  assert.match(select(blank).problems.join(), /records no scanner set/);
  const mixed = controlReplay();
  delete mixed.recordedRuns[0].caseCounts.trufflehog;
  assert.match(select(mixed).problems.join(), /records no scanner set/);
  const lying = controlReplay({ recorded: true });
  lying.scannerSelection.omittedOptionalScanners = [];
  assert.match(select(lying).problems.join(), /scannerSelection omits none, its runs left out openredaction/);
  const claimsIncluded = controlReplay({ recorded: true });
  claimsIncluded.scannerSelection.includedOptionalScanners = ['openredaction'];
  assert.match(select(claimsIncluded).problems.join(), /scannerSelection includes openredaction, its runs measured none/);
});

test('the control replay\'s archive: the run records are the recorded runs, or the control is stale', () => {
  const selection = four();
  const replay = controlReplay();
  const check = (mutate, shape) => { const r = records(shape); mutate(r); return controlRecordProblems({ ec: candidate(replay), tag: TAG, selection, records: r }).join(' | '); };
  assert.equal(check(() => {}), '');
  assert.equal(check(() => {}, { selection: true }), '');
  assert.match(check(r => { r[0].record.artifact.semanticDigest = `sha256:${'0'.repeat(64)}`; }), /semantic digest .* stale control/);
  assert.match(check(r => { r[1].record.artifact.digest = `sha256:${'0'.repeat(64)}`; }), /byte digest .* stale control/);
  assert.match(check(r => { r[2].record.configHash = `sha256:${'0'.repeat(64)}`; }), /another scanner configuration than the control's/);
  assert.match(check(r => { r[3].record.engine.revision = 'f'.repeat(40); }), /is not the candidate's/);
  assert.match(check(r => { r[0].record.benchmarkRevision = 'e'.repeat(40); }), /is not the control's/);
  assert.match(check(r => { r.find(x => x.record.population === 'public-evidence-snapshot' && x.record.kind === 'plain').record.evidence.release.tag = 'snapshot-2026.10.05'; }), /not snapshot-2026\.10\.06\.4/);
  assert.match(check(r => { r.pop(); }), /holds no run record for/);
  assert.match(check(r => { r[0].record.population = 'some-other-corpus'; }), /stale or foreign archive/);
  assert.match(check(r => { r[0].record.productCandidate = { id: 'core-x' }; }), /not the control/);
  // The records' own scanner set must be the package's.
  assert.match(check(r => { r[0].record.scanners.push({ id: 'openredaction' }); r[0].record.omittedOptionalScanners = []; }), /measured .*openredaction.*the package's roster is/);
  assert.match(check(r => { r[0].record.omittedOptionalScanners = []; }), /omittedOptionalScanners is none, the package leaves out openredaction/);
  assert.match(check(r => { r[0].record.scannerSelection.includedOptionalScanners = ['openredaction']; }, { selection: true }), /scannerSelection includes openredaction/);
  assert.match(check(r => { r[0].record.scannerSelection.configHash = `sha256:${'1'.repeat(64)}`; }, { selection: true }), /scannerSelection configHash .* is not the run's configHash/);
  // The adoption record itself contradicting its runs is stale too.
  const staleRecord = controlReplay();
  staleRecord.recordedRuns[0].configHash = `sha256:${'2'.repeat(64)}`;
  assert.match(controlRecordProblems({ ec: candidate(staleRecord), tag: TAG, selection, records: records() }).join(), /configuration hash/);
});

test('the recorder: benchmarks/official-runs.json holds the control\'s runs of the package roster, nothing stale kept', () => {
  const selection = four();
  const replay = controlReplay();
  const registryRuns = () => fixture.runs.map(r => ({ id: r.id, artifact: { semanticDigest: r.semanticDigest, byteDigest: r.byteDigest }, configHash: r.configHash, scanners: r.scanners.map(id => ({ id })), omittedOptionalScanners: r.omittedOptionalScanners }));
  assert.deepEqual(recordedRunProblems({ selection, replay, runs: registryRuns() }), []);
  const stale = registryRuns();
  stale.push({ ...clone(stale[0]), id: 'policy-corpus@darwin-arm64' });
  assert.match(recordedRunProblems({ selection, replay, runs: stale }).join(), /did not run: a stale run kept after the repin/);
  assert.match(recordedRunProblems({ selection, replay, runs: registryRuns().slice(1) }).join(), /records no policy-corpus@linux-x64/);
  const wrongSet = registryRuns();
  wrongSet[0].scanners.push({ id: 'openredaction' });
  assert.match(recordedRunProblems({ selection, replay, runs: wrongSet }).join(), /measured .*openredaction.*the package's roster is/);
  const digest = registryRuns();
  digest[1].artifact.semanticDigest = `sha256:${'3'.repeat(64)}`;
  assert.match(recordedRunProblems({ selection, replay, runs: digest }).join(), /semantic digest differs from the control's/);
  const config = registryRuns();
  config[2].configHash = `sha256:${'4'.repeat(64)}`;
  assert.match(recordedRunProblems({ selection, replay, runs: config }).join(), /configuration hash differs from the control's/);
});

test('the archive: the control\'s CI run, its release and asset, and a roster it names', () => {
  const selection = four();
  const archive = () => ({ release: { tag: fixture.archive.release, asset: fixture.archive.asset }, source: { ciRun: fixture.ciRun } });
  assert.deepEqual(archiveProblems({ archive: archive(), runId: fixture.ciRun, selection }), []);
  assert.match(archiveProblems({ archive: archive(), runId: '1', selection }).join(), /names CI run 37630100920, the control replay is run 1/);
  const other = archive();
  other.release.tag = 'official-runs-registry-1';
  assert.match(archiveProblems({ archive: other, runId: fixture.ciRun, selection }).join(), /is not official-runs-registry-37630100920/);
  const named = archive();
  named.source.scannerSelection = { scanners: [...REQUIRED, 'openredaction'], omittedOptionalScanners: [] };
  assert.match(archiveProblems({ archive: named, runId: fixture.ciRun, selection }).join(), /scannerSelection .* is not the package's roster/);
});

test('the derived inputs were derived from the control\'s plain and methods runs', () => {
  const replay = controlReplay();
  const digest = id => replay.recordedRuns.find(r => r.id === id).semanticDigest;
  const receipt = () => ({ artifacts: { plain: { semanticDigest: digest('public-evidence-snapshot@linux-x64') }, methods: { semanticDigest: digest('public-evidence-snapshot+methods@linux-x64') } } });
  assert.deepEqual(derivedInputProblems({ receipt: receipt(), replay }), []);
  const plain = receipt();
  plain.artifacts.plain.semanticDigest = `sha256:${'5'.repeat(64)}`;
  assert.match(derivedInputProblems({ receipt: plain, replay }).join(), /plain run with semantic digest/);
  const methods = receipt();
  methods.artifacts.methods.semanticDigest = `sha256:${'6'.repeat(64)}`;
  assert.match(derivedInputProblems({ receipt: methods, replay }).join(), /methods run with semantic digest/);
  assert.match(derivedInputProblems({ receipt: { artifacts: {} }, replay }).join(), /names no plain run.*names no methods run/);
});

test('the view states the control\'s scanners and every omitted optional scanner as not measured, from the control\'s artifacts', () => {
  const selection = four();
  const replay = controlReplay();
  assert.deepEqual(viewProblems({ view: view(selection, replay), selection, replay }), []);
  const spliced = view(selection, replay);
  spliced.scanners = [...REQUIRED, 'openredaction'];
  spliced.scannerRoster.measured = [...REQUIRED, 'openredaction'];
  spliced.scannerRoster.notMeasured = [];
  const text = viewProblems({ view: spliced, selection, replay }).join();
  assert.match(text, /lists the scanners .*openredaction/);
  assert.match(text, /does not state openredaction as not measured: a silently dropped optional scanner/);
  const noRoster = view(selection, replay);
  delete noRoster.scannerRoster;
  assert.match(viewProblems({ view: noRoster, selection, replay }).join(), /carries no scannerRoster/);
  const contradicts = view(selection, replay);
  contradicts.scannerRoster.notMeasured.push({ scanner: 'gitleaks' });
  assert.match(viewProblems({ view: contradicts, selection, replay }).join(), /states gitleaks as not measured, but the control measured it/);
  const foreign = view(selection, replay);
  foreign.populations[0].artifact.artifactDigest = `sha256:${'7'.repeat(64)}`;
  foreign.populations[1].artifact.configHash = `sha256:${'8'.repeat(64)}`;
  assert.match(viewProblems({ view: foreign, selection, replay }).join(), /was built from artifact .*the control's is.*configuration hash differs/);
});

test('the parity report compares the control\'s scanners and runs, strictly', () => {
  const selection = four();
  const replay = controlReplay();
  assert.deepEqual(parityProblems({ parity: parity(selection, replay), selection, replay }), []);
  const loose = parity(selection, replay);
  loose.summary.unexplained = 3;
  assert.match(parityProblems({ parity: loose, selection, replay }).join(), /3 unexplained difference/);
  const wide = parity(selection, replay);
  wide.identities.new.scanners.openredaction = '1.1.5';
  assert.match(parityProblems({ parity: wide, selection, replay }).join(), /new side lists the scanners .*openredaction[\s\S]*omitted optional scanner openredaction/);
  const foreign = parity(selection, replay);
  foreign.identities.new.populations[0].semanticDigest = `sha256:${'9'.repeat(64)}`;
  foreign.identities.new.populations[1].run = 'policy-corpus@darwin-arm64';
  const text = parityProblems({ parity: foreign, selection, replay }).join();
  assert.match(text, /semantic digest .*the control's is/);
  assert.match(text, /not a run of the control replay/);
});

test('the prepared acceptance records the selection, and adoption:check binds it to the control replay', () => {
  const selection = four();
  const replay = controlReplay();
  const block = acceptanceSelection({ selection, replay, archive: { release: { tag: fixture.archive.release, asset: fixture.archive.asset } }, runId: fixture.ciRun });
  assert.deepEqual(block.reconciled, RECONCILED_SURFACES);
  assert.deepEqual(block.scanners, REQUIRED);
  assert.deepEqual(block.omittedOptionalScanners, ['openredaction']);
  assert.equal(Object.keys(block.configHashes).length, 4);
  assert.doesNotMatch(JSON.stringify(block), /acceptedBy|acceptedOn|OWNER-TO-SET/);
  assert.deepEqual(acceptanceSelectionProblems({ scannerSelection: block }, replay, roster), []);
  assert.deepEqual(acceptanceSelectionProblems({}, replay, roster), [], 'a package prepared before #773 records none and is accepted as it was');
  const edit = change => acceptanceSelectionProblems({ scannerSelection: { ...clone(block), ...change } }, replay, roster).join(' | ');
  assert.match(edit({ scanners: [...REQUIRED, 'openredaction'] }), /is not what the control replay measured/);
  assert.match(edit({ scanners: ['gitleaks'], required: ['gitleaks'] }), /lacks the required scanner|required scanners/);
  assert.match(edit({ includedOptionalScanners: ['openredaction'] }), /includedOptionalScanners/);
  assert.match(edit({ controlRun: '1' }), /controlRun 1 is not the control replay's run/);
  assert.match(edit({ configHashes: { ...block.configHashes, 'policy-corpus@linux-x64': `sha256:${'a'.repeat(64)}` } }), /configHashes\.policy-corpus@linux-x64/);
  assert.match(acceptanceSelectionProblems({ scannerSelection: block }, undefined, roster).join(), /no control replay/);
  // Wired into the gate: an evidence candidate whose package names another roster than its control fails adoption:check.
  const files = { 'p.patch': '', 'p.sha': `${'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}  p.patch\n`, 'r.md': '', 'c.json': '' };
  const ec = {
    evidenceRelease: 'snapshot-2026.10.07', manifestDigest: `sha256:${'3'.repeat(64)}`, snapshotDigest: `sha256:${'4'.repeat(64)}`, adoptionKey: `sha256:${'5'.repeat(64)}`,
    engine: { tag: 'v0.1.0-alpha.16', revision: 'd'.repeat(40) }, engineCompatibility: { compatible: true }, ownerAcceptance: null, changeReport: 'r.json', replay,
    acceptance: { report: 'r.md', comparison: 'c.json', patch: 'p.patch', patchDigestFile: 'p.sha', scannerSelection: block },
  };
  const ctx = { pin: { evidenceRelease: 'snapshot-2026.10.06.4' }, exists: p => p === 'r.json' || p in files, read: p => files[p], roster };
  assert.deepEqual(evidenceCandidateProblems({ state: 'accepted', evidenceCandidate: ec }, ctx), []);
  const forged = { ...ec, acceptance: { ...ec.acceptance, scannerSelection: { ...block, scanners: [...REQUIRED, 'openredaction'] } } };
  assert.match(evidenceCandidateProblems({ state: 'accepted', evidenceCandidate: forged }, ctx).join(), /evidenceCandidate\.acceptance\.scannerSelection\.scanners/);
});

test('the package keeps the owner\'s fields and the authority out of reach, and wires every surface', () => {
  // The accepted record the owner would write keeps every owner field OWNER-TO-SET and records no deployment.
  const record = { schema: 'redact-secret/evidence-adoption/v1', candidate: { evidenceRelease: 'snapshot-2026.10.06.4', manifestDigest: 'm', adoptionKey: 'k' }, evidenceCandidate: { evidenceRelease: 'snapshot-2026.10.07', acceptance: {}, productCandidates: [], replay: controlReplay() } };
  const accepted = acceptedRecord({ record, decision: 'docs/decisions/x.md' });
  assert.deepEqual([accepted.candidate.ownerAcceptance.acceptedBy, accepted.candidate.ownerAcceptance.acceptedOn], ['OWNER-TO-SET', 'OWNER-TO-SET']);
  assert.deepEqual(accepted.candidate.deployment, { staging: null, production: null });
  const source = read('scripts/prepare-acceptance-package.mjs');
  // The authority file is named only to say it is not touched: never opened, read or written by the package.
  assert.doesNotMatch(source, /(readJson|writeJson|readFileSync|writeFileSync|cpSync)\([^)]*qualification-authority/);
  assert.doesNotMatch(source, /acceptedBy: ['"](?!OWNER)/);
  for (const fn of ['packageSelection', 'controlRecordProblems', 'recordedRunProblems', 'archiveProblems', 'derivedInputProblems', 'viewProblems', 'parityProblems', 'acceptanceSelection']) assert.match(source, new RegExp(`\\b${fn}\\(`), `prepare-acceptance-package.mjs calls ${fn}`);
  assert.match(source, /--include-openredaction/);
});
