import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { receiptProblems } from '../benchmarks/qualification/receipt-reuse.ts';
import { outputLines, stagesOf } from '../scripts/retry-receipts.mjs';
import {
  buildStageReceipt, incompleteProblem, resolveStage, STAGE_INCOMPLETE_SCHEMA, stageReceiptProblems, stageSources, STAGE_RECEIPT_SCHEMA, writeStageReceipt,
} from '../scripts/stage-receipts.mjs';

const POP = 'public-evidence-snapshot';
const art = (name, expired = false) => ({ name, expired });
const record = () => ({
  schema: 'redact-secret-benchmarks/official-run-record/v1', population: POP, platform: 'linux-x64', engine: { revision: 'abc', protocol: 'p1' },
  evidence: { corpus_digest: 'sha256:cc' }, configHash: 'sha256:cfg', runClass: 'official', artifact: { digest: 'sha256:aa', semanticDigest: 'sha256:ss' },
  determinism: { runs: 2, semanticDigestsEqual: true },
});

test('a stage resolves from the stage artifact, early-plain or the job-end artifact, best first (#762)', () => {
  const all = [art(`official-run-${POP}`), art(`early-plain-${POP}`), art(`stage-plain-${POP}`)];
  assert.deepEqual(resolveStage({ stage: 'plain', population: POP, artifacts: all }).offered.map(s => s.artifact), [`stage-plain-${POP}`, `early-plain-${POP}`, `official-run-${POP}`]);
  // The failed run of #725 left early-plain only: the retry must find it (it printed plain=reuse and then read the missing official-run artifact).
  const early = resolveStage({ stage: 'plain', population: POP, artifacts: [art(`early-plain-${POP}`)] });
  assert.equal(early.verdict, 'reuse');
  assert.deepEqual(early.offered, [{ artifact: `early-plain-${POP}`, subdir: '' }]);
});

test('the methods stage lives in stage-methods or in the methods/ directory of the job-end artifact (#762)', () => {
  assert.deepEqual(stageSources({ stage: 'methods', population: POP }), [
    { artifact: `stage-methods-${POP}`, subdir: '' }, { artifact: `official-run-${POP}`, subdir: 'methods' },
  ]);
  const r = resolveStage({ stage: 'methods', population: POP, artifacts: [art(`early-plain-${POP}`), art(`official-run-${POP}`)] });
  assert.deepEqual(r.offered.map(s => `${s.artifact}/${s.subdir}`), [`official-run-${POP}/methods`]);
});

test('an absent or expired stage is an explicit fresh with the reason, never a silent reuse (#762)', () => {
  const absent = resolveStage({ stage: 'plain', population: POP, artifacts: [art('official-run-other')] });
  assert.equal(absent.verdict, 'fresh');
  assert.match(absent.reason, /no artifact of the earlier run holds the plain stage/);
  assert.match(absent.reason, new RegExp(`stage-plain-${POP}: absent`));
  const expired = resolveStage({ stage: 'plain', population: POP, artifacts: [art(`stage-plain-${POP}`, true)] });
  assert.equal(expired.verdict, 'fresh');
  assert.match(expired.reason, /stage-plain-public-evidence-snapshot: expired/);
});

test('attribution runs and candidate runs resolve their own artifact names (#762)', () => {
  assert.deepEqual(stageSources({ stage: 'plain', population: POP, tag: 'attribution-core-beta.12-', finalPrefix: 'attribution-core-beta.12-' }).map(s => s.artifact),
    [`stage-plain-attribution-core-beta.12-${POP}`, `early-plain-attribution-core-beta.12-${POP}`, `attribution-core-beta.12-${POP}`]);
  assert.equal(stageSources({ stage: 'plain', population: POP, finalPrefix: 'candidate-run-' }).at(-1).artifact, `candidate-run-${POP}`);
  assert.throws(() => stageSources({ stage: 'view', population: POP }), /unknown stage/);
});

test('only the stages a population has are resolved (#762)', () => {
  const registry = { methodsRun: { population: POP } };
  assert.deepEqual(stagesOf(POP, registry), ['plain', 'methods']);
  assert.deepEqual(stagesOf('regression-corpus', registry), ['plain']);
});

test('the retry offers the downloaded sources, in order, as directories the driver reads whole (#762)', () => {
  const resolutions = [
    resolveStage({ stage: 'plain', population: POP, artifacts: [art(`early-plain-${POP}`), art(`official-run-${POP}`)] }),
    resolveStage({ stage: 'methods', population: POP, artifacts: [art(`official-run-${POP}`)] }),
  ];
  const downloaded = new Map([[`early-plain-${POP}`, `in/early-plain-${POP}`], [`official-run-${POP}`, `in/official-run-${POP}`]]);
  assert.deepEqual(outputLines(resolutions, downloaded), [
    'plain=reuse', `plain_dirs=in/early-plain-${POP},in/official-run-${POP}`, 'methods=reuse', `methods_dirs=in/official-run-${POP}/methods`,
  ]);
  // A source that could not be downloaded is not offered; with none left the stage measures fresh.
  assert.deepEqual(outputLines(resolutions, new Map()), ['plain=fresh', 'plain_dirs=', 'methods=fresh', 'methods_dirs=']);
});

test('the stage receipt names stage, population, identity and the digests of its bytes (#762)', () => {
  const receipt = buildStageReceipt({ stage: 'plain', record: record(), artifactSha256: 'sha256:aa', recordSha256: 'sha256:rr', runId: 123 });
  assert.equal(receipt.schema, STAGE_RECEIPT_SCHEMA);
  assert.deepEqual([receipt.stage, receipt.population, receipt.status], ['plain', POP, 'complete']);
  assert.deepEqual(receipt.identity, {
    engineRevision: 'abc', protocol: 'p1', evidenceCorpusDigest: 'sha256:cc', configHash: 'sha256:cfg', runClass: 'official', candidateId: null, attributionId: null, evidenceTag: null, methods: [],
  });
  assert.deepEqual(receipt.digests, { artifact: 'sha256:aa', runRecord: 'sha256:rr', semantic: 'sha256:ss' });
  assert.equal(receipt.reusedFrom, null);
  const reused = buildStageReceipt({ stage: 'plain', record: { ...record(), receiptReuse: { reused: true, source: `early-plain-${POP}` } }, artifactSha256: 'a', recordSha256: 'r', runId: 9 });
  assert.equal(reused.reusedFrom, `early-plain-${POP}`);
  assert.throws(() => buildStageReceipt({ stage: 'plain', record: { schema: 'x' }, artifactSha256: 'a', recordSha256: 'r', runId: 1 }), /no official run record/);
});

test('every difference of stage, population, bytes or engine makes a stage receipt unusable (#762)', () => {
  const want = { stage: 'plain', population: POP, artifactSha256: 'sha256:aa', recordSha256: 'sha256:rr', engineRevision: 'abc' };
  const good = buildStageReceipt({ stage: 'plain', record: record(), artifactSha256: 'sha256:aa', recordSha256: 'sha256:rr', runId: 1 });
  assert.deepEqual(stageReceiptProblems(good, want), []);
  const cases = [
    [{ ...want, stage: 'methods' }, /plain stage, this is the methods stage/],
    [{ ...want, population: 'regression-corpus' }, /is of public-evidence-snapshot, not regression-corpus/],
    [{ ...want, artifactSha256: 'sha256:zz' }, /artifact\.json does not match/],
    [{ ...want, recordSha256: 'sha256:zz' }, /run-record\.json does not match/],
    [{ ...want, engineRevision: 'def' }, /engine abc, this run uses def/],
  ];
  for (const [w, expected] of cases) assert.ok(stageReceiptProblems(good, w).some(p => expected.test(p)), String(expected));
  assert.deepEqual(stageReceiptProblems(null, want), ['the directory has no stage receipt']);
  assert.ok(stageReceiptProblems({ ...good, status: 'incomplete' }, want).some(p => /not complete/.test(p)));
});

test('identity never mixes: the same receipt of another engine, config or evidence release is refused by the run-record check (#762)', () => {
  const wantRun = { population: POP, platform: 'linux-x64', methods: false, engineRevision: 'abc', runs: 2, candidateId: null, attributionId: null, evidenceTag: null };
  assert.deepEqual(receiptProblems(record(), 'sha256:aa', wantRun), []);
  assert.ok(receiptProblems(record(), 'sha256:aa', { ...wantRun, engineRevision: 'next' }).some(p => /engine abc/.test(p)));
  assert.ok(receiptProblems({ ...record(), evidenceOverride: { tag: 'snapshot-2026.10.04.3' } }, 'sha256:aa', wantRun).some(p => /evidence release/.test(p)));
});

test('a directory marked INCOMPLETE is never reused, with the reason in the log (#762)', () => {
  assert.equal(incompleteProblem(null), null);
  const problem = incompleteProblem({ schema: STAGE_INCOMPLETE_SCHEMA, status: 'incomplete', reason: 'engine output finished; verification not completed' });
  assert.match(problem, /INCOMPLETE/);
  assert.match(problem, /never reused/);
});

test('writing a receipt hashes the bytes beside it (#762)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'stage-receipt-'));
  writeFileSync(path.join(dir, 'artifact.json'), '{"a":1}');
  writeFileSync(path.join(dir, 'run-record.json'), JSON.stringify(record()));
  const receipt = writeStageReceipt({ stage: 'plain', dir, runId: '77' });
  const onDisk = JSON.parse(readFileSync(path.join(dir, 'stage-receipt.json'), 'utf8'));
  assert.deepEqual(onDisk, receipt);
  assert.match(onDisk.digests.artifact, /^sha256:[0-9a-f]{64}$/);
  assert.equal(onDisk.measuredInRun, '77');
  const want = { stage: 'plain', population: POP, artifactSha256: onDisk.digests.artifact, recordSha256: onDisk.digests.runRecord, engineRevision: 'abc' };
  assert.deepEqual(stageReceiptProblems(onDisk, want), []);
});

test('the workflow uploads every finished stage at once, keeps the output of a failed post-step and rehearses on the cheap populations only (#762)', async () => {
  const yml = (await readFile('.github/workflows/official-runs.yml')).replace(/^\s*#.*$/gm, '');
  assert.match(yml, /name: stage-plain-/);
  assert.match(yml, /name: stage-methods-/);
  assert.match(yml, /scripts\/stage-receipts\.mjs write --stage plain/);
  assert.match(yml, /scripts\/stage-receipts\.mjs write --stage methods/);
  assert.match(yml, /scripts\/retry-receipts\.mjs --run "\$RETRY_RUN_ID" --population "\$POPULATION" --out receipts-in/);
  assert.ok(!/early-plain-\$\{\{ inputs\.attribution/.test(yml), 'early-plain is read by the retry, no longer written');
  // the final upload survives a cancel or a failed post-step, and an unsuccessful job may have nothing to upload
  assert.match(yml, /if: \$\{\{ always\(\) \}\}[^\n]*\n\s+with:\n\s+name: \$\{\{ inputs\.mode == 'diagnostic'/);
  assert.match(yml, /if-no-files-found: \$\{\{ job\.status == 'success' && 'error' \|\| 'ignore' \}\}/);
  assert.match(yml, /INCOMPLETE/);
  assert.match(yml, /\^\(regression-corpus\|policy-corpus\)\(,\(regression-corpus\|policy-corpus\)\)\?\$/, 'a rehearsal never names the public population');
  assert.match(yml, /needs\.plan\.outputs\.rehearsal != 'true'/, 'a rehearsal builds no qualification view');
  assert.match(yml, /rehearse_post_step_failure needs populations/);
});

test('the driver checks every offered source whole, marks a finished-but-unverified stage INCOMPLETE and clears the marker on success (#762)', async () => {
  const driver = await readFile('scripts/run-official-credential-eval.ts');
  assert.match(driver, /reuseReceipt\.split\(','\)/);
  assert.match(driver, /receipt source \$\{source\} not usable/);
  assert.match(driver, /stageReceiptProblems\(receipt/);
  assert.match(driver, /writeMarker\('engine output finished; verification not completed'\)/);
  assert.match(driver, /incomplete\?\.\(message\)/, 'a refusal after the engine finished updates the marker');
  assert.match(driver, /rmSync\(markerFile/, 'a verified stage carries no marker');
});

async function readFile(file) { return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); }

test('a receipt of another scanner set is another measurement: with and without an optional scanner never mix (#763)', () => {
  const wantRun = { population: POP, platform: 'linux-x64', methods: false, engineRevision: 'abc', runs: 2, candidateId: null, attributionId: null, evidenceTag: null };
  const withOpt = { ...record(), scanners: [{ id: 'gitleaks' }, { id: 'openredaction' }, { id: 'redact-secret' }] };
  assert.deepEqual(receiptProblems(withOpt, 'sha256:aa', { ...wantRun, scannerIds: ['redact-secret', 'openredaction', 'gitleaks'] }), []);
  assert.ok(receiptProblems(withOpt, 'sha256:aa', { ...wantRun, scannerIds: ['gitleaks', 'redact-secret'] }).some(p => /measured the scanners gitleaks,openredaction,redact-secret, this run measures gitleaks,redact-secret/.test(p)));
  assert.ok(receiptProblems({ ...record(), scanners: [{ id: 'gitleaks' }] }, 'sha256:aa', { ...wantRun, scannerIds: ['gitleaks', 'openredaction'] }).length > 0);
});

test('the driver and the workflow leave an optional scanner out only on request, refuse a required one and a pinned engine without the configuration (#763)', async () => {
  const driver = await readFile('scripts/run-official-credential-eval.ts');
  assert.match(driver, /--omit-optional \$\{omitOptional\}: not an optional scanner of the official run class/);
  assert.match(driver, /engine release pending, #763/);
  assert.match(driver, /omittedOptionalScanners: \[omitOptional\]/);
  assert.match(driver, /scannerIds: selectedScanners/, 'a receipt is checked against the scanner set of this stage');
  const yml = (await readFile('.github/workflows/official-runs.yml')).replace(/^\s*#.*$/gm, '');
  assert.match(yml, /omit_optional:/);
  assert.match(yml, /--omit-optional "\$OMIT_OPTIONAL"/);
  assert.match(yml, /omit_optional is exclusive with diagnostic mode and attribution/);
  assert.doesNotMatch(driver, /not an attribution or candidate run/, 'a candidate replay may omit the optional scanner its control omitted');
  assert.match(driver, /--omit-optional is for the accepted official run and a candidate replay, not an attribution run/);
});
