/**
 * Keep the canonical official RunArtifacts durably, and hand them to the publish build, checked against the registry.
 *
 *   node scripts/official-run-archive.mjs pack  --run <ci run id> --out <dir>      (maintainer, once per recorded run)
 *   node scripts/official-run-archive.mjs fetch --out <dir> [--from <tarball>]     (publish-site.yml)
 *   node scripts/official-run-archive.mjs verify --dir <dir>
 *
 * The authority is `benchmarks/official-runs.json`: every canonical run of the archive's platform records the byte digest
 * of its artifact, and nothing is accepted whose bytes do not hash to it. The archive (a release asset of this repository,
 * named in `benchmarks/official-run-archive.json`) is only a place to keep the bytes after the CI build artifacts expire
 * (90 days). `fetch` and `verify` fail closed: a missing file, an extra file, a link, a size past the cap or a digest that
 * differs exits 1 and leaves nothing a build could read. `pack` is not part of any workflow.
 *
 * Layout, as `npm run qualification:view -- --artifacts <dir>` reads it: <dir>/<population>/artifact.json, and the
 * methods run <dir>/<population>/methods/artifact.json. The product populations' case metadata is not archived: it is a
 * deterministic export of this checkout (`npm run qualification:export`), whose corpus `official-runs:check --bindings` pins.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The alpha.3 methods artifact is 769 MB (credential-eval v0.1.0-alpha.3, 35,322 variants per scanner); it is hashed from a stream, never loaded whole.
const MAX_ARTIFACT_BYTES = 1024 * 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

/** What the archive must hold: one file per canonical run of the platform, at the digest the registry records. */
export function expectedFiles(registry, platform) {
  const problems = [];
  const files = [];
  for (const run of registry.runs ?? []) {
    if (run.platform !== platform || run.canonical !== true) continue;
    const dir = run.kind === 'methods' ? `${run.population}/methods` : run.population;
    if (!DIGEST.test(run.artifact?.byteDigest ?? '')) { problems.push(`${run.id}: no byte digest recorded`); continue; }
    if (!/^[a-z0-9-]+$/.test(run.population ?? '')) { problems.push(`${run.id}: unusable population name`); continue; }
    files.push({ id: run.id, rel: `${dir}/artifact.json`, digest: run.artifact.byteDigest });
  }
  if (new Set(files.map(f => f.rel)).size !== files.length) problems.push(`the registry records two canonical ${platform} runs for one artifact path`);
  if (!files.length) problems.push(`the registry records no canonical ${platform} run`);
  if (problems.length) throw new Error(problems.join('; '));
  return files;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', c => hash.update(c)).on('error', reject).on('end', () => resolve(`sha256:${hash.digest('hex')}`));
  });
}

async function listFiles(dir, prefix = '') {
  const found = [];
  for (const entry of await readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await listFiles(dir, rel));
    else found.push(rel);
  }
  return found;
}

/** Check a laid-out directory against the registry. Returns the problems; empty means every file is exactly the recorded bytes. */
export async function verifyDirectory(dir, registry, platform) {
  const expected = expectedFiles(registry, platform);
  const problems = [];
  const present = await listFiles(dir).catch(() => []);
  const wanted = new Set(expected.map(f => f.rel));
  for (const rel of present) if (!wanted.has(rel)) problems.push(`${rel} is not a recorded artifact`);
  for (const f of expected) {
    const file = path.join(dir, f.rel);
    const info = await lstat(file).catch(() => null);
    if (!info) { problems.push(`${f.rel} is missing (${f.id})`); continue; }
    if (!info.isFile()) { problems.push(`${f.rel} is not a regular file`); continue; }
    if (info.size > MAX_ARTIFACT_BYTES) { problems.push(`${f.rel} is ${info.size} bytes, past the ${MAX_ARTIFACT_BYTES} cap`); continue; }
    const actual = await sha256File(file);
    if (actual !== f.digest) problems.push(`${f.rel} hashes to ${actual}; ${f.id} records ${f.digest}`);
  }
  return problems;
}

const run = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} failed (${r.status}): ${(r.stderr || r.error?.message || '').trim().slice(0, 500)}`);
  return r.stdout;
};

/** Member names of a gzip tarball (`tar -tzf`), refused unless exactly the expected files. Types are checked after extraction. */
export function tarMembersProblems(listing, expected) {
  const problems = [];
  const names = listing.split('\n').filter(Boolean).map(n => n.replace(/^\.\//, ''));
  const wanted = new Set(expected.map(f => f.rel));
  for (const n of names) if (!wanted.has(n)) problems.push(`member ${n} is not a recorded artifact`);
  for (const w of wanted) if (!names.includes(w)) problems.push(`member ${w} is missing`);
  if (new Set(names).size !== names.length) problems.push('a member appears twice');
  return problems;
}

async function loadJson(rel) { return JSON.parse(await readFile(path.join(root, rel), 'utf8')); }

async function unpack(tarball, out, registry, platform) {
  const expected = expectedFiles(registry, platform);
  const listing = run('tar', ['-tzf', tarball]);
  const membership = tarMembersProblems(listing, expected);
  if (membership.length) throw new Error(`the archive is not the recorded artifacts: ${membership.join('; ')}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', out, '--no-same-owner', '--no-same-permissions']);
  const problems = await verifyDirectory(out, registry, platform);
  if (problems.length) { await rm(out, { recursive: true, force: true }); throw new Error(`the archive does not match benchmarks/official-runs.json: ${problems.join('; ')}`); }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const option = name => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  const registry = await loadJson('benchmarks/official-runs.json');
  const archive = await loadJson('benchmarks/official-run-archive.json');
  const platform = archive.platform;
  const scratch = await mkdtemp(path.join(tmpdir(), 'official-run-archive-'));
  try {
    if (command === 'verify') {
      const dir = option('dir');
      if (!dir) throw new Error('verify needs --dir');
      const problems = await verifyDirectory(path.resolve(dir), registry, platform);
      if (problems.length) throw new Error(problems.join('; '));
      console.log(`official run artifacts ok: ${expectedFiles(registry, platform).length} files match the registry`);
    } else if (command === 'fetch') {
      const out = option('out');
      if (!out) throw new Error('fetch needs --out');
      let tarball = option('from');
      if (!tarball) {
        const repo = process.env.GITHUB_REPOSITORY;
        if (!repo) throw new Error('fetch needs GITHUB_REPOSITORY (or --from <tarball>)');
        try {
          run('gh', ['release', 'download', archive.release.tag, '--repo', repo, '--pattern', archive.release.asset, '--dir', scratch]);
        } catch (e) {
          throw new Error(`${e.message}. The archive release ${archive.release.tag} must exist in ${repo} with ${archive.release.asset}; make it with: node scripts/official-run-archive.mjs pack --run ${archive.source.ciRun} --out <dir> (docs/specs/official-runs.md)`);
        }
        tarball = path.join(scratch, archive.release.asset);
      }
      await unpack(path.resolve(tarball), path.resolve(out), registry, platform);
      console.log(`official run artifacts ok: ${expectedFiles(registry, platform).length} files, each the bytes the registry records, in ${out}`);
    } else if (command === 'pack') {
      const id = option('run');
      const out = option('out');
      if (!/^\d+$/.test(id ?? '') || !out) throw new Error('pack needs --run <ci run id> and --out <dir>');
      const download = path.join(scratch, 'download');
      run('gh', ['run', 'download', id, '--repo', 'redact-secret/redact-secret-benchmarks', '--dir', download]);
      const layout = path.join(scratch, 'layout');
      for (const name of archive.source.buildArtifacts) {
        const population = name.replace(/^official-run-/, '');
        for (const rel of [`${population}/artifact.json`, `${population}/methods/artifact.json`]) {
          const from = path.join(download, name, rel.slice(population.length + 1));
          if (await lstat(from).then(i => i.isFile(), () => false)) { await mkdir(path.dirname(path.join(layout, rel)), { recursive: true }); await cp(from, path.join(layout, rel)); }
        }
      }
      const problems = await verifyDirectory(layout, registry, platform);
      if (problems.length) throw new Error(`CI run ${id} is not the run the registry records: ${problems.join('; ')}`);
      await mkdir(path.resolve(out), { recursive: true });
      const tarball = path.join(path.resolve(out), archive.release.asset);
      const members = expectedFiles(registry, platform).map(f => f.rel).sort();
      // COPYFILE_DISABLE keeps macOS tar from adding `._*` metadata members, which the fetch refuses (the first staging publish failed on them).
      run('tar', ['-czf', tarball, '-C', layout, ...members], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
      await unpack(tarball, path.join(scratch, 'roundtrip'), registry, platform);
      console.log(`Wrote ${tarball}, verified against the registry.`);
      console.log(`Keep it (once, by a maintainer):\n  gh release create ${archive.release.tag} ${tarball} --repo redact-secret/redact-secret-benchmarks --target develop --title "Official run artifacts (CI run ${id})" --notes "The canonical ${platform} RunArtifacts recorded in benchmarks/official-runs.json, kept past the 90-day build artifact retention. Verified by byte digest at every use."`);
    } else {
      throw new Error('Usage: official-run-archive.mjs pack --run <id> --out <dir> | fetch --out <dir> [--from <tarball>] | verify --dir <dir>');
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`::error::${error.message}`); process.exit(1); });
}
