/**
 * The publication seam of the credential qualification authority (#657): which pipeline `publish-site.yml` runs, and the candidate step of the `new` one.
 *
 *   node --import tsx scripts/credential-publication.ts authority
 *       Prints `new` or `legacy` (the committed value, validated; an invalid file fails) and, under Actions, writes `authority=<value>` to GITHUB_OUTPUT.
 *       This is the one place the workflow learns the authority: it never reads the committed file itself (a reader is listed in AUTHORITY_READERS).
 *
 *   node --import tsx scripts/credential-publication.ts candidate --core-sha256 <hex> --product-commit <sha> [--out results-output/candidate-diff-from-artifacts.json]
 *       The candidate evidence of a staging publication under `new`: never a measurement, only a consumer of a recorded candidate replay. The qualified candidate
 *       (its core tarball digest and product commit, as `qualified-candidate.mjs verify` established them) is looked up in benchmarks/product-candidates.json.
 *         unregistered  no registered candidate has this digest: nothing is replayed for it, so nothing is published about it (exit 0, said in the summary).
 *         unreplayed    registered, never replayed: same.
 *         conflict      a registered candidate has this digest at another commit (or this commit at another digest): the artifacts are not what they claim, exit 1.
 *         replayed      the recorded replay archive is fetched (digest verified) and `qualification:candidate-diff --verify-tarballs` runs on it; any refusal (a
 *                       differing configuration or roster, bytes that do not hash to the record, a tarball that is not the registered one) is exit 1, and so is a diff
 *                       that is not bound to the current pins (`candidateDiffFreshnessProblems`: the control is the pinned release and carries the canonical official runs' digests).
 *       The result is the internal, allowlisted projection (counts and labels, no span or byte); it is written under results-output/, never under public/, and only
 *       its counts reach the step summary. Released public artifacts never hold a candidate measurement, and no released observation is reused as a candidate run.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AUTHORITY_FILE, DEFAULT_AUTHORITY, authorityShapeProblems, type Authority } from '../benchmarks/qualification/authority.ts';
import { candidateDiffFreshnessProblems } from '../benchmarks/qualification/candidate-freshness.ts';
import { readRegistry } from './install-product-candidate.mjs';
import { fetchArchive } from './replay-archive.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The committed authority, validated. An absent file is `legacy`, the state before the switch; an invalid one is an error, never a quiet choice. */
export function readAuthority(file = path.join(root, AUTHORITY_FILE)): Authority {
  let value: unknown;
  try { value = JSON.parse(readFileSync(file, 'utf8')); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_AUTHORITY;
    throw new Error(`${AUTHORITY_FILE} is unreadable: ${(error as Error).message}`);
  }
  const problems = authorityShapeProblems(value);
  if (problems.length) throw new Error(`${AUTHORITY_FILE} is invalid: ${problems.join('; ')}`);
  return (value as { authority: Authority }).authority;
}

interface RegisteredPackage { name: string; sha256: string; platform: string | null }
interface Registered { id: string; product: { commit: string }; packages: RegisteredPackage[]; replay?: { state?: string; archive?: { release: string; sha256: string } } }
export type CandidatePlan =
  | { state: 'unregistered' }
  | { state: 'unreplayed'; id: string }
  | { state: 'conflict'; id: string; reason: string }
  | { state: 'replayed'; id: string; archive: { release: string; sha256: string } };

/** Look the qualified candidate up in the registry by its core tarball digest and product commit. Pure. */
export function planCandidate(registry: { candidates?: Registered[] }, qualified: { coreSha256: string; productCommit: string }): CandidatePlan {
  const digest = `sha256:${qualified.coreSha256.replace(/^sha256:/, '')}`;
  const core = (c: Registered) => c.packages.find(p => p.name === '@redact-secret/core' && p.platform === null)?.sha256;
  const byDigest = (registry.candidates ?? []).filter(c => core(c) === digest);
  const byCommit = (registry.candidates ?? []).filter(c => c.product.commit === qualified.productCommit);
  for (const c of byDigest) if (c.product.commit !== qualified.productCommit) return { state: 'conflict', id: c.id, reason: `${c.id} registers this core tarball digest at commit ${c.product.commit}, the qualified candidate is commit ${qualified.productCommit}` };
  for (const c of byCommit) if (core(c) !== digest) return { state: 'conflict', id: c.id, reason: `${c.id} registers commit ${qualified.productCommit} with core tarball digest ${core(c)}, the qualified one is ${digest}` };
  const match = byDigest[0];
  if (!match) return { state: 'unregistered' };
  const archive = match.replay?.archive;
  if (match.replay?.state !== 'replayed' || !archive) return { state: 'unreplayed', id: match.id };
  return { state: 'replayed', id: match.id, archive };
}

// The binding to the current pins is shared with the Next app's release-candidate page (#658), so it lives with the artifact modules.
export { candidateDiffFreshnessProblems };

const output = (pairs: Record<string, string>) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(pairs).map(([k, v]) => `${k}=${v}\n`).join(''));
};
const summary = (lines: string[]) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
};

async function candidate(args: string[]) {
  const value = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  const coreSha256 = value('core-sha256'), productCommit = value('product-commit');
  const out = value('out') ?? 'results-output/candidate-diff-from-artifacts.json';
  if (!coreSha256 || !/^(sha256:)?[0-9a-f]{64}$/.test(coreSha256) || !productCommit || !/^[0-9a-f]{40}$/.test(productCommit)) throw new Error('Usage: credential-publication candidate --core-sha256 <64 hex> --product-commit <40 hex> [--out <file>]');
  const plan = planCandidate(readRegistry(), { coreSha256, productCommit });
  output({ state: plan.state, ...('id' in plan ? { candidate: plan.id } : {}) });
  const head = `- candidate diff for redact-secret \`${productCommit.slice(0, 12)}\` (core \`${coreSha256.slice(0, 12)}\`):`;
  if (plan.state === 'conflict') { console.error(`::error::${plan.reason}`); summary([`${head} refused, ${plan.reason}`]); process.exitCode = 1; return; }
  if (plan.state === 'unregistered' || plan.state === 'unreplayed') {
    const why = plan.state === 'unregistered' ? 'no registered candidate has this tarball digest, so no candidate replay exists for it' : `${plan.id} is registered but was never replayed`;
    console.log(`::notice::No candidate diff: ${why}. Nothing is published about this candidate; the Candidate page states that none is recorded.`);
    summary([`${head} not recorded (${why}). A candidate diff needs a candidate replay at the exact tarball digest (official-runs.yml, maintainer-dispatched); the publication never measures one itself.`]);
    return;
  }
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'candidate-replay-'));
  try {
    fetchArchive({ release: plan.archive.release, sha256: plan.archive.sha256, out: scratch, repository: 'redact-secret/redact-secret-benchmarks' });
    const run = spawnSync('npm', ['run', 'qualification:candidate-diff', '--', '--candidate', plan.id, '--candidate-dir', scratch, '--verify-tarballs', '--out', out], { stdio: 'inherit', cwd: root });
    if (run.status !== 0) { summary([`${head} REFUSED for ${plan.id}; nothing was written (see the step log for the refusal).`]); process.exitCode = 1; return; }
    const diff = JSON.parse(readFileSync(path.resolve(root, out), 'utf8'));
    const stale = candidateDiffFreshnessProblems(diff, JSON.parse(readFileSync(path.join(root, 'benchmarks/official-runs.json'), 'utf8')));
    if (stale.length) {
      rmSync(path.resolve(root, out), { force: true });
      console.error(`::error::The recorded candidate diff for ${plan.id} is not bound to the current pins: ${stale.join('; ')}. A candidate replay and its control copy at the current pins are needed (a maintainer dispatch of official-runs.yml); nothing is published about this candidate.`);
      summary([`${head} REFUSED for ${plan.id}: the recorded replay is not bound to the current pins (${stale.join('; ')}). Nothing was written.`]);
      process.exitCode = 1;
      return;
    }
    summary([`${head} ${plan.id} against its recorded control (internal, exploratory; counts only, not published): worsened=${diff.worsened}`,
      ...diff.populations.map((p: Record<string, unknown>) => `  - ${p.population}: ${p.cases} cases, fixed ${p.fixed}, regressed ${p.regressed}, changed ${p.changed}, still failing ${p.stillFailing}`)]);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'authority' && args.length === 0) {
    const value = readAuthority();
    console.log(value);
    output({ authority: value });
  } else if (command === 'candidate') await candidate(args);
  else throw new Error('Usage: credential-publication <authority | candidate --core-sha256 <hex> --product-commit <sha> [--out <file>]>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`::error::${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
