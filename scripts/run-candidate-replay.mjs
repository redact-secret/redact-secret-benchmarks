#!/usr/bin/env node
/**
 * One command for the manual steps between a registered product candidate and a reviewable pull request (#698, #690): dispatch the replay, wait for it, collect the
 * effect report and the artifacts, archive them durably, verify the archive round trip, write the generated data and the registry receipt, and open the draft pull
 * request. Every step is idempotent and every refusal exits non-zero with the reason; nothing is accepted, no ledger row or status moves, and the evidence is not edited.
 *
 *   node scripts/run-candidate-replay.mjs all      --candidate <id> [--ref <branch>] [--no-pr]
 *   node scripts/run-candidate-replay.mjs dispatch --candidate <id> [--ref <branch>]            prints the run id
 *   node scripts/run-candidate-replay.mjs wait     --run <id>                                    exits non-zero unless the run succeeded
 *   node scripts/run-candidate-replay.mjs collect  --candidate <id> --run <id>                   download, archive, verify, write data, record
 *   node scripts/run-candidate-replay.mjs propose  --candidate <id>                              branch, commit, push, draft pull request
 *
 * The workflow is `official-runs.yml` with the `candidate` input; it stays read-only (contents: read), so the archive release and the pull request are made here, with
 * the maintainer's own `gh` credentials. The registry receipt (`replay` on the candidate in benchmarks/product-candidates.json) holds the CI run, the archive release
 * and its digest, the benchmark revision and the verdict counts; `npm run product-candidates:check` verifies its shape.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchArchive, listKept, pack, sha256File } from './replay-archive.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
const WORKFLOW = 'official-runs.yml';
const registryFile = path.join(root, 'benchmarks/product-candidates.json');
const readRegistry = () => JSON.parse(readFileSync(registryFile, 'utf8'));
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'inherit'], ...options });
export const gh = (args, options) => run('gh', args, options);

/** The workflow_dispatch run this dispatch created: newest on the ref, created at or after the dispatch, at the pushed commit. */
export function pickDispatchedRun(runs, { ref, sha, after }) {
  const matches = runs
    .filter(r => r.event === 'workflow_dispatch' && r.headBranch === ref && r.headSha === sha && Date.parse(r.createdAt) >= after - 5000)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return matches[0];
}

/** The registry with the replay receipt of one candidate. Refuses a receipt that is not complete or whose archive digest is malformed. */
export function recordReplay(registry, id, replay) {
  const candidate = registry.candidates.find(c => c.id === id);
  if (!candidate) throw new Error(`no product candidate ${id}`);
  for (const key of ['ciRun', 'benchmarkRevision', 'data', 'worsened', 'fixed', 'regressed']) if (replay[key] === undefined) throw new Error(`the replay receipt lacks ${key}`);
  if (!/^sha256:[0-9a-f]{64}$/.test(replay.archive?.sha256 ?? '') || !replay.archive?.release) throw new Error('the replay receipt needs the archive release and its sha256');
  if (!/^[0-9a-f]{40}$/.test(replay.benchmarkRevision)) throw new Error('benchmarkRevision must be a full commit');
  return { ...registry, candidates: registry.candidates.map(c => (c.id === id ? { ...c, replay: { state: 'replayed', ...replay } } : c)) };
}

export const dataDir = id => `docs/generated/evidence-adoption/product-${id}`;

function dispatch(id, ref) {
  if (run('git', ['status', '--porcelain']).trim()) throw new Error('the working tree is not clean: the replay runs the pushed commit, so commit and push first');
  const sha = run('git', ['rev-parse', 'HEAD']).trim();
  const pushed = run('git', ['ls-remote', 'origin', `refs/heads/${ref}`]).split('\t')[0];
  if (pushed !== sha) throw new Error(`origin/${ref} is at ${pushed || 'nothing'}, HEAD is ${sha}: push first`);
  run('node', ['scripts/check-product-candidates.mjs', '--bindings'], { stdio: 'inherit' });
  const after = Date.now();
  gh(['workflow', 'run', WORKFLOW, '-R', REPOSITORY, '--ref', ref, '-f', `candidate=${id}`]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const runs = JSON.parse(gh(['run', 'list', '-R', REPOSITORY, '--workflow', WORKFLOW, '--branch', ref, '--limit', '10', '--json', 'databaseId,event,headBranch,headSha,createdAt']));
    const found = pickDispatchedRun(runs, { ref, sha, after });
    if (found) return String(found.databaseId);
    execFileSync('sleep', ['5']);
  }
  throw new Error('the dispatched run did not appear');
}

function wait(runId) {
  try { gh(['run', 'watch', runId, '-R', REPOSITORY, '--exit-status', '--interval', '60'], { stdio: 'inherit' }); }
  catch { throw new Error(`run ${runId} did not succeed: ${gh(['run', 'view', runId, '-R', REPOSITORY, '--json', 'jobs', '--jq', '.jobs[]|"\\(.name) \\(.conclusion)"']).trim().replace(/\n/g, '; ')}`); }
}

function collect(id, runId) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'candidate-collect-'));
  try {
    const into = path.join(scratch, 'replay');
    for (const population of ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus']) gh(['run', 'download', runId, '-R', REPOSITORY, '-n', `candidate-run-${population}`, '-D', path.join(into, population)]);
    gh(['run', 'download', runId, '-R', REPOSITORY, '-n', 'candidate-replay-report', '-D', path.join(scratch, 'report')]);
    // Every artifact must say what it is: an exploratory, internal measurement of this candidate's registered bytes.
    const registry = readRegistry(), candidate = registry.candidates.find(c => c.id === id);
    for (const rel of ['public-evidence-snapshot', 'public-evidence-snapshot/methods', 'regression-corpus', 'policy-corpus']) {
      const record = JSON.parse(readFileSync(path.join(into, rel, 'run-record.json'), 'utf8'));
      if (record.runClass !== 'exploratory' || record.publication !== 'internal' || record.productCandidate?.id !== id || record.productCandidate?.commit !== candidate.product.commit) throw new Error(`${rel}/run-record.json is not an exploratory, internal run of candidate ${id}`);
      if (record.determinism?.semanticDigestsEqual !== true) throw new Error(`${rel}: the repeat runs did not agree`);
    }
    const effect = JSON.parse(readFileSync(path.join(scratch, 'report/candidate-effect.json'), 'utf8'));
    const archived = pack({ input: into, out: path.join(scratch, 'archive'), tag: `candidate-runs-${runId}`, notes: `Candidate replay ${id} (CI run ${runId}): exploratory, internal artifacts of an unpublished build. Never accepted runs and never public evidence.` });
    // The archive must round-trip: what is fetched by its digest holds the same artifact bytes as what was packed.
    const check = path.join(scratch, 'roundtrip');
    fetchArchive({ release: `candidate-runs-${runId}`, sha256: archived.digest, out: check, repository: REPOSITORY });
    for (const rel of listKept(into)) if (sha256File(path.join(into, rel)) !== sha256File(path.join(check, rel))) throw new Error(`the archive round trip differs for ${rel}`);
    const out = path.join(root, dataDir(id));
    mkdirSync(out, { recursive: true });
    for (const f of ['candidate-effect.json', 'candidate-effect.md', 'effect.json', 'triage.json', 'triage.md']) copyFileSync(path.join(scratch, 'report', f), path.join(out, f));
    const next = recordReplay(registry, id, {
      ciRun: `https://github.com/${REPOSITORY}/actions/runs/${runId}`,
      archive: { release: `candidate-runs-${runId}`, sha256: archived.digest, files: archived.files.length },
      benchmarkRevision: JSON.parse(readFileSync(path.join(into, 'public-evidence-snapshot/run-record.json'), 'utf8')).benchmarkRevision,
      data: dataDir(id), worsened: effect.worsened, fixed: effect.fixed.length, regressed: effect.regressed.length,
      repeatRunsEqual: true,
    });
    writeFileSync(registryFile, `${JSON.stringify(next, null, 2)}\n`);
    return { effect, digest: archived.digest };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

function propose(id) {
  const branch = run('git', ['branch', '--show-current']).trim();
  if (!branch || ['develop', 'main'].includes(branch)) throw new Error('propose from a feature branch, never develop or main');
  run('git', ['add', dataDir(id), 'benchmarks/product-candidates.json']);
  if (run('git', ['status', '--porcelain', dataDir(id), 'benchmarks/product-candidates.json']).trim()) run('git', ['commit', '-m', `data(candidate): replay of product candidate ${id} (exploratory, internal)`]);
  run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  const existing = JSON.parse(gh(['pr', 'list', '-R', REPOSITORY, '--head', branch, '--state', 'open', '--json', 'number,url']));
  if (existing.length) return existing[0].url;
  return gh(['pr', 'create', '-R', REPOSITORY, '--draft', '--base', 'develop', '--head', branch, '--title', `data(candidate): product candidate ${id} replay`, '--body',
    `Replay of the registered unpublished product candidate \`${id}\` (see \`${dataDir(id)}/candidate-effect.md\`). Exploratory and internal: not an accepted run, no ledger row or status moves, the evidence is not edited. Owner decisions stay with the owner.`]).trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...rest] = process.argv.slice(2);
  const option = name => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  const id = option('candidate');
  try {
    const ref = option('ref') ?? run('git', ['branch', '--show-current']).trim();
    if (command === 'dispatch') console.log(dispatch(id, ref));
    else if (command === 'wait') wait(option('run'));
    else if (command === 'collect') console.log(JSON.stringify(collect(id, option('run'))));
    else if (command === 'propose') console.log(propose(id));
    else if (command === 'all') {
      const runId = dispatch(id, ref);
      console.error(`dispatched run ${runId}`);
      wait(runId);
      const result = collect(id, runId);
      console.error(`collected: worsened=${result.effect.worsened}, fixed ${result.effect.fixed.length}, archive ${result.digest}`);
      if (!rest.includes('--no-pr')) console.log(propose(id));
    } else { console.error('usage: run-candidate-replay.mjs all|dispatch|wait|collect|propose --candidate <id> ...'); process.exit(2); }
  } catch (error) { console.error(`candidate replay refused: ${error.message}`); process.exit(1); }
}
