#!/usr/bin/env node
/**
 * The adoption report follows the adoption record (#792, #793). The accepted record (benchmarks/evidence-adoption.json), the recorded comparison and the owner-facing Markdown report
 * state one adoption; recording a deployment receipt changes the record, so the other two are re-rendered from it in the same commit. This module owns three things:
 *
 *   1. which report files belong to the record (explicit `candidate.acceptance` paths, else the deterministic legacy names derived from `candidate.changeReport`, never a newest-file glob),
 *      and the identity check that a comparison and a change report are the record's own before any state is applied to them;
 *   2. a recoverable multi-file commit (journal + expected-source digests): rename calls are not a transaction, so the commit point is one journal file, a crash after it rolls forward,
 *      a crash before it changed nothing, and a concurrent edit of any target is refused, never overwritten;
 *   3. a read-only freshness check (the active record against its rendered comparison state and Markdown) and the repair that re-renders them.
 *
 *   node scripts/adoption-report-sync.mjs check|render|recover      check (default) is read-only; render rewrites a stale active report; recover finishes or reports an interrupted commit
 *
 * It runs no scanner, accepts nothing, never writes the authority file or an owner field, and never contacts a remote. Rendering is the unchanged `compare-adoption-views.ts --from-comparison`.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RECORD = 'benchmarks/evidence-adoption.json';
export const REGISTRY = 'benchmarks/official-runs.json';
export const PARITY = 'docs/generated/qualification-parity.json';
export const JOURNAL = 'benchmarks/.adoption-commit.json';
const PARITY_HEADING = '## 4. Legacy-oracle parity';
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Pure: the files of the record's active report. `candidate.acceptance.{comparison,report,parity}` when the record names them; otherwise the documented legacy names next to the change report
 * (`<tag>.json` -> `<tag>.comparison.json`, `<tag>.md`); the parity report is an input only when the committed Markdown carries its section (or the record names it). `read(path)` returns text or null.
 */
export function reportPaths(candidate, read) {
  const changeReport = candidate?.changeReport;
  if (!changeReport?.endsWith('.json')) return { problems: ['candidate.changeReport must name the change report (a .json file)'] };
  const stem = changeReport.slice(0, -'.json'.length);
  const a = candidate.acceptance ?? {};
  const comparison = a.comparison ?? `${stem}.comparison.json`, report = a.report ?? `${stem}.md`;
  const parity = a.parity ?? (read(report)?.includes(PARITY_HEADING) ? PARITY : null);
  return { changeReport, comparison, report, parity, source: a.comparison && a.report ? 'acceptance' : 'legacy', problems: [] };
}

/** Pure: why a comparison and a change report are not the record's own (release, adoption key, engine and the frozen replay provenance), or an empty list. */
export function reportIdentityProblems({ comparison, changeReport, candidate }) {
  const problems = [];
  if (comparison?.schema !== 'redact-secret/evidence-adoption-view-comparison/v1') problems.push('the comparison is not a redact-secret/evidence-adoption-view-comparison/v1 document');
  if (comparison?.evidenceRelease !== candidate.evidenceRelease) problems.push(`the comparison is of ${comparison?.evidenceRelease}, the record's adoption is ${candidate.evidenceRelease}`);
  if (changeReport?.evidenceRelease !== candidate.evidenceRelease) problems.push(`the change report is of ${changeReport?.evidenceRelease}, the record's adoption is ${candidate.evidenceRelease}`);
  if (changeReport?.adoptionKey !== candidate.adoptionKey) problems.push(`the change report has adoption key ${changeReport?.adoptionKey}, the record has ${candidate.adoptionKey}`);
  const s = comparison?.adoptionState;
  if (s?.evidenceRelease !== candidate.evidenceRelease || s?.engine !== (candidate.engine?.tag ?? null)) problems.push('the comparison was measured for another evidence release or engine than the record');
  const replay = { ciRun: candidate.replay?.ciRun ?? null, archive: candidate.replay?.archive ?? null, benchmarkRevision: candidate.replay?.benchmarkRevision ?? null };
  if (!same(s?.replay, replay)) problems.push('the comparison records other measurement provenance (replay run, archive, benchmark revision) than the record');
  return problems;
}

/** Pure: a re-render may change only the scope line and the adoption state, and the state only in the owner-facing fields; every measurement stays as recorded. */
export function frozenProblems(before, after) {
  const problems = [];
  const strip = ({ scope, adoptionState, ...rest }) => rest;
  if (!same(strip(before), strip(after))) problems.push('the re-render changed recorded comparison measurements (only the scope line and the adoption state may change)');
  const { deployment: d0, ...s0 } = before.adoptionState ?? {}, { deployment: d1, ...s1 } = after.adoptionState ?? {};
  if (!same(s0, s1)) problems.push('the re-render changed the adoption state beyond the deployment receipts');
  return { problems, deployments: { before: d0, after: d1 } };
}

/** The staged (rendered) report of a record, written under a scratch directory and returned as text: nothing canonical is touched. */
export function renderReport({ root = defaultRoot, record, paths, registryText, run = execFileSync }) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'adoption-report-'));
  try {
    const recordFile = path.join(scratch, 'record.json'), registryFile = path.join(scratch, 'registry.json');
    const out = { json: path.join(scratch, 'comparison.json'), md: path.join(scratch, 'report.md') };
    writeFileSync(recordFile, record);
    writeFileSync(registryFile, registryText);
    const args = ['--import', 'tsx', 'scripts/compare-adoption-views.ts', '--from-comparison', paths.comparison, '--report', paths.changeReport, '--record', recordFile, '--registry', registryFile, '--out-json', out.json, '--out-md', out.md];
    if (paths.parity) args.push('--parity', paths.parity);
    run('node', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    return { comparison: readFileSync(out.json, 'utf8'), markdown: readFileSync(out.md, 'utf8') };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

/**
 * Stage the whole update of the report files for `recordText` (the record as it would be committed): resolve and identity-check the report, render it from its original inputs, and validate the
 * rendered files against the committed ones. Returns the bytes to commit; throws with every problem before anything is written.
 */
export async function stageReport({ root = defaultRoot, recordText, render = renderReport }) {
  const record = JSON.parse(recordText), candidate = record.candidate ?? {};
  const readText = p => (existsSync(path.join(root, p)) ? readFileSync(path.join(root, p), 'utf8') : null);
  const paths = reportPaths(candidate, readText);
  if (paths.problems.length) throw new Error(paths.problems.join('; '));
  const missing = [paths.changeReport, paths.comparison, paths.report, ...(paths.parity ? [paths.parity] : [])].filter(p => readText(p) === null);
  if (missing.length) throw new Error(`the report inputs ${missing.join(', ')} are missing; they are the original render inputs and are never replaced by newer files`);
  const sources = { [paths.comparison]: sha(readFileSync(path.join(root, paths.comparison))), [paths.report]: sha(readFileSync(path.join(root, paths.report))) }; // the digests this update is staged against
  const comparison = JSON.parse(readText(paths.comparison)), changeReport = JSON.parse(readText(paths.changeReport));
  const problems = reportIdentityProblems({ comparison, changeReport, candidate });
  if (problems.length) throw new Error(problems.join('; '));
  const rendered = await render({ root, record: recordText, paths, registryText: readText(REGISTRY) });
  const after = JSON.parse(rendered.comparison);
  const frozen = frozenProblems(comparison, after);
  const outputProblems = [...frozen.problems, ...reportIdentityProblems({ comparison: after, changeReport, candidate })];
  for (const env of ['staging', 'production']) {
    const receipt = candidate.deployment?.[env] ?? null;
    if (!same(after.adoptionState?.deployment?.[env] ?? null, receipt)) outputProblems.push(`the rendered comparison does not state the ${env} receipt of the record`);
    if (receipt && !rendered.markdown.includes(receipt.runId)) outputProblems.push(`the rendered Markdown does not show the ${env} receipt (run ${receipt.runId})`);
  }
  if (outputProblems.length) throw new Error(`the rendered report is not valid: ${outputProblems.join('; ')}`);
  return { paths, sources, files: { [paths.comparison]: rendered.comparison, [paths.report]: rendered.markdown } };
}

/**
 * The recoverable commit of several files. Steps: (1) refuse unless every target still has the digest the update was staged against (a concurrent edit is refused, never overwritten);
 * (2) write each new content next to its target as `<file>.next`; (3) write the journal whole and rename it into place (the commit point);
 * (4) rename each `.next` onto its target; (5) delete the journal. Interrupted before (3): nothing canonical changed and the strays are removed. Interrupted after: `recoverCommit` rolls forward.
 * `ops` is injectable so tests can fail at every write and rename boundary.
 */
export async function commitFiles({ root = defaultRoot, files, expected, ops = { writeFile, rename } }) {
  const abs = p => path.join(root, p), journalFile = abs(JOURNAL);
  const digestOf = async p => (existsSync(abs(p)) ? sha(await readFile(abs(p))) : 'absent');
  if (existsSync(journalFile)) throw new Error(`an interrupted adoption commit is pending (${JOURNAL}); run: node scripts/adoption-report-sync.mjs recover`);
  const entries = [];
  for (const [p, text] of Object.entries(files)) {
    const from = await digestOf(p);
    if (from !== expected[p]) throw new Error(`${p} changed since this update was staged (expected ${expected[p]}, found ${from}); nothing was written, rerun the command`);
    entries.push({ path: p, from, to: sha(Buffer.from(text)) });
  }
  const strays = Object.keys(files).map(p => `${abs(p)}.next`);
  try {
    for (const [p, text] of Object.entries(files)) await ops.writeFile(`${abs(p)}.next`, text);
    const journalTemporary = `${journalFile}.tmp`;
    await ops.writeFile(journalTemporary, `${JSON.stringify({ schema: 'redact-secret/adoption-commit/v1', files: entries }, null, 2)}\n`);
    await ops.rename(journalTemporary, journalFile);
  } catch (error) {
    await Promise.all([...strays, `${journalFile}.tmp`].map(f => unlink(f).catch(() => undefined)));
    throw error;
  }
  return finishCommit({ root, ops });
}

/** Roll a journaled commit forward: every target ends at its new digest, or the commit is refused with the reason (a target edited since). Idempotent. */
export async function finishCommit({ root = defaultRoot, ops = { writeFile, rename } }) {
  const abs = p => path.join(root, p), journalFile = abs(JOURNAL);
  const journal = JSON.parse(await readFile(journalFile, 'utf8'));
  const digestOf = async p => (existsSync(abs(p)) ? sha(await readFile(abs(p))) : 'absent');
  const pending = [];
  for (const f of journal.files) {
    const now = await digestOf(f.path);
    if (now === f.to) continue;
    if (now !== f.from) throw new Error(`${f.path} was edited during an interrupted commit (found ${now}); the commit is not applied over it; resolve the edit, delete ${JOURNAL} and ${f.path}.next, and rerun`);
    if (!existsSync(`${abs(f.path)}.next`) || sha(await readFile(`${abs(f.path)}.next`)) !== f.to) throw new Error(`${f.path}.next is missing or is not the journaled content; delete ${JOURNAL} and rerun the receipt command (nothing was applied to ${f.path})`);
    pending.push(f);
  }
  for (const f of pending) await ops.rename(`${abs(f.path)}.next`, abs(f.path));
  await unlink(journalFile);
  return journal.files.map(f => f.path);
}

/** The state of a pending commit for the read-only gate: null when none. */
export const pendingCommit = root => (existsSync(path.join(root, JOURNAL)) ? `an interrupted adoption commit is pending (${JOURNAL}); run: node scripts/adoption-report-sync.mjs recover` : null);

/** Read-only: the problems of the active report against the active record (stale comparison state or Markdown, missing inputs, a pending commit). Superseded reports are historical and not checked. */
export async function freshnessProblems({ root = defaultRoot, render = renderReport } = {}) {
  const pending = pendingCommit(root);
  if (pending) return [pending];
  const recordText = readFileSync(path.join(root, RECORD), 'utf8');
  const record = JSON.parse(recordText);
  if (record.state !== 'accepted') return []; // a candidate's report is made whole by the prepare command, not re-rendered from the record
  let staged;
  try { staged = await stageReport({ root, recordText, render }); } catch (error) { return [`the active adoption report cannot be re-rendered: ${error.message}`]; }
  return Object.entries(staged.files).filter(([p, text]) => readFileSync(path.join(root, p), 'utf8') !== text)
    .map(([p]) => `${p} is stale against ${RECORD}; run: node scripts/adoption-report-sync.mjs render`);
}

async function main() {
  const command = process.argv[2] ?? 'check', root = defaultRoot;
  if (command === 'recover') {
    if (!existsSync(path.join(root, JOURNAL))) { console.log('No interrupted adoption commit.'); return; }
    console.log(`Recovered: ${(await finishCommit({ root })).join(', ')}`);
  } else if (command === 'render') {
    const pending = pendingCommit(root);
    if (pending) throw new Error(pending);
    const recordText = readFileSync(path.join(root, RECORD), 'utf8');
    if (JSON.parse(recordText).state !== 'accepted') throw new Error('only the report of an accepted adoption is re-rendered from the record');
    const staged = await stageReport({ root, recordText });
    const changed = Object.fromEntries(Object.entries(staged.files).filter(([p, text]) => readFileSync(path.join(root, p), 'utf8') !== text));
    if (!Object.keys(changed).length) { console.log('The adoption report is current.'); return; }
    const expected = Object.fromEntries(Object.keys(changed).map(p => [p, sha(readFileSync(path.join(root, p)))]));
    console.log(`Re-rendered: ${(await commitFiles({ root, files: changed, expected })).join(', ')}`);
  } else if (command === 'check') {
    const problems = await freshnessProblems({ root });
    if (problems.length) { console.error(`${problems.length} adoption report problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`); process.exit(1); }
    console.log('The active adoption report is current with the adoption record.');
  } else throw new Error(`unknown command ${command}; use check, render or recover`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(`adoption report refused: ${error.message}`); process.exit(1); });
export { sha };
