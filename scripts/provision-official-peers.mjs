/**
 * Provision the binary peer scanners for an official credential-eval run at the versions and digests pinned in
 * benchmarks/official-runs.json (#604). Downloads each upstream release archive, refuses it unless its SHA-256 equals the
 * pinned archive digest, extracts the executable, refuses it unless its SHA-256 equals the pinned executable digest, and
 * leaves the executables read-only in --out. Put --out first on PATH. Nothing here trusts a scanner's self-update: a
 * binary that is not the pinned one is never left on disk.
 *
 *   node scripts/provision-official-peers.mjs --platform linux-x64 --out peer-bin
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { provisionedExecutables } from './official-run-selection.mjs';

const registry = JSON.parse(readFileSync(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const platform = option('platform'), out = option('out');
if (!platform || !out || !registry.config.platforms[platform]) throw new Error('Usage: provision-official-peers.mjs --platform <linux-x64|darwin-arm64> --out <dir> [--include-optional <scanner>]');
// Only what the effective scanner selection executes (#812): an optional scanner's executable is provisioned on the explicit opt-in only.
const roster = JSON.parse(readFileSync(new URL('../benchmarks/support/scanner-roster.json', import.meta.url), 'utf8'));
const include = args.flatMap((a, i) => a === '--include-optional' ? String(args[i + 1] ?? '').split(',').filter(Boolean) : []);

const ASSET = {
  gitleaks: { 'linux-x64': 'linux_x64', 'darwin-arm64': 'darwin_arm64', url: v => `https://github.com/gitleaks/gitleaks/releases/download/v${v}/gitleaks_${v}_`, name: 'gitleaks' },
  trufflehog: { 'linux-x64': 'linux_amd64', 'darwin-arm64': 'darwin_arm64', url: v => `https://github.com/trufflesecurity/trufflehog/releases/download/v${v}/trufflehog_${v}_`, name: 'trufflehog' },
};
const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
mkdirSync(out, { recursive: true });
chmodSync(out, 0o755);
const work = mkdtempSync(path.join(tmpdir(), 'official-peers-'));
try {
  for (const scanner of provisionedExecutables(registry.scanners, roster, include)) {
    const asset = ASSET[scanner.id];
    if (!asset) throw new Error(`No download rule for ${scanner.id}`);
    const response = await fetch(`${asset.url(scanner.version)}${asset[platform]}.tar.gz`);
    if (!response.ok) throw new Error(`Download of ${scanner.id} failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (sha256(archive) !== scanner.archiveSha256[platform]) throw new Error(`${scanner.id} archive digest ${sha256(archive)} differs from the pinned ${scanner.archiveSha256[platform]}`);
    const file = path.join(work, `${scanner.id}.tgz`);
    writeFileSync(file, archive);
    execFileSync('tar', ['-xzf', file, '-C', work, asset.name]);
    const executable = readFileSync(path.join(work, asset.name));
    if (sha256(executable) !== scanner.executableSha256[platform]) throw new Error(`${scanner.id} executable digest ${sha256(executable)} differs from the pinned ${scanner.executableSha256[platform]}`);
    const target = path.join(out, asset.name);
    writeFileSync(target, executable);
    chmodSync(target, 0o555);
    console.log(`${scanner.id} ${scanner.version} (${platform}): archive and executable match their pins`);
  }
  chmodSync(out, 0o555);
} finally {
  rmSync(work, { recursive: true, force: true });
}
