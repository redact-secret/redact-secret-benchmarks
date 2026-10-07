#!/usr/bin/env node
// Write the pii-eval inputs of the four frozen benchmark populations (#664). Deterministic: the same repository state
// gives the same bytes. See scripts/lib/pii-population-conversion.mjs for the mapping rules.
//
//   node --import tsx scripts/convert-pii-populations.mjs --out=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildConversion, census, manifestFor, observationFor, oracleInput, rosterFor, snapshotFor } from './lib/pii-population-conversion.mjs';

export const json = value => `${JSON.stringify(value, null, 1)}\n`;

/**
 * `candidateDigest` is for a fresh execution only (#796): the manifest binds the scanner identity, and a run's candidate digest is the tree digest of the
 * package it launches, not the artifact-set commitment of the frozen observation (the two are different quantities; docs/specs/pii-official-execution-plan.md).
 * It replaces the candidate identity in the manifest and the observation set; the snapshot, roster and every case are unchanged.
 */
export function writeConversion(outDir, { candidateDigest } = {}) {
  const ctx = buildConversion();
  if (candidateDigest !== undefined) {
    if (!/^[0-9a-f]{64}$/.test(candidateDigest)) throw new Error('candidateDigest must be a sha256');
    ctx.candidate = { ...ctx.candidate, artifactSetCommitment: candidateDigest };
  }
  const summary = [];
  for (const bucket of ctx.populations) {
    const dir = join(outDir, bucket.view);
    mkdirSync(dir, { recursive: true });
    const snapshot = snapshotFor(bucket, ctx);
    const manifest = manifestFor(snapshot, ctx);
    const observation = observationFor(bucket, snapshot, ctx);
    const files = {
      'parity-input.json': oracleInput(bucket), 'snapshot.json': snapshot, 'manifest.json': manifest, 'observation.json': observation,
      'projection-roster.json': rosterFor(bucket), 'census.json': { ...census(bucket), excluded: bucket.excluded },
    };
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), json(body));
    summary.push({ view: bucket.view, snapshotDigest: snapshot.semanticDigest, manifestDigest: manifest.semanticDigest, observationDigest: observation.semanticDigest, ...census(bucket) });
  }
  return { ctx, summary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
  if (!out) { console.error('usage: convert-pii-populations.mjs --out=<dir>'); process.exit(2); }
  const { summary } = writeConversion(resolve(out));
  for (const row of summary) console.log(`${row.view}: ${row.convertedCases}/${row.benchmarkCases} cases, ${row.excludedCases} not representable, snapshot ${row.snapshotDigest}`);
}
