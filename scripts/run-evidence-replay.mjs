#!/usr/bin/env node
/**
 * The control replay of an evidence candidate as one verified command (#690). Until now this was by hand: a transient replay branch carrying the candidate's pins, one
 * `official-runs.yml` dispatch, waiting, downloading, archiving, and writing the replay into the adoption record. Nothing is accepted here, no `runs[]` entry, ledger row
 * or authority value is written, and the workflow stays `contents: read`; the transient branch, the release and the record use the maintainer's own `gh` credentials.
 *
 *   node scripts/run-evidence-replay.mjs all      --tag <snapshot tag> --manifest-digest sha256:<hex> [--keep-branch]
 *   node scripts/run-evidence-replay.mjs branch   ...   create (or reuse) the transient branch `replay/<tag>-<key12>-control` at the pushed HEAD plus the candidate's pins; keeps the pins patch
 *   node scripts/run-evidence-replay.mjs dispatch ...   dispatch official-runs.yml once on that branch (an existing run of the same commit is reused, never dispatched twice); prints the run id
 *   node scripts/run-evidence-replay.mjs wait     --run <id>
 *   node scripts/run-evidence-replay.mjs collect  ... --run <id>   download, verify each run record, archive as `official-runs-<run id>`, check the round trip, record `evidenceCandidate.replay`, delete the branch
 *
 * The control is the PUBLISHED product on the engine the adoption record names, so the corpus is the only difference from the accepted runs. The candidate must already be
 * recorded by `adopt-evidence-snapshot.yml` (state `accepted`, `evidenceCandidate`), and its engine and product pins must equal the active registry's (a moved engine or product
 * still needs the by-hand pins: this command refuses and says so). Idempotence: one branch and one run per adoption key and commit; collect reuses an existing release.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchArchive, listKept, pack, sha256File } from './replay-archive.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
const WORKFLOW = 'official-runs.yml';
const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'];
const ADOPTION = 'benchmarks/evidence-adoption.json';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const readJson = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', cwd: root, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 * 1024 * 1024, ...options });
const gh = (args, options) => run('gh', args, options);

export const branchName = (tag, adoptionKey) => `replay/${tag}-${adoptionKey.replace('sha256:', '').slice(0, 12)}-control`;

/** Pure: the evidence candidate this command may replay, or the reason it may not. */
export function replayablePin({ adoption, registry, tag, manifestDigest }) {
  if (adoption?.state !== 'accepted') throw new Error(`the adoption record is ${adoption?.state}; the control replay of an evidence candidate rides on an accepted adoption`);
  const ec = adoption.evidenceCandidate;
  if (!ec || ec.evidenceRelease !== tag) throw new Error(`benchmarks/evidence-adoption.json records no evidence candidate ${tag}: dispatch adopt-evidence-snapshot.yml first`);
  if (ec.manifestDigest !== manifestDigest) throw new Error(`${tag} is recorded with manifest ${ec.manifestDigest}, not ${manifestDigest}`);
  if (ec.ownerAcceptance) throw new Error(`${tag} is already accepted; nothing to replay as a candidate`);
  if (ec.engine.tag !== registry.engine.tag || ec.engine.revision !== registry.engine.revision) throw new Error(`the candidate names engine ${ec.engine.tag}, the active pin is ${registry.engine.tag}: replaying on a moved engine still needs the by-hand pins (docs/specs/evidence-adoption.md, "Engine candidate")`);
  const product = registry.scanners.find(s => s.id === 'redact-secret');
  if (ec.product && (ec.product.version !== product.version || ec.product.integrity !== product.integrity)) throw new Error(`the candidate names @redact-secret/core ${ec.product.version}, the active pin is ${product.version}: a moved product needs the by-hand pins`);
  return ec;
}

/** Pure: the run this dispatch may reuse (same commit, not failed or cancelled), the newest first. */
export function reusableRun(runs, sha) {
  return runs
    .filter(r => r.event === 'workflow_dispatch' && r.headSha === sha && !['failure', 'cancelled', 'timed_out', 'startup_failure'].includes(r.conclusion ?? ''))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

/** Pure: what the adoption record keeps of the control replay, from the run records. Refuses a record that is not this candidate's published-product replay. */
export function replayEntry({ records, ec, tag, runId, sha, branch, archive, patchPath, dateNote }) {
  const problems = [];
  const recordedRuns = [];
  const semanticDigests = {};
  for (const { rel, record } of records) {
    if (record.engine?.revision !== ec.engine.revision) problems.push(`${rel}: engine ${record.engine?.revision} is not the candidate's ${ec.engine.revision}`);
    if (record.benchmarkRevision !== sha) problems.push(`${rel}: benchmark revision ${record.benchmarkRevision} is not the replay commit ${sha}`);
    if (record.determinism?.semanticDigestsEqual !== true) problems.push(`${rel}: the repeat runs did not agree`);
    if (record.productCandidate) problems.push(`${rel}: a product candidate run is not the control`);
    if (record.population === 'public-evidence-snapshot' && record.evidence?.release?.tag !== tag) problems.push(`${rel}: measured ${record.evidence?.release?.tag}, not ${tag}`);
    const id = `${record.population}${record.kind === 'methods' ? '+methods' : ''}@${record.platform}`;
    recordedRuns.push({ id, semanticDigest: record.artifact.semanticDigest, byteDigest: record.artifact.digest, configHash: record.configHash, caseCounts: record.caseCounts });
    semanticDigests[`${record.population}${record.kind === 'methods' ? '+methods' : ''}`] = record.artifact.semanticDigest;
  }
  if (problems.length) throw new Error(problems.join('; '));
  recordedRuns.sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    state: 'replayed',
    via: `The PUBLISHED @redact-secret/core ${ec.product?.version ?? 'pin'} on credential-eval ${ec.engine.tag}: .github/workflows/official-runs.yml dispatched once on the transient replay branch ${branch} (revision ${sha}: the repository at the reviewed code plus the candidate's evidence pin only, patch kept as ${patchPath}; branch deleted after archiving), plain and methods, linux-x64, two engine runs each with equal semantic digests; the control of the product candidate 2x2. Made by scripts/run-evidence-replay.mjs.`,
    ciRun: `https://github.com/${REPOSITORY}/actions/runs/${runId}`,
    benchmarkRevision: sha,
    archive,
    semanticDigests,
    recordedRuns,
    note: dateNote ?? 'An exploratory replay for the evidence candidate: never an accepted run, and nothing is recorded in runs[].',
  };
}

function cleanTree() {
  if (run('git', ['status', '--porcelain']).trim()) throw new Error('the working tree is not clean: the replay branch is cut from the pushed HEAD, so commit and push first');
  const branch = run('git', ['branch', '--show-current']).trim();
  if (!branch || ['develop', 'main'].includes(branch)) throw new Error('run from a feature branch, never develop or main');
  const sha = run('git', ['rev-parse', 'HEAD']).trim();
  const pushed = run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split('\t')[0];
  if (pushed !== sha) throw new Error(`origin/${branch} is at ${pushed || 'nothing'}, HEAD is ${sha}: push first`);
  return { branch, sha };
}

function context(tag, manifestDigest) {
  if (!/^snapshot-\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(tag ?? '') || !DIGEST.test(manifestDigest ?? '')) throw new Error('--tag snapshot-YYYY.MM.DD[.N] and --manifest-digest sha256:<64 hex> are required');
  const ec = replayablePin({ adoption: readJson(ADOPTION), registry: readJson('benchmarks/official-runs.json'), tag, manifestDigest });
  return { ec, branch: branchName(tag, ec.adoptionKey), patchPath: `docs/generated/evidence-adoption/${tag}.replay-pins.patch` };
}

function remoteSha(branch) { return run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).split('\t')[0] || null; }

export function branch(tag, manifestDigest) {
  const { branch: name, patchPath } = context(tag, manifestDigest);
  const existing = remoteSha(name);
  if (existing) return { branch: name, sha: existing, reused: true };
  cleanTree();
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'evidence-replay-'));
  const tree = path.join(scratch, 'tree');
  try {
    run('git', ['worktree', 'add', '--detach', tree, 'HEAD']);
    symlinkSync(path.join(root, 'node_modules'), path.join(tree, 'node_modules'), 'dir'); // untracked: the commit below takes tracked files only
    // The same `repin` the owner's acceptance branch runs: the floors population's pin moves to the candidate, its earlier runs become historical receipts. Nothing else changes.
    run('node', ['scripts/adopt-evidence-snapshot.mjs', 'repin', '--superseded-on', new Date().toISOString().slice(0, 10)], { cwd: tree, stdio: ['ignore', 'inherit', 'inherit'] });
    run('git', ['-c', 'user.name=replay', '-c', 'user.email=replay@localhost', 'commit', '-qam', `replay(${tag}): the candidate's evidence pin only (transient; never merged)`], { cwd: tree });
    const patch = run('git', ['diff', 'HEAD~1', 'HEAD'], { cwd: tree });
    mkdirSync(path.dirname(path.join(root, patchPath)), { recursive: true });
    writeFileSync(path.join(root, patchPath), patch);
    const sha = run('git', ['rev-parse', 'HEAD'], { cwd: tree }).trim();
    run('git', ['push', 'origin', `${sha}:refs/heads/${name}`], { cwd: tree });
    return { branch: name, sha, reused: false };
  } finally {
    try { run('git', ['worktree', 'remove', '--force', tree]); } catch { /* the scratch directory is removed below */ }
    rmSync(scratch, { recursive: true, force: true });
    run('git', ['worktree', 'prune']);
  }
}

export function dispatch(tag, manifestDigest) {
  const { branch: name, sha } = branch(tag, manifestDigest);
  const list = () => JSON.parse(gh(['run', 'list', '-R', REPOSITORY, '--workflow', WORKFLOW, '--branch', name, '--limit', '20', '--json', 'databaseId,event,headSha,createdAt,conclusion,status']));
  const reuse = reusableRun(list(), sha);
  if (reuse) return { runId: String(reuse.databaseId), reused: true, sha, branch: name };
  const after = Date.now();
  gh(['workflow', 'run', WORKFLOW, '-R', REPOSITORY, '--ref', name]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const found = list().filter(r => r.event === 'workflow_dispatch' && r.headSha === sha && Date.parse(r.createdAt) >= after - 5000)[0];
    if (found) return { runId: String(found.databaseId), reused: false, sha, branch: name };
    execFileSync('sleep', ['5']);
  }
  throw new Error('the dispatched run did not appear');
}

export function wait(runId, maxMinutes = 360) {
  const deadline = Date.now() + maxMinutes * 60000;
  for (;;) {
    const state = JSON.parse(gh(['run', 'view', runId, '-R', REPOSITORY, '--json', 'status,conclusion']));
    if (state.status === 'completed') {
      if (state.conclusion !== 'success') throw new Error(`run ${runId} ended ${state.conclusion}: ${gh(['run', 'view', runId, '-R', REPOSITORY, '--json', 'jobs', '--jq', '.jobs[]|"\\(.name) \\(.conclusion)"']).trim().replace(/\n/g, '; ')}`);
      return;
    }
    if (Date.now() > deadline) throw new Error(`run ${runId} is still ${state.status} after ${maxMinutes} minutes`);
    execFileSync('sleep', ['60']);
  }
}

export function collect(tag, manifestDigest, runId, { keepBranch = false } = {}) {
  const { ec, branch: name, patchPath } = context(tag, manifestDigest);
  const meta = JSON.parse(gh(['run', 'view', runId, '-R', REPOSITORY, '--json', 'headSha,headBranch,event']));
  if (meta.event !== 'workflow_dispatch' || meta.headBranch !== name) throw new Error(`run ${runId} is ${meta.event} on ${meta.headBranch}, not the dispatch on ${name}`);
  const sha = meta.headSha;
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'evidence-collect-'));
  try {
    const into = path.join(scratch, 'replay');
    for (const population of POPULATIONS) gh(['run', 'download', runId, '-R', REPOSITORY, '-n', `official-run-${population}`, '-D', path.join(into, population)]);
    const records = [];
    for (const rel of ['public-evidence-snapshot', 'public-evidence-snapshot/methods', 'regression-corpus', 'policy-corpus']) {
      const file = path.join(into, rel, 'run-record.json');
      if (!existsSync(file)) throw new Error(`${rel}/run-record.json is missing`);
      records.push({ rel, record: JSON.parse(readFileSync(file, 'utf8')) });
    }
    const archiveTag = `official-runs-${runId}`;
    let existing = null;
    try { existing = JSON.parse(gh(['release', 'view', archiveTag, '-R', REPOSITORY, '--json', 'assets'], { stdio: ['ignore', 'pipe', 'ignore'] })).assets.find(a => a.name.endsWith('.tar.gz')); } catch { existing = null; }
    const archived = existing
      ? { digest: `sha256:${existing.digest?.replace(/^sha256:/, '') ?? ''}`, files: listKept(into) }
      : pack({ input: into, out: path.join(scratch, 'archive'), tag: archiveTag, notes: `Control replay of ${tag} (CI run ${runId}): the published product on the candidate's engine. An exploratory replay, never an accepted run.` });
    const check = path.join(scratch, 'roundtrip');
    fetchArchive({ release: archiveTag, sha256: archived.digest, out: check, repository: REPOSITORY });
    for (const rel of listKept(into)) if (sha256File(path.join(into, rel)) !== sha256File(path.join(check, rel))) throw new Error(`the archive round trip differs for ${rel}`);
    const replay = replayEntry({ records, ec, tag, runId, sha, branch: name, archive: { release: archiveTag, sha256: archived.digest }, patchPath });
    const adoption = readJson(ADOPTION);
    writeFileSync(path.join(root, ADOPTION), `${JSON.stringify({ ...adoption, evidenceCandidate: { ...adoption.evidenceCandidate, replay } }, null, 2)}\n`);
    if (!keepBranch && remoteSha(name)) run('git', ['push', 'origin', '--delete', name]);
    return { runId, archive: replay.archive, semanticDigests: replay.semanticDigests };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, ...rest] = process.argv.slice(2);
  const option = name => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  const tag = option('tag'), digest = option('manifest-digest');
  try {
    if (command === 'branch') console.log(JSON.stringify(branch(tag, digest)));
    else if (command === 'dispatch') console.log(JSON.stringify(dispatch(tag, digest)));
    else if (command === 'wait') wait(option('run'));
    else if (command === 'collect') console.log(JSON.stringify(collect(tag, digest, option('run'), { keepBranch: rest.includes('--keep-branch') })));
    else if (command === 'all') {
      const d = dispatch(tag, digest);
      console.error(`${d.reused ? 'reusing' : 'dispatched'} run ${d.runId} on ${d.branch} (${d.sha})`);
      wait(d.runId);
      console.log(JSON.stringify(collect(tag, digest, d.runId, { keepBranch: rest.includes('--keep-branch') })));
    } else { console.error('usage: run-evidence-replay.mjs all|branch|dispatch|wait|collect --tag <snapshot tag> --manifest-digest sha256:<hex> [--run <id>]'); process.exit(2); }
  } catch (error) { console.error(`evidence replay refused: ${error.message}`); process.exit(1); }
}
