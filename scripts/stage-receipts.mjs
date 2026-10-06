#!/usr/bin/env node
/**
 * Stage receipts for official runs (#762): each completed stage (plain, methods) of one population is exposed as its own artifact the moment it ends, with a
 * receipt that names the stage, the population and the identity of what was measured, and the digests of its bytes. A retry resolves a stage from any artifact
 * that holds such a result and reuses it only on an IDENTICAL identity (the driver checks every candidate whole, never mixing identities).
 *
 *   node scripts/stage-receipts.mjs write --stage plain|methods --dir <stage output dir> --run-id <id> [--reused-from <source>]
 *
 * Pure functions (no I/O) are exported for the tests; the CLI only reads the stage directory and writes `stage-receipt.json` beside the artifact.
 * A stage that ended without a verified artifact carries `stage-incomplete.json` instead (written by the driver); a directory with that marker is never
 * a receipt. This is evidence and plumbing: it asserts no measured value.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STAGE_RECEIPT_SCHEMA = 'redact-secret-benchmarks/stage-receipt/v1';
export const STAGE_INCOMPLETE_SCHEMA = 'redact-secret-benchmarks/stage-incomplete/v1';
export const STAGE_RECEIPT_FILE = 'stage-receipt.json';
export const STAGE_INCOMPLETE_FILE = 'stage-incomplete.json';
export const STAGES = ['plain', 'methods'];

const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/**
 * The artifacts that may hold a stage, best first. `tag` is '' for an official run and `attribution-<id>-` for an attribution run; `finalPrefix` is the
 * prefix of the job-end artifact (`official-run-`, `attribution-<id>-`, `candidate-run-`). Each source says where the stage's files are inside the artifact.
 */
export function stageSources({ stage, population, tag = '', finalPrefix = 'official-run-' }) {
  if (stage === 'plain') {
    return [
      { artifact: `stage-plain-${tag}${population}`, subdir: '' },
      { artifact: `early-plain-${tag}${population}`, subdir: '' },
      { artifact: `${finalPrefix}${population}`, subdir: '' },
    ];
  }
  if (stage === 'methods') {
    return [
      { artifact: `stage-methods-${tag}${population}`, subdir: '' },
      { artifact: `${finalPrefix}${population}`, subdir: 'methods' },
    ];
  }
  throw new Error(`unknown stage ${stage}`);
}

/**
 * Which artifacts of the earlier run are offered to the driver for a stage: the sources that exist and have not expired, in order. An empty list is an
 * explicit 'fresh' with the reason, never a silent one.
 * @param artifacts [{ name, expired }] as the Actions API lists the earlier run's artifacts
 */
export function resolveStage({ stage, population, artifacts, tag = '', finalPrefix = 'official-run-' }) {
  const byName = new Map(artifacts.map(a => [a.name, a]));
  const offered = [];
  const skipped = [];
  for (const source of stageSources({ stage, population, tag, finalPrefix })) {
    const found = byName.get(source.artifact);
    if (!found) skipped.push(`${source.artifact}: absent`);
    else if (found.expired) skipped.push(`${source.artifact}: expired`);
    else offered.push(source);
  }
  return offered.length
    ? { stage, verdict: 'reuse', offered, skipped }
    : { stage, verdict: 'fresh', offered, skipped, reason: `no artifact of the earlier run holds the ${stage} stage (${skipped.join('; ')})` };
}

/** The receipt of a completed stage, from its verified run record and the digests of the bytes beside it. */
export function buildStageReceipt({ stage, record, artifactSha256, recordSha256, runId, reusedFrom = null }) {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage ${stage}`);
  if (!record || record.schema !== 'redact-secret-benchmarks/official-run-record/v1') throw new Error('the stage has no official run record');
  return {
    schema: STAGE_RECEIPT_SCHEMA,
    status: 'complete',
    stage,
    population: record.population,
    platform: record.platform,
    identity: {
      engineRevision: record.engine?.revision ?? null,
      protocol: record.engine?.protocol ?? null,
      evidenceCorpusDigest: record.evidence?.corpus_digest ?? null,
      configHash: record.configHash ?? null,
      runClass: record.runClass ?? null,
      candidateId: record.productCandidate?.id ?? null,
      attributionId: record.attribution?.id ?? null,
      evidenceTag: record.evidenceOverride?.tag ?? null,
      methods: stage === 'methods' ? [...(record.methods ?? [])].sort() : [],
    },
    digests: { artifact: artifactSha256, runRecord: recordSha256, semantic: record.artifact?.semanticDigest ?? null },
    determinism: { runs: record.determinism?.runs ?? 0, semanticDigestsEqual: record.determinism?.semanticDigestsEqual === true },
    measuredInRun: String(runId),
    reusedFrom: reusedFrom ?? (record.receiptReuse?.reused ? (record.receiptReuse.source ?? 'earlier receipt') : null),
  };
}

/**
 * Problems that make a receipt unusable for `want` (empty = identical identity). The driver also runs the run-record identity checks and the pin binding;
 * this is the receipt's own: the right stage and population, the bytes it names, and an identity equal to the record beside it.
 */
export function stageReceiptProblems(receipt, want) {
  const problems = [];
  if (!receipt || receipt.schema !== STAGE_RECEIPT_SCHEMA) return ['the directory has no stage receipt'];
  if (receipt.status !== 'complete') problems.push(`the stage receipt is ${receipt.status}, not complete`);
  if (receipt.stage !== want.stage) problems.push(`the receipt is of the ${receipt.stage} stage, this is the ${want.stage} stage`);
  if (receipt.population !== want.population) problems.push(`the receipt is of ${receipt.population}, not ${want.population}`);
  if (receipt.digests?.artifact !== want.artifactSha256) problems.push('artifact.json does not match the digest the stage receipt names');
  if (receipt.digests?.runRecord !== want.recordSha256) problems.push('run-record.json does not match the digest the stage receipt names');
  if (receipt.identity?.engineRevision !== want.engineRevision) problems.push(`the receipt names engine ${receipt.identity?.engineRevision}, this run uses ${want.engineRevision}`);
  return problems;
}

/** A directory that carries the incomplete marker is never reused, whatever else it holds. */
export function incompleteProblem(marker) {
  if (!marker) return null;
  return `the stage is marked INCOMPLETE (${marker.reason ?? 'verification did not finish'}); its engine output is kept as evidence but never reused`;
}

export function readJsonIfPresent(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function writeStageReceipt({ stage, dir, runId, reusedFrom = null }) {
  const record = JSON.parse(readFileSync(path.join(dir, 'run-record.json'), 'utf8'));
  const receipt = buildStageReceipt({
    stage, record, runId, reusedFrom,
    artifactSha256: sha256(readFileSync(path.join(dir, 'artifact.json'))),
    recordSha256: sha256(readFileSync(path.join(dir, 'run-record.json'))),
  });
  writeFileSync(path.join(dir, STAGE_RECEIPT_FILE), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  if (command !== 'write') throw new Error('Usage: stage-receipts write --stage plain|methods --dir <dir> --run-id <id> [--reused-from <source>]');
  const stage = value('--stage'), dir = value('--dir'), runId = value('--run-id');
  if (!STAGES.includes(stage) || !dir || !/^\d+$/.test(runId ?? '')) throw new Error('Usage: stage-receipts write --stage plain|methods --dir <dir> --run-id <id>');
  const receipt = writeStageReceipt({ stage, dir, runId, reusedFrom: args.includes('--reused-from') ? value('--reused-from') : null });
  console.log(`stage receipt written: ${receipt.stage} ${receipt.population} engine ${receipt.identity.engineRevision} artifact ${receipt.digests.artifact}`);
}
