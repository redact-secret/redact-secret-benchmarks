#!/usr/bin/env node
// Action-split false-alarm summary for the untargeted `real-world-shapes` corpus (#378).
//
// Reads one or two `npm run bench -- --category=real-world-shapes` reports — the
// published package (baseline) and, optionally, a candidate build — and prints,
// per scanner and per subset (frozen baseline subset, later additions, full
// corpus), how many controls were flagged at all and how many carried a
// `redact`/`block` (gating) versus only a `warn` finding. It reuses the split the
// Workbench method page draws (docs/decisions/2026-09-21-add-untargeted-benign-corpus.md,
// Decision 3): `warn` is visible and non-gating; `falseAlarmRate` is not redefined.
// Fixture ids and action tallies only — never matched text.
//
//   node --import tsx scripts/report-untargeted-action-split.mjs \
//     --baseline <published real-world-shapes.json> [--candidate <candidate real-world-shapes.json>] \
//     [--frozen fixtures/real-world-shapes/frozen-baseline-v1.json] [--output <summary.json>]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeActionSplit, compareActionSplit } from '../benchmarks/lib/untargeted-action-split.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'node --import tsx scripts/report-untargeted-action-split.mjs --baseline <report.json> [--candidate <report.json>] [--frozen <manifest.json>] [--output <summary.json>]';
const options = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const key = /^--(baseline|candidate|frozen|output)$/.exec(argv[i] ?? '')?.[1];
  if (!key || argv[i + 1] === undefined || key in options) throw new Error(usage);
  options[key] = argv[i + 1];
}
if (!options.baseline) throw new Error(usage);
const read = async file => JSON.parse(await readFile(path.resolve(root, file), 'utf8'));
const frozen = await read(options.frozen ?? 'fixtures/real-world-shapes/frozen-baseline-v1.json');
const baseline = summarizeActionSplit(await read(options.baseline), frozen);
const candidate = options.candidate ? summarizeActionSplit(await read(options.candidate), frozen) : null;
const summary = { schemaVersion: 1, reportType: 'untargeted-action-split', frozenSubset: { id: frozen.id, digest: frozen.digest, fixtures: frozen.fixtures.length },
  baseline, ...(candidate ? { candidate, comparison: compareActionSplit(baseline, candidate) } : {}) };
const text = `${JSON.stringify(summary, null, 2)}\n`;
if (options.output) await writeFile(path.resolve(options.output), text);
else process.stdout.write(text);
for (const run of [baseline, candidate].filter(Boolean)) {
  for (const s of run.scanners) {
    for (const [subset, v] of Object.entries(s.subsets))
      console.error(`${run.label} ${s.id} ${subset}: ${v.controls} controls, ${v.flagged} flagged (any action), ${v.gating} gating (redact/block), ${v.warnOnly} warn-only${v.actionUnknown ? `, ${v.actionUnknown} action-unreported` : ''}`);
  }
}
