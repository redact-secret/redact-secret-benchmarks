/**
 * Rerun one frozen adversarial pack against a locally built product
 * candidate: the benchmark-side "fixed-candidate revalidation" for known gaps
 * whose fixtures live in an adversarial pack rather than the measurement-v4
 * corpus `eval:candidate` covers (docs/decisions/2026-09-18-govern-benchmark-promotion.md).
 *
 * The candidate is installed from the same three immutable tarballs
 * `eval:candidate` takes, with the same isolated installer
 * (scanners/candidate.mjs). Each fixture is scanned alone, exactly as
 * `freeze-adversarial-first-run.mjs` scanned it, and scored with the same
 * `compareResult`. `first-run.json` is never touched.
 *
 * The output records ranges and outcomes only: no fixture content, matched
 * value, raw scanner output, or local path.
 *
 * Run:
 *   node --import tsx scripts/rerun-adversarial-candidate.mjs --pack=<id> \
 *     --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> \
 *     --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex> \
 *     --product-state=clean|dirty --out=<path.json>
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { expectationsDigest, fileDigest, validateIntake, AFTER_FIRST_RUN } from '../benchmarks/lib/adversarial-intake.ts';
import { normalizeFindings } from '../benchmarks/lib/adversarial-first-run.ts';
import { rerunResult, summarizeRerun } from '../benchmarks/lib/adversarial-rerun.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'usage: rerun-adversarial-candidate.mjs --pack=<id> --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex> --product-state=clean|dirty --out=<path.json>';
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--([a-z-]+)=(.+)$/.exec(arg);
  if (!match) throw new Error(usage);
  return [match[1], match[2]];
}));
const required = ['pack', 'candidate-package', 'candidate-node-package', 'candidate-wasm-package', 'candidate-source-commit', 'product-state', 'out'];
if (required.some(key => !args[key]) || Object.keys(args).some(key => !required.includes(key))) throw new Error(usage);
if (!/^[0-9a-f]{40}$/.test(args['candidate-source-commit']) || !['clean', 'dirty'].includes(args['product-state'])) throw new Error(usage);
for (const key of ['candidate-package', 'candidate-node-package', 'candidate-wasm-package']) {
  if (!isAbsolute(args[key])) throw new Error(`${key} must be an absolute path`);
}

const git = gitArgs => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const packDir = join(root, 'adversarial/packs', args.pack);
const record = JSON.parse(readFileSync(join(packDir, 'intake.json'), 'utf8'));
const firstRunBytes = readFileSync(join(packDir, 'first-run.json'), 'utf8');
const problems = validateIntake(record, firstRunBytes);
if (problems.length) throw new Error(`${args.pack} does not validate:\n${problems.join('\n')}`);
if (!AFTER_FIRST_RUN.includes(record.status)) throw new Error(`${args.pack} has no frozen first run (status ${record.status})`);
const firstRun = JSON.parse(firstRunBytes);
const digest = expectationsDigest(record.fixtures);
if (digest !== record.expectations.digest || digest !== firstRun.expectationsDigest) throw new Error('fixtures differ from the frozen expectations');

const benchmarkCommit = git(['rev-parse', 'HEAD']).trim();
const outPath = resolve(args.out);
const dirtyPaths = git(['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean)
  .map(line => line.slice(3)).filter(path => resolve(root, path) !== outPath);
const artifacts = {
  core: sha256(readFileSync(args['candidate-package'])),
  node: sha256(readFileSync(args['candidate-node-package'])),
  wasm: sha256(readFileSync(args['candidate-wasm-package'])),
};

const startedAt = now();
const installation = await installCandidate({ core: args['candidate-package'], node: args['candidate-node-package'], wasm: args['candidate-wasm-package'] });
const results = [];
let version;
try {
  const scanner = await loadCandidate(installation, undefined);
  version = scanner.version;
  for (const fixture of record.fixtures) {
    const input = mkdtempSync(join(tmpdir(), 'adversarial-rerun-'));
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
    results.push(rerunResult(fixture, {
      status: findings ? 'complete' : 'failed',
      findings: findings ? normalizeFindings(findings.filter(f => f.path === fixture.path).map(({ start, end }) => ({ start, end }))) : [],
    }, firstRun));
  }
} finally {
  await removeCandidate(installation);
}

const summary = summarizeRerun(results);
const report = {
  schema: 'redact-secret-benchmarks/adversarial-candidate-rerun-v1',
  runId: randomUUID(),
  packId: args.pack,
  expectationsDigest: digest,
  firstRunSha256: fileDigest(firstRunBytes),
  startedAt,
  finishedAt: now(),
  benchmark: {
    sourceCommit: benchmarkCommit,
    dirty: dirtyPaths.length > 0,
    lockfileSha256: sha256(readFileSync(join(root, 'package-lock.json'))),
  },
  candidate: {
    sourceCommit: args['candidate-source-commit'],
    productState: args['product-state'],
    packageName: installation.packageName,
    declaredVersion: installation.declaredVersion,
    version,
    artifacts: {
      core: { file: basename(args['candidate-package']), sha256: artifacts.core },
      node: { file: basename(args['candidate-node-package']), sha256: artifacts.node },
      wasm: { file: basename(args['candidate-wasm-package']), sha256: artifacts.wasm },
    },
  },
  scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration },
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  command: `node --import tsx scripts/rerun-adversarial-candidate.mjs --pack=${args.pack} --candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=${args['candidate-source-commit']} --product-state=${args['product-state']} --out=<path.json>`,
  status: summary.scannerFailed === 0 ? 'complete' : 'incomplete',
  summary,
  results,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${args.pack} × candidate ${args['candidate-source-commit'].slice(0, 12)} at benchmarks ${benchmarkCommit.slice(0, 12)}${report.benchmark.dirty ? ' (dirty)' : ''}: ${report.status}`);
console.log(`meets expectation: first run ${summary.meetsExpectation.firstRun}/${summary.fixtures}, candidate ${summary.meetsExpectation.candidate}/${summary.fixtures}`);
console.log(`fixed since first run: ${summary.fixedSinceFirstRun.length}; regressed: ${summary.regressedSinceFirstRun.length}${summary.regressedSinceFirstRun.length ? ` (${summary.regressedSinceFirstRun.join(', ')})` : ''}`);
if (report.status !== 'complete') process.exitCode = 1;
