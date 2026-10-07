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

interface DiffForFreshness {
  candidate?: { version?: string };
  baseline?: { productVersion?: string; archive?: { semanticDigests?: Record<string, string> } };
}
interface RegistryForFreshness { scanners: { id: string; version: string }[]; runs: { id: string; canonical?: boolean; platform: string; artifact: { semanticDigest: string } }[] }

const prerelease = (version: string) => /^(\d+\.\d+\.\d+)-([a-z]+)\.(\d+)$/.exec(version);

/**
 * Whether a candidate diff is bound to the CURRENT pins (#657). `qualification:candidate-diff` proves the candidate and its control differ in the product build only; it
 * does not say the control is the release this checkout accepts. A diff measured against an earlier release or engine (a beta.13 control on alpha.15 when the registry pins
 * beta.14 on alpha.16) is true history and not a statement about the current release, so it is refused here, never published as current:
 *  - the control's product is the pinned `redact-secret` release;
 *  - every population of the control carries the semantic digest of the canonical official run of the registry (a re-measurement of the accepted release at the accepted
 *    engine, evidence, configuration and scanner roster hashes to the same value);
 *  - the candidate is a build of that release or a later one, never an earlier one.
 * Pure: returns every reason, empty when the diff is current.
 */
export function candidateDiffFreshnessProblems(diff: DiffForFreshness, registry: RegistryForFreshness): string[] {
  const problems: string[] = [];
  const pinned = registry.scanners.find(s => s.id === 'redact-secret')?.version;
  const control = diff.baseline?.productVersion;
  if (!pinned) return ['the registry pins no redact-secret release'];
  if (control !== pinned) problems.push(`the control is redact-secret ${String(control)}, the registry pins ${pinned}`);
  const recorded = new Map(registry.runs.filter(r => r.canonical && r.platform === 'linux-x64').map(r => [r.id.replace(/@linux-x64$/, ''), r.artifact.semanticDigest]));
  const digests = diff.baseline?.archive?.semanticDigests ?? {};
  for (const [key, digest] of recorded) if (digests[key] !== digest) problems.push(`the control's ${key} run is ${String(digests[key])}, the canonical official run is ${digest} (another engine, evidence, configuration or roster)`);
  const a = prerelease(String(diff.candidate?.version)), b = prerelease(pinned);
  if (!a || !b) problems.push(`the candidate version ${String(diff.candidate?.version)} cannot be ordered against the pinned release ${pinned}`);
  else if (a[1] !== b[1] || a[2] !== b[2]) problems.push(`the candidate version ${diff.candidate?.version} is not a build of the pinned release line ${pinned}`);
  else if (Number(a[3]) < Number(b[3])) problems.push(`the candidate is an earlier build (${diff.candidate?.version}) than the pinned release ${pinned}`);
  return problems;
}

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
