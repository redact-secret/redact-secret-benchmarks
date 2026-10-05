#!/usr/bin/env node
/**
 * The report steps of a candidate replay, as one command used by the workflow's report job and by `run-candidate-replay.mjs collect` alike (#698), so the CI
 * summary and the committed data are produced by the same code from the same inputs:
 *
 *   node scripts/candidate-replay-pipeline.mjs --control <dir> --candidate <dir> --candidate-id <id> --snapshot <credential-eval-corpus-snapshot.json> --out <dir>
 *     [--evidence-tag <snapshot tag> --evidence-manifest-digest sha256:<hex>]   a new snapshot: its adoption record supplies the control
 *
 * 1. compare-replay-effects (strict): every difference is an identity field or a per-case outcome, keyed by semantic ids;
 * 2. candidate-replay-report: fixed, worse, changed and still failing cases with findings, sanitized views and repeat-run agreement;
 * 3. apply-triage-decisions: the triage rules over the exported queue with the candidate's verified fixes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { controlFor } from './candidate-control.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsx = (script, args) => execFileSync('node', ['--import', 'tsx', path.join('scripts', script), ...args], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=6144' } });

export function buildReport({ control, candidate, id, snapshot, out, evidenceTag, manifestDigest }) {
  // The control record is the accepted evidence's engine candidate, or, for a new snapshot (evidenceTag + manifestDigest), the adoption record of that release.
  const adoption = controlFor(JSON.parse(readFileSync(path.join(root, 'benchmarks/evidence-adoption.json'), 'utf8')), { evidenceTag, manifestDigest });
  const named = evidenceTag ? ['--evidence-tag', evidenceTag, '--evidence-manifest-digest', manifestDigest] : [];
  const queue = path.join(root, `docs/generated/evidence-adoption/${adoption.evidenceRelease}.triage-queue.json`);
  mkdirSync(out, { recursive: true });
  tsx('compare-replay-effects.ts', ['--from', control, '--to', candidate, '--label', `product effect: published control to unpublished candidate ${id}`, '--out', path.join(out, 'effect.json'), '--strict']);
  tsx('candidate-replay-report.ts', ['--control', control, '--candidate', candidate, '--candidate-id', id, '--out', out, ...(snapshot ? ['--snapshot', snapshot] : []), ...named]);
  // The triage queue of a new snapshot is exported after its engine replay (`npm run adoption:triage-queue`); without it the effect report stands alone.
  if (!existsSync(queue)) { console.error(`no triage queue ${path.relative(root, queue)}: the triage rules are not applied`); return; }
  tsx('apply-triage-decisions.ts', ['--queue', queue, '--candidate', path.join(out, 'candidate-effect.json'), '--open-core-issue', 'https://github.com/redact-secret/redact-secret/issues/1203', '--out-json', path.join(out, 'triage.json'), '--out-md', path.join(out, 'triage.md')]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? path.resolve(args[at + 1]) : undefined; };
  const plain = name => { const at = args.indexOf(`--${name}`); return at >= 0 && args[at + 1] ? args[at + 1] : undefined; };
  const idAt = args.indexOf('--candidate-id');
  try { buildReport({ control: option('control'), candidate: option('candidate'), id: args[idAt + 1], snapshot: option('snapshot'), out: option('out'), evidenceTag: plain('evidence-tag'), manifestDigest: plain('evidence-manifest-digest') }); }
  catch (error) { console.error(`candidate replay report refused: ${error.message}`); process.exit(1); }
}
