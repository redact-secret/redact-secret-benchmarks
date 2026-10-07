#!/usr/bin/env node
// Replay the four frozen benchmark PII populations (#664) with a given pii-eval engine binary and compare each produced
// public-synthetic artifact with the committed one (#665 linux replay). The committed artifacts were built by a local darwin
// engine; the canonical engine is the linux CI artifact pinned in benchmarks/pii-eval-population-pins.json. The semantic
// digest is host independent by contract; this is the check that says so for these inputs.
//
//   node --import tsx scripts/replay-pii-populations.mjs --engine=<pii-eval binary> [--out=<dir>] [--receipt=<file>]
//
// It launches no scanner (the frozen Beta.13 observation is replayed), reads no secret, writes no committed file and sets
// no threshold, tolerance, status or authority. A difference is never normalised: the exit code is 1 and the receipt names
// the population and both digests. A run on a binary other than the pinned one, or off linux-x64, is a verification and the
// receipt says so (`canonical: false`).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeConversion } from './convert-pii-populations.mjs';
import { ROOT, VIEWS, semanticDigest } from './lib/pii-population-conversion.mjs';

export const RECEIPT_SCHEMA = 'redact-secret-benchmarks.pii-population-engine-replay/1';
const PINS_FILE = 'benchmarks/pii-eval-population-pins.json';
const RECORD_DIR = 'benchmarks/pii-eval-population-dual-run';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

function replayOnce(binary, dir, out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(dirname(out), { recursive: true });
  const result = spawnSync(binary, ['replay', '--snapshot', join(dir, 'snapshot.json'), '--manifest', join(dir, 'manifest.json'), '--observation', join(dir, 'observation.json'),
    '--out', out, '--projection-roster', join(dir, 'projection-roster.json'), '--projection-mode', 'exploratory'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (result.status !== 0) throw new Error(`replay failed (exit ${result.status}): ${String(result.stderr).slice(0, 400)}`);
  const summary = JSON.parse(result.stdout.split('\n')[0]);
  if (summary.state !== 'replayed' || summary.semantic?.scannersLaunched !== 0) throw new Error('replay did not replay a frozen observation without launching a scanner');
  return readFileSync(join(out, 'public-synthetic-artifact.json'));
}

/** Replay every population `replays` times and compare with the committed artifacts. Pure of the network and of secrets. */
export function replayPopulations({ engine, work, root = ROOT, replays = 2 }) {
  const pins = readJson(join(root, PINS_FILE));
  const migration = readJson(join(root, 'benchmarks/pii-eval-migration.json'));
  const binarySha256 = sha256(readFileSync(engine));
  const { summary } = writeConversion(join(work, 'conv'));
  const populations = VIEWS.map(view => {
    const committedBytes = readFileSync(join(root, RECORD_DIR, `${view}.public-synthetic-artifact.json`));
    const committed = JSON.parse(committedBytes.toString('utf8'));
    const pin = pins.populations.find(row => row.label === view);
    const recorded = migration.benchmarkPopulationDualRun.artifacts.find(row => row.view === view);
    const dir = join(work, 'conv', view);
    const runs = Array.from({ length: replays }, (_, i) => replayOnce(engine, dir, join(work, 'out', view, `run${i + 1}`)));
    const replayed = JSON.parse(runs[0].toString('utf8'));
    const recomputed = semanticDigest(replayed);
    const pinnedDigest = pin && [pin.artifactDigest, ...(pin.retiredArtifactDigests ?? [])].includes(replayed.semanticDigest) ? replayed.semanticDigest : null;
    return {
      view,
      replays,
      semanticDigestCommitted: committed.semanticDigest,
      // The replay is pinned when its digest is the head of the population pin or a digest the pin retired (after an official run is recorded the head is that run's artifact).
      semanticDigestPinned: pinnedDigest,
      semanticDigestReplayed: replayed.semanticDigest,
      semanticDigestRecomputed: recomputed === replayed.semanticDigest,
      equalSemanticDigest: recomputed === replayed.semanticDigest && replayed.semanticDigest === committed.semanticDigest && pinnedDigest !== null && replayed.semanticDigest === recorded?.semanticDigest,
      replaysByteIdentical: new Set(runs.map(sha256)).size === 1,
      bytesEqualCommitted: sha256(runs[0]) === sha256(committedBytes),
      artifactSha256Committed: sha256(committedBytes),
      artifactSha256Replayed: sha256(runs[0]),
      conversionSnapshotDigest: summary.find(row => row.view === view)?.snapshotDigest ?? null,
    };
  });
  const platform = `${process.platform}-${process.arch}`;
  const matchesPin = binarySha256 === pins.build.binarySha256;
  const verdict = {
    populations: populations.length,
    allEqualSemanticDigest: populations.every(p => p.equalSemanticDigest && p.semanticDigestRecomputed),
    allReplaysByteIdentical: populations.every(p => p.replaysByteIdentical),
    allBytesEqualCommitted: populations.every(p => p.bytesEqualCommitted),
  };
  return {
    schema: RECEIPT_SCHEMA, supportClaims: false, authorityChanged: false, mode: 'exploratory', scannersLaunched: 0,
    engine: { commit: pins.build.commit, cargoLockSha256: pins.build.cargoLockSha256, binarySha256, pinnedBinarySha256: pins.build.binarySha256, matchesPin, platform },
    canonical: matchesPin && platform === 'linux-x64',
    committedArtifactsBuiltOn: 'darwin-arm64 local verification build of the same commit',
    populations, verdict,
  };
}

export function main(argv) {
  const arg = name => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const engine = arg('engine');
  if (!engine) { console.error('usage: replay-pii-populations.mjs --engine=<pii-eval binary> [--out=<dir>] [--receipt=<file>]'); process.exit(2); }
  const work = resolve(arg('out') ?? mkdtempSync(join(tmpdir(), 'pii-replay-')));
  mkdirSync(work, { recursive: true });
  const receipt = replayPopulations({ engine: resolve(engine), work });
  const text = `${JSON.stringify(receipt, null, 1)}\n`;
  if (arg('receipt')) writeFileSync(resolve(arg('receipt')), text);
  process.stdout.write(text);
  const ok = receipt.verdict.allEqualSemanticDigest && receipt.verdict.allReplaysByteIdentical;
  if (!ok) { console.error('the replayed semantic digests differ from the committed artifacts or the replays differ from each other'); process.exitCode = 1; }
  return receipt;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
