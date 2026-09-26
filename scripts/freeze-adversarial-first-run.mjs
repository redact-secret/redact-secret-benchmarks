/**
 * Freeze the first run of one adversarial pack (#140, contract #139).
 *
 * Run every evaluated scanner once over the pack as submitted, write
 * `first-run.json` (ranges only: no matched values, no raw output), pin its
 * SHA-256 in the intake record, and move the pack to `frozen-first-run`.
 *
 * Preconditions, all checked:
 * - the pack is at `safety-review` with a passed review;
 * - its fixtures are byte-identical to the ones committed at HEAD, so the
 *   recorded benchmark commit holds the expectations that were scored;
 * - peer scanners match the qualification suite pins (#180), and the product
 *   package is the pinned version.
 *
 * Each fixture is scanned alone at its submitted path. Artifact digests: npm packages by the SHA-256 of their registry tarball,
 * checked against the package-lock integrity; binaries by the SHA-256 of the
 * executable that ran.
 *
 * Run: node --import tsx scripts/freeze-adversarial-first-run.mjs --pack=<id>
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners } from '../scanners/index.mjs';
import { assertPinnedPeers } from '../scanners/pins.mjs';
import { expectationsDigest, fileDigest, validateIntake } from '../benchmarks/lib/adversarial-intake.ts';
import { normalizeFindings } from '../benchmarks/lib/adversarial-first-run.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const packId = process.argv.find(arg => arg.startsWith('--pack='))?.slice('--pack='.length);
if (!packId) throw new Error('usage: freeze-adversarial-first-run.mjs --pack=<id>');
const packDir = join(root, 'adversarial/packs', packId);
const intakePath = join(packDir, 'intake.json');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const record = JSON.parse(readFileSync(intakePath, 'utf8'));
if (record.status !== 'safety-review' || record.safetyReview?.outcome !== 'passed') {
  throw new Error(`${packId} must be at safety-review with a passed review (is ${record.status})`);
}
const benchmarkCommit = git(['rev-parse', 'HEAD']).trim();
const committed = JSON.parse(git(['show', `HEAD:adversarial/packs/${packId}/intake.json`]));
const digest = expectationsDigest(record.fixtures);
if (expectationsDigest(committed.fixtures) !== digest || digest !== record.expectations.digest) {
  throw new Error('fixtures differ from HEAD or from the submitted digest; commit the submission before freezing');
}

const suite = JSON.parse(readFileSync(join(root, 'qualification/suite-v1.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

function npmArtifact(name) {
  const entry = lock.packages[`node_modules/${name}`];
  const dir = mkdtempSync(join(tmpdir(), 'adversarial-artifact-'));
  try {
    const [packed] = JSON.parse(execFileSync('npm', ['pack', `${name}@${entry.version}`, '--json', '--pack-destination', dir], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const bytes = readFileSync(join(dir, packed.filename));
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    if (integrity !== entry.integrity) throw new Error(`${name}@${entry.version} tarball does not match the package-lock integrity`);
    return { version: entry.version, digest: sha256(bytes), integrity };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function binaryArtifact(binary) {
  const path = realpathSync(execFileSync('which', [binary], { encoding: 'utf8' }).trim());
  return sha256(readFileSync(path));
}

await assertPinnedPeers(scanners, suite, root);
const product = scanners.find(s => s.id === 'redact-secret');
if (await product.version() !== suite.scanners['redact-secret']) {
  throw new Error(`@redact-secret/core is ${await product.version()}, but the suite pins ${suite.scanners['redact-secret']}`);
}

const identities = {};
for (const scanner of scanners) {
  if (scanner.id === 'redact-secret' || scanner.id === 'flare-redact') {
    const name = scanner.id === 'redact-secret' ? '@redact-secret/core' : 'flare-redact';
    const artifact = npmArtifact(name);
    identities[scanner.id] = {
      version: artifact.version,
      artifactDigest: `sha256:${artifact.digest}`,
      configuration: `${scanner.mode}; npm ${name}@${artifact.version} (${artifact.integrity}); ${JSON.stringify(scanner.configuration)}`,
    };
  } else {
    identities[scanner.id] = {
      version: await scanner.version(root),
      artifactDigest: `sha256:${binaryArtifact(scanner.configuration.binary)}`,
      configuration: `${scanner.mode}; ${JSON.stringify(scanner.configuration)}`,
    };
  }
}

// Each fixture is scanned alone, at its own path, so one unmappable finding
// fails that fixture × scanner only, never the whole pack.
const results = [];
for (const scanner of scanners) {
  for (const fixture of record.fixtures) {
    const input = mkdtempSync(join(tmpdir(), 'adversarial-first-run-'));
    let findings = null;
    try {
      mkdirSync(dirname(join(input, fixture.path)), { recursive: true });
      writeFileSync(join(input, fixture.path), fixture.content);
      findings = await scanner.scan(input, [{ path: fixture.path, content: fixture.content }]);
    } catch {
      // Recorded as failed; the scanner's output is never kept.
    } finally {
      rmSync(input, { recursive: true, force: true });
    }
    results.push({
      fixtureId: fixture.id,
      scanner: scanner.id,
      status: findings ? 'complete' : 'failed',
      findings: findings ? normalizeFindings(findings.filter(f => f.path === fixture.path).map(({ start, end }) => ({ start, end }))) : [],
    });
  }
}

const recordedAt = now();
const firstRun = {
  schemaVersion: 1,
  packId,
  expectationsDigest: digest,
  recordedAt,
  benchmarkCommit,
  scanners: scanners.map(s => ({ name: s.id, ...identities[s.id] })),
  results,
};
const firstRunBytes = `${JSON.stringify(firstRun, null, 2)}\n`;
writeFileSync(join(packDir, 'first-run.json'), firstRunBytes);

record.firstRun = { path: 'first-run.json', sha256: fileDigest(firstRunBytes) };
record.history.push({ status: 'frozen-first-run', at: recordedAt, by: record.safetyReview.reviewer });
record.status = 'frozen-first-run';
const problems = validateIntake(record, firstRunBytes);
if (problems.length) throw new Error(`frozen record does not validate:\n${problems.join('\n')}`);
writeFileSync(intakePath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Froze ${packId}: ${record.fixtures.length} fixtures × ${scanners.length} scanners at ${benchmarkCommit} (${recordedAt}).`);
for (const s of firstRun.scanners) console.log(`- ${s.name} ${s.version} ${s.artifactDigest}`);
