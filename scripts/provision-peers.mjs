/**
 * Provisions the peer scanner binaries at the versions `qualification/suite-v1.json`
 * pins (#183), for local reproduction and for scanner-comparison CI alike.
 *
 * Each release archive is downloaded, checked against the SHA-256 checked in at
 * `scanners/peer-checksums.json` (never against a checksum fetched from the same
 * origin as the archive), and only then extracted and executed. The binaries land in
 * a directory that is made read-only, so a peer cannot self-update in place, and the
 * resolved version and artifact digest are printed (and appended to the GitHub step
 * summary) as evidence.
 *
 * Run: npm run peers:provision -- [--dir <path>]
 * Then: export PATH="<dir>:$PATH"
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const PLATFORMS = { 'linux-x64': 'linux-x64', 'linux-arm64': 'linux-arm64', 'darwin-x64': 'darwin-x64', 'darwin-arm64': 'darwin-arm64' };

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Problems where the checked-in checksums do not cover exactly the suite's peer pins. */
export function checksumTableProblems(suite, table) {
  const problems = [];
  for (const [id, entry] of Object.entries(table)) {
    if (typeof entry !== 'object' || entry === null || !entry.binary) continue;
    if (suite.scanners[id] !== entry.version) problems.push(`scanners/peer-checksums.json carries ${id} ${entry.version}, but qualification/suite-v1.json pins ${suite.scanners[id]}; regenerate the checksums with the pin`);
    for (const [platform, asset] of Object.entries(entry.assets)) if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? '')) problems.push(`${id} ${platform} has no valid sha256`);
  }
  for (const id of Object.keys(suite.scanners)) if (id !== 'redact-secret' && id !== 'flare-redact' && !table[id]) problems.push(`${id} is pinned by the suite but has no checked-in checksums`);
  return problems;
}

/** Fails on mismatch, before anything is extracted or executed. */
export function verifyArchive(id, asset, bytes) {
  const digest = sha256(bytes);
  if (digest !== asset.sha256) throw new Error(`${id} archive ${asset.archive} has sha256 ${digest}; scanners/peer-checksums.json pins ${asset.sha256}. Refusing to extract or run it.`);
  return digest;
}

async function download(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function provision({ dir, platform = `${process.platform}-${process.arch}`, fetchArchive = download, versionOf = defaultVersion } = {}) {
  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const table = JSON.parse(await readFile(path.join(root, 'scanners/peer-checksums.json'), 'utf8'));
  const tableProblems = checksumTableProblems(suite, table);
  if (tableProblems.length) throw new Error(tableProblems.join('\n'));
  if (!PLATFORMS[platform]) throw new Error(`No pinned peer binaries for platform ${platform}`);

  await mkdir(dir, { recursive: true });
  await chmod(dir, 0o755);
  const records = [];
  for (const [id, entry] of Object.entries(table).filter(([, e]) => e && e.binary)) {
    const asset = entry.assets[platform];
    if (!asset) throw new Error(`No pinned ${id} archive for platform ${platform}`);
    const bytes = await fetchArchive(`https://github.com/${entry.repo}/releases/download/v${entry.version}/${asset.archive}`);
    const digest = verifyArchive(id, asset, bytes);
    const work = await mkdtemp(path.join(tmpdir(), `peer-${id}-`));
    try {
      await writeFile(path.join(work, asset.archive), bytes);
      await run('tar', ['xzf', asset.archive, entry.binary], { cwd: work });
      const target = path.join(dir, entry.binary);
      await rm(target, { force: true });
      await writeFile(target, await readFile(path.join(work, entry.binary)), { mode: 0o555 });
    } finally { await rm(work, { recursive: true, force: true }); }
    const observed = await versionOf(id, path.join(dir, entry.binary));
    if (observed !== entry.version) throw new Error(`${id} at ${path.join(dir, entry.binary)} reports ${observed}, expected ${entry.version}`);
    records.push({ id, version: observed, archive: asset.archive, sha256: digest });
  }
  await chmod(dir, 0o555);
  return records;
}

async function defaultVersion(id, binary) {
  const { stdout, stderr } = await run(binary, id === 'gitleaks' ? ['version'] : ['--version', '--no-update']).catch(e => e);
  return /\d+\.\d+\.\d+/.exec(`${stdout ?? ''} ${stderr ?? ''}`)?.[0] ?? 'unknown';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv.indexOf('--dir');
  const dir = path.resolve(flag > 0 ? process.argv[flag + 1] : path.join(root, '.peer-bin'));
  try {
    const records = await provision({ dir });
    const lines = records.map(r => `- ${r.id} \`${r.version}\` (${r.archive}, sha256 \`${r.sha256}\`)`);
    console.log(`Provisioned pinned peers in ${dir} (read-only):\n${lines.join('\n')}\nexport PATH="${dir}:$PATH"`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Pinned peer scanners\n${lines.join('\n')}\n`);
    if (process.env.GITHUB_PATH) await appendFile(process.env.GITHUB_PATH, `${dir}\n`);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
