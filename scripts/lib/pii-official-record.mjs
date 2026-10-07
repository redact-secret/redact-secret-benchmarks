// The committed record of the first official public/synthetic PII execution (#796): where its durable copies are and what must hold for them. A pure reader of
// committed files (no network, no engine): `officialRecordProblems` is the gate (`pii:migration:check`) and the source of the computed
// `official-mode-measurement` criterion of the PII authority record (#666). It records an execution; it accepts no verdict and writes no authority.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { consume, loadPins, parseStrictJson, semanticDigest } from '../../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

export const OFFICIAL_DIR = 'benchmarks/pii-eval-official-run';
export const OFFICIAL_RECORD = `${OFFICIAL_DIR}/record.json`;
export const OFFICIAL_RECEIPT = `${OFFICIAL_DIR}/receipt.json`;
export const OFFICIAL_RECORD_SCHEMA = 'redact-secret-benchmarks.pii-official-run-record/1';
export const OFFICIAL_ARTIFACT = view => `${OFFICIAL_DIR}/${view}.public-synthetic-artifact.json`;
const PINS = 'benchmarks/pii-eval-population-pins.json';
const MIGRATION = 'benchmarks/pii-eval-migration.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HEX64 = /^[0-9a-f]{64}$/;

export const officialRecordExists = (root, exists = existsSync) => exists(join(root, OFFICIAL_RECORD));

/** Problems with the committed official-run record and its durable copies, against the committed pins. Empty when the record is exact. */
export function officialRecordProblems({ root, readText = file => readFileSync(join(root, file)) }) {
  const problems = [];
  const bad = text => { problems.push(text); };
  let record, receipt, pinsText, pins, migration;
  try {
    record = JSON.parse(readText(OFFICIAL_RECORD).toString('utf8'));
    pinsText = readText(PINS).toString('utf8');
    pins = JSON.parse(pinsText);
    migration = JSON.parse(readText(MIGRATION).toString('utf8'));
  } catch (error) { return [`the official-run record cannot be read: ${error.message}`]; }
  if (record.schema !== OFFICIAL_RECORD_SCHEMA) bad('record schema');
  if (record.supportClaims !== false || record.authorityChanged !== false || record.ownerAcceptance !== null) bad('the record claims support, changes authority or carries an owner acceptance');
  const p = record.provenance ?? {};
  if (p.kind !== 'fresh-execution' || p.replay !== false || p.scannersLaunched !== true || p.canonical !== true || p.platform !== 'linux-x64' || p.mode !== 'official') bad('provenance is not a canonical fresh official execution');
  const wf = record.workflow ?? {};
  if (wf.path !== '.github/workflows/pii-official-run.yml' || wf.event !== 'workflow_dispatch' || wf.conclusion !== 'success' || !Number.isSafeInteger(wf.runId) || !/^[0-9a-f]{40}$/.test(wf.headSha ?? '') || wf.runAttempt !== 1) bad('workflow run identity');
  const a = record.actionsArtifact ?? {};
  if (!Number.isSafeInteger(a.id) || a.name !== 'pii-official-run' || !/^sha256:[0-9a-f]{64}$/.test(a.digest ?? '')) bad('Actions artifact identity');
  if (sha256(readText(OFFICIAL_RECEIPT)) !== record.receipt?.sha256) bad('the receipt differs from the record');
  try { receipt = JSON.parse(readText(OFFICIAL_RECEIPT).toString('utf8')); } catch { return [...problems, 'the receipt cannot be read']; }
  if (receipt.schema !== 'redact-secret-benchmarks.pii-official-run/1' || receipt.mode !== 'official' || receipt.supportClaims !== false || receipt.authorityChanged !== false || receipt.ownerAcceptance !== null) bad('receipt claims');
  if (receipt.execution?.kind !== 'fresh-execution' || receipt.execution.replay !== false || receipt.execution.scannersLaunched !== true || receipt.execution.canonical !== true || receipt.execution.platform !== 'linux-x64') bad('receipt provenance');
  if (!receipt.verdict?.allPopulationsRan || !receipt.verdict.noProblems || !receipt.verdict.consumedComplete) bad('the receipt verdict is not clean');
  if (receipt.engine?.matchesPin !== true || receipt.engine.binarySha256 !== pins.build.binarySha256 || receipt.engine.commit !== pins.build.commit) bad('the run did not use the pinned engine');
  const candidate = migration.benchmarkPopulations?.candidate;
  if (receipt.candidate?.sourceCommit !== candidate?.sourceCommit || receipt.candidate?.version !== candidate?.version || receipt.candidate?.recordedArtifactSetCommitment !== candidate?.artifactSetCommitment ||
      receipt.candidate?.equalsRecordedArtifactSetCommitment !== false || !HEX64.test(receipt.candidate?.packageTreeSha256 ?? '') || record.candidate?.packageTreeSha256 !== receipt.candidate?.packageTreeSha256)
    bad('candidate identity');
  if (receipt.scanner?.configurationDigest !== migration.scanner?.configurationDigest || receipt.scanner?.activationDigest !== migration.scanner?.activationDigest) bad('scanner configuration or activation differs from the pinned one');
  const artifacts = [];
  for (const pin of pins.populations) {
    const view = pin.label, item = record.populations?.find(row => row.view === view), got = receipt.populations?.find(row => row.view === view);
    if (!item || !got) { bad(`${view}: not recorded`); continue; }
    let bytes;
    try { bytes = readText(OFFICIAL_ARTIFACT(view)); } catch { bad(`${view}: the durable copy is absent`); continue; }
    let doc;
    try { doc = parseStrictJson(bytes.toString('utf8')); } catch { bad(`${view}: the durable copy is not strict JSON`); continue; }
    if (sha256(bytes) !== item.artifactSha256 || item.artifactSha256 !== got.artifactSha256) bad(`${view}: durable copy bytes differ from the run's artifact`);
    if (doc.semanticDigest !== item.semanticDigest || semanticDigest(doc) !== doc.semanticDigest || item.semanticDigest !== got.artifactSemanticDigest) bad(`${view}: semantic digest`);
    if (pin.artifactDigest !== item.semanticDigest || pin.manifestDigest !== item.manifestDigest || item.manifestDigest !== got.manifestDigest) bad(`${view}: the pin is not this run's artifact and manifest`);
    if (pin.projection?.mode !== 'official' || got.mode !== 'official') bad(`${view}: not pinned in official mode`);
    const scanner = pin.scanners?.[0];
    if (scanner?.artifactDigest !== record.candidate?.packageTreeSha256 || scanner?.product?.candidateDigest !== record.candidate?.packageTreeSha256 || scanner?.product?.kind !== 'candidate') bad(`${view}: the pin does not bind the tree digest of the launched package`);
    const exploratory = migration.benchmarkPopulationDualRun?.artifacts?.find(row => row.view === view);
    if (!exploratory || !pin.retiredArtifactDigests?.includes(exploratory.semanticDigest) || !pin.retiredManifestDigests?.includes(exploratory.manifestDigest)) bad(`${view}: the exploratory replay is not retired by the pin`);
    artifacts.push({ name: `${view}.public-synthetic-artifact.json`, text: bytes.toString('utf8') });
  }
  if (!problems.length) {
    // The real official-mode contract: the production consumer over the committed pins and the committed durable copies.
    try {
      const report = consume(loadPins(pinsText), artifacts);
      if (!report.complete) bad(`the production consumer rejected the durable copies: ${report.rejections.flatMap(row => row.reasons.map(reason => reason.code)).join(',')}`);
      for (const population of report.populations ?? []) {
        const rows = population.productProjection?.rows ?? [];
        if (!rows.length || rows.some(row => row.mode !== 'official')) bad(`${population.label}: a projection row is not official`);
      }
    } catch (error) { bad(`the production consumer failed: ${error.message}`); }
  }
  return problems;
}
