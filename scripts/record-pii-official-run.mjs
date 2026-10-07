#!/usr/bin/env node
// Record one official public/synthetic PII execution (#796) in the repository: the durable public copies of its artifacts, its receipt, the record that binds them to the
// workflow run, and the consumer pins the four populations are read under. Everything is read from the run (GitHub's own record of it and the artifact it uploaded), nothing is typed:
//
//   node --import tsx scripts/record-pii-official-run.mjs --run-id=<id> [--from=<dir of the downloaded pii-official-run artifact>] [--write]
//
// It refuses a run that is not a successful, first-attempt `workflow_dispatch` of `.github/workflows/pii-official-run.yml` on `develop`, an artifact whose archive does not equal the
// digest GitHub recorded at upload, a receipt that is not a clean canonical fresh execution with the pinned engine, and artifacts the production consumer rejects under the derived pins.
// It records an execution, not a verdict: no threshold, status, authority record, `new.authorisation` or owner acceptance is written, and the exploratory replays
// stay committed as the oracle parity evidence (the pins retire their digests, as any repin does). `officialRecordProblems` is the gate that holds the result (`pii:migration:check`).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { consume, loadPins, parseStrictJson, semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import { OFFICIAL_ARTIFACT, OFFICIAL_DIR, OFFICIAL_RECEIPT, OFFICIAL_RECORD, OFFICIAL_RECORD_SCHEMA, officialRecordProblems } from './lib/pii-official-record.mjs';
import { ROOT } from './lib/pii-population-conversion.mjs';
import { deriveOfficialPins } from './run-pii-official.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gh = (args, options = {}) => execFileSync('gh', args, { encoding: options.buffer ? 'buffer' : 'utf8', maxBuffer: 1 << 28 });
const ghJson = endpoint => JSON.parse(gh(['api', endpoint]));
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
const text = value => `${JSON.stringify(value, null, 2)}\n`;

function fail(message) { console.error(`record-pii-official-run: ${message}`); process.exit(1); }

const runId = arg('run-id');
if (!/^[0-9]+$/.test(runId ?? '')) fail('--run-id=<numeric run id> is required');
const write = process.argv.includes('--write');

const run = ghJson(`repos/${REPOSITORY}/actions/runs/${runId}`);
if (run.path !== '.github/workflows/pii-official-run.yml' || run.event !== 'workflow_dispatch' || run.status !== 'completed' || run.conclusion !== 'success' || run.run_attempt !== 1 || run.head_branch !== 'develop' || run.repository?.full_name !== REPOSITORY)
  fail(`run ${runId} is not a successful first-attempt dispatch of pii-official-run.yml on develop (${run.path} ${run.event} ${run.status}/${run.conclusion} attempt ${run.run_attempt} on ${run.head_branch})`);
const listing = ghJson(`repos/${REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`);
const artifact = listing.artifacts.find(item => item.name === 'pii-official-run');
if (!artifact || artifact.expired || listing.artifacts.filter(item => item.name === 'pii-official-run').length !== 1) fail('the run has no single unexpired pii-official-run artifact');

let dir = arg('from') && resolve(arg('from'));
if (!dir) {
  const zip = gh(['api', `repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`], { buffer: true });
  if (`sha256:${sha256(zip)}` !== artifact.digest) fail(`the downloaded archive is ${sha256(zip)}, GitHub recorded ${artifact.digest}`);
  dir = mkdtempSync(join(tmpdir(), 'pii-official-run-'));
  writeFileSync(join(dir, 'archive.zip'), zip);
  execFileSync('unzip', ['-q', join(dir, 'archive.zip'), '-d', dir]);
}
const readText = file => readFileSync(join(dir, file));
const receiptBytes = readText('receipt.json');
const receipt = JSON.parse(receiptBytes.toString('utf8'));
const pinsPath = join(ROOT, 'benchmarks/pii-eval-population-pins.json');
let pins = JSON.parse(readFileSync(pinsPath, 'utf8'));
const migration = JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-eval-migration.json'), 'utf8'));
const plan = JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-eval-official-execution-plan.json'), 'utf8'));

if (!receipt.verdict?.allPopulationsRan || !receipt.verdict.noProblems || !receipt.verdict.consumedComplete) fail('the receipt verdict is not clean');
if (receipt.execution?.kind !== 'fresh-execution' || receipt.execution.canonical !== true || receipt.execution.platform !== 'linux-x64' || receipt.execution.replay !== false || receipt.execution.scannersLaunched !== true) fail('the receipt is not a canonical fresh execution');
if (receipt.engine?.matchesPin !== true || receipt.engine.binarySha256 !== pins.build.binarySha256) fail('the run did not use the pinned engine binary');
if (receipt.candidate.sourceCommit !== plan.candidate.sourceCommit || receipt.candidate.version !== plan.candidate.version) fail('the run measured another candidate than the plan names');
if (run.head_sha !== arg('head-sha') && arg('head-sha')) fail('--head-sha differs from the run');

const populations = [], artifacts = [];
for (const planned of plan.populations) {
  const got = receipt.populations.find(item => item.view === planned.view);
  if (!got || got.problems.length || got.exit !== 0 || got.mode !== 'official') fail(`${planned.view}: the receipt does not hold a clean official run`);
  const bytes = readText(`out/${planned.view}/public-synthetic-artifact.json`);
  if (sha256(bytes) !== got.artifactSha256) fail(`${planned.view}: the artifact is not the bytes the run recorded`);
  const doc = parseStrictJson(bytes.toString('utf8'));
  if (semanticDigest(doc) !== doc.semanticDigest || doc.semanticDigest !== got.artifactSemanticDigest) fail(`${planned.view}: semantic digest`);
  populations.push({ view: planned.view, populationId: planned.populationId, memberships: planned.memberships, path: OFFICIAL_ARTIFACT(planned.view), artifactSha256: got.artifactSha256, semanticDigest: doc.semanticDigest,
    snapshotDigest: got.snapshotDigest, manifestDigest: got.manifestDigest, rosterDigest: got.rosterDigest, mode: 'official', scannerReplays: got.scannerReplays });
  artifacts.push({ name: `${planned.view}.public-synthetic-artifact.json`, text: bytes.toString('utf8'), bytes });
  pins = deriveOfficialPins(pins, { view: planned.view, artifactDigest: doc.semanticDigest, manifestDigest: got.manifestDigest, candidateDigest: receipt.candidate.packageTreeSha256 });
}
pins.requireComplete = true;
const report = consume(loadPins(JSON.stringify(pins)), artifacts);
if (!report.complete) fail(`the production consumer rejects the artifacts under the derived pins: ${report.rejections.flatMap(row => row.reasons.map(reason => reason.code)).join(',')}`);

const record = {
  schema: OFFICIAL_RECORD_SCHEMA, issue: `${REPOSITORY}#796`, supportClaims: false, authorityChanged: false, ownerAcceptance: null,
  note: 'The record of one official public/synthetic execution (evidence). It accepts no verdict: PII authority stays legacy and owner-accepted-verdict is the owner\'s. Written by scripts/record-pii-official-run.mjs from the run; the durable copies are committed beside the Actions artifact, which expires.',
  provenance: { kind: 'fresh-execution', replay: false, scannersLaunched: true, canonical: true, platform: 'linux-x64', mode: 'official', runClass: 'public-synthetic', node: receipt.execution.node,
    detail: 'pii-eval run --config, mode official, the pinned linux engine binary, the product commit\'s own qualified candidate package; the replays of the frozen observation (benchmarks/pii-eval-population-dual-run/) are exploratory and were not launched.' },
  workflow: { path: run.path, runId: run.id, runAttempt: run.run_attempt, event: run.event, headBranch: run.head_branch, headSha: run.head_sha, conclusion: run.conclusion, url: run.html_url, createdAt: run.created_at, updatedAt: run.updated_at },
  attempts: { dispatches: 1, note: 'The one dispatch the owner approved (2026-10-06, #796); it succeeded at the first attempt, so no fix or second dispatch was needed.' },
  actionsArtifact: { id: artifact.id, name: artifact.name, digest: artifact.digest, sizeInBytes: artifact.size_in_bytes, expiresAt: artifact.expires_at, role: 'transport only; it expires, and the copies committed here are the durable ones (no new storage system, #785)' },
  engine: { commit: receipt.engine.commit, binarySha256: receipt.engine.binarySha256, shimSha256: receipt.engine.shimSha256 },
  candidate: { version: receipt.candidate.version, sourceCommit: receipt.candidate.sourceCommit, packageTreeSha256: receipt.candidate.packageTreeSha256, addonTreeSha256: receipt.candidate.addonTreeSha256,
    recordedArtifactSetCommitment: receipt.candidate.recordedArtifactSetCommitment, equalsRecordedArtifactSetCommitment: false, qualificationRunId: plan.candidate.build.qualificationRunId },
  receipt: { path: OFFICIAL_RECEIPT, sha256: sha256(receiptBytes) },
  populations,
};

if (!write) { console.log(text(record)); console.log('(dry run: nothing written; add --write)'); process.exit(0); }
mkdirSync(join(ROOT, OFFICIAL_DIR), { recursive: true });
for (const item of artifacts) writeFileSync(join(ROOT, OFFICIAL_ARTIFACT(item.name.replace('.public-synthetic-artifact.json', ''))), item.bytes);
writeFileSync(join(ROOT, OFFICIAL_RECEIPT), receiptBytes);
writeFileSync(join(ROOT, OFFICIAL_RECORD), text(record));
writeFileSync(pinsPath, text(pins));
const problems = officialRecordProblems({ root: ROOT });
if (problems.length) fail(`the written record does not hold:\n- ${problems.join('\n- ')}`);
console.log(`recorded run ${runId}: ${populations.length} official artifacts, pins re-derived (head digests, retired exploratory ones, mode official, tree digest ${record.candidate.packageTreeSha256.slice(0, 12)}…)`);
