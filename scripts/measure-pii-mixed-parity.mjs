/**
 * Measure the frozen #427 mixed-document parity plan on every surface a candidate provides (benchmarks #427, core #901).
 *
 * Targets (exactly one per run):
 * - `--target=published` (default): the published `0.1.0-beta.10` release. npm tarballs are packed from the registry and
 *   must match both the lockfile integrity and the release-manifest digests frozen in `evidence/901/pii-gap-ledger-v1.json`;
 *   the macOS arm64 wheel and both `.crate` files must match their manifest SHA-256; the CLI is built from the verified
 *   published crate with its own lockfile, and the Rust runner resolves the verified registry crate.
 * - `--target=core-commit --core-commit=<40-hex> --core-repo=<absolute path>`: an exact clean core commit, built in a
 *   detached worktree with the core repository's own recipe (`benchmark-candidate`: `js:build`, the Node addon build,
 *   `wasm:build` and `wasm:build:common`, then `npm pack`), `maturin build --release --locked` for the wheel and
 *   `cargo build --release --locked -p redact-secret-cli` for the CLI. The Rust runner depends on the checkout by path.
 *
 * Surfaces: Node addon, Node Wasm fallback, browser Wasm (headless Chrome, the package's `browser` import condition
 * reproduced with an import map), Python extension, Rust crate and CLI. Each selection (`pii-on`, `pii-off`) runs in its
 * own process because PII activation is process-wide. No input or output text is written: findings carry type,
 * detector, action, confidence and ranges; outputs are SHA-256 digests plus booleans computed here.
 *
 * Run: node --import tsx scripts/measure-pii-mixed-parity.mjs [--target=published|core-commit] [--core-commit=<sha>]
 *        [--core-repo=<path>] [--surfaces=a,b] [--observation=<file>] [--report=<file>] [--keep-scratch]
 */
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MIXED_PARITY_PLAN_FILES } from '../benchmarks/evaluation/domains/pii/mixed-parity/authoring.ts';
import {
  SELECTIONS, VARIANTS, expectedOutput, loadPlan, materialize, offsetTables, partitions, planCommitment, sha256, targetsFor, variantOf,
} from '../benchmarks/evaluation/domains/pii/mixed-parity/parity.ts';
import { buildMixedParityReport, SURFACES } from '../benchmarks/evaluation/domains/pii/mixed-parity/report.ts';
import { renderMixedParityPlan } from './generate-pii-mixed-parity.mjs';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { packLockfileRelease } from './observe-pii-populations.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(target|core-commit|core-repo|surfaces|observation|report|keep-scratch|plan)(?:=(.+))?$/.exec(argument);
  if (!match) throw new Error(`Unknown argument ${argument}`); return [match[1], match[2] ?? true];
}));
const target = args.target ?? 'published';
if (!['published', 'core-commit'].includes(target)) throw new Error('--target must be published or core-commit');
if (target === 'core-commit' && (!/^[0-9a-f]{40}$/.test(args['core-commit'] ?? '') || !path.isAbsolute(args['core-repo'] ?? '')))
  throw new Error('--target=core-commit needs --core-commit=<40-hex sha> and an absolute --core-repo=<path>');
const surfacesRequested = args.surfaces ? String(args.surfaces).split(',') : SURFACES;
for (const surface of surfacesRequested) if (!SURFACES.includes(surface)) throw new Error(`unknown surface ${surface}`);
// Plan v1 (frozen before any scan, envelopes open) reproduces the beta.10 baseline; plan v2 (envelopes decided by
// redact-secret#930) is the default for a core commit.
const planVersion = Number(args.plan ?? (target === 'published' ? 1 : 2));
const MIXED_PARITY_PLAN_FILE = MIXED_PARITY_PLAN_FILES[planVersion];
if (!MIXED_PARITY_PLAN_FILE) throw new Error('--plan must be 1 or 2');
const defaultStem = target === 'published' ? `evidence/901/427/mixed-parity-published-beta10${planVersion === 1 ? '' : `-plan-v${planVersion}`}` : `evidence/901/427/mixed-parity-core-${String(args['core-commit']).slice(0, 12)}-plan-v${planVersion}`;
const observationFile = path.resolve(root, args.observation ?? `${defaultStem}-observation-v1.json`);
const reportFile = path.resolve(root, args.report ?? `${defaultStem}-report-v1.json`);
const PUBLISHED = { version: '0.1.0-beta.10', pythonVersion: '0.1.0b10', sourceCommit: 'af7f863f29f9fe482dd233c8b7bc5b77dc427314' };
const INCREMENTAL_LIMITS = { maxInput: 1 << 20, maxBuffered: 1 << 16, maxToken: 8192, maxMultiline: 16384 };
const digest = async (file, algorithm = 'sha256') => createHash(algorithm).update(await readFile(file)).digest('hex');
const run = async (command, argv, options = {}) => (await exec(command, argv, { maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60_000, ...options })).stdout;

// 1. Expectations are frozen before any scan: the plan and its derivation must be committed, clean and regenerable.
const frozenPaths = [MIXED_PARITY_PLAN_FILE, 'scripts/generate-pii-mixed-parity.mjs', 'benchmarks/evaluation/domains/pii/mixed-parity/authoring.ts', 'benchmarks/evaluation/domains/pii/mixed-parity/parity.ts'];
if ((await run('git', ['status', '--porcelain', '--', ...frozenPaths], { cwd: root })).trim()) throw new Error('the #427 plan is not committed; freeze expectations before scanning');
if (renderMixedParityPlan(planVersion) !== await readFile(path.join(root, MIXED_PARITY_PLAN_FILE), 'utf8')) throw new Error('the #427 plan drifted from its authored truth');
const planFrozenAt = (await run('git', ['log', '-1', '--format=%H', '--', MIXED_PARITY_PLAN_FILE], { cwd: root })).trim();
const benchmarkCommit = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).trim();
const harnessDirty = Boolean((await run('git', ['status', '--porcelain', '--', 'scripts/measure-pii-mixed-parity.mjs', 'scripts/pii-parity',
  'benchmarks/evaluation/domains/pii/mixed-parity/report.ts'], { cwd: root })).trim());
const plan = loadPlan(MIXED_PARITY_PLAN_FILE);
const documents = materialize(plan);

// 2. Jobs: every document in both line-ending variants, with its partitions and limit probes.
const shapedCases = documents.flatMap(document => VARIANTS.map(variant => ({ key: `${document.id}/${variant}`, document: variantOf(document, variant), variant })));
function jobFor(selection) {
  return { selectors: plan.selections[selection], incrementalLimits: INCREMENTAL_LIMITS, cases: shapedCases.map(({ key, document, variant }) => {
    const { required, optional } = targetsFor(document, selection), bytes = Buffer.byteLength(document.input);
    const wholeLimits = [{ id: 'input-exact', maxInputBytes: bytes, maxFindings: 50_000 }, { id: 'input-under', maxInputBytes: bytes - 1, maxFindings: 50_000 }];
    if (!optional.length) wholeLimits.push({ id: 'findings-exact', maxInputBytes: 1 << 26, maxFindings: required.length },
      ...(required.length > 1 ? [{ id: 'findings-under', maxInputBytes: 1 << 26, maxFindings: required.length - 1 }] : []));
    const inside = partitions(document, variant).find(row => row.id === 'inside-every-target').cuts;
    // Construct limits may not exceed the input limit, so the under-limit probe lowers them with it.
    const under = { ...INCREMENTAL_LIMITS, maxInput: bytes - 1, maxToken: Math.min(INCREMENTAL_LIMITS.maxToken, bytes - 1), maxMultiline: Math.min(INCREMENTAL_LIMITS.maxMultiline, bytes - 1) };
    return { key, input: document.input, partitions: partitions(document, variant).map(({ id, cuts }) => ({ id, cuts })), wholeLimits,
      incrementalFailures: [{ id: 'input-under', limits: under, cuts: inside }] };
  }) };
}
const rustJob = job => [`SEL ${job.selectors.join(' ')}`.trimEnd(), `ILIM ${job.incrementalLimits.maxInput} ${job.incrementalLimits.maxBuffered} ${job.incrementalLimits.maxToken} ${job.incrementalLimits.maxMultiline}`,
  ...job.cases.flatMap(row => [`CASE ${row.key} ${Buffer.from(row.input).toString('hex')}`,
    ...row.partitions.map(p => `PART ${p.id} ${p.cuts.length ? p.cuts.join(',') : '-'}`),
    ...row.wholeLimits.map(l => `WLIM ${l.id} ${l.maxInputBytes} ${l.maxFindings}`),
    ...row.incrementalFailures.map(f => `IFAIL ${f.id} ${f.limits.maxInput} ${f.limits.maxBuffered} ${f.limits.maxToken} ${f.limits.maxMultiline} ${f.cuts.length ? f.cuts.join(',') : '-'}`), 'END'])].join('\n') + '\n';

// 3. Artifacts.
const nodePackage = () => ({ 'darwin-arm64': 'node-darwin-arm64', 'darwin-x64': 'node-darwin-x64', 'linux-x64': 'node-linux-x64-gnu', 'linux-arm64': 'node-linux-arm64-gnu' })[`${process.platform}-${process.arch}`];

async function publishedArtifacts(scratch) {
  const ledger = JSON.parse(await readFile(path.join(root, 'evidence/901/pii-gap-ledger-v1.json'), 'utf8')).finalCandidate;
  if (ledger.version !== PUBLISHED.version || ledger.sourceCommit !== PUBLISHED.sourceCommit) throw new Error('ledger final candidate is not the beta.10 release');
  const rows = artifact => ledger.artifacts.filter(row => row.artifact === artifact);
  const verified = [];
  const npmDir = path.join(scratch, 'npm'); await mkdir(npmDir);
  const tarballs = await packLockfileRelease(npmDir); // also checks the lockfile sha512 integrity
  for (const [role, name] of [['core', 'core'], ['node', nodePackage()], ['wasm', 'wasm']]) {
    const manifest = rows(`npm:@redact-secret/${name}`);
    if (!path.basename(tarballs[role]).includes(PUBLISHED.version)) throw new Error(`lockfile ${name} is not ${PUBLISHED.version}`);
    if (role === 'core') {
      if (manifest.length !== 1 || manifest[0].digest !== await digest(tarballs.core, 'sha1')) throw new Error('core facade does not match the release manifest');
      verified.push({ artifact: manifest[0].artifact, file: 'tarball', algorithm: 'sha1' }); continue;
    }
    const extract = path.join(npmDir, `${role}-x`); await mkdir(extract);
    await run('tar', ['-xzf', tarballs[role], '-C', extract]);
    const files = new Set(await readdir(path.join(extract, 'package')));
    const payload = manifest.filter(row => files.has(row.file));
    if (!payload.some(row => /\.(node|wasm)$/.test(row.file))) throw new Error(`${name} payload is missing`);
    for (const row of payload) {
      if (row.digest !== await digest(path.join(extract, 'package', row.file))) throw new Error(`${name}/${row.file} does not match the release manifest`);
      verified.push({ artifact: row.artifact, file: row.file, algorithm: 'sha256' });
    }
  }
  // Python wheel for this platform.
  const wheelDir = path.join(scratch, 'wheel'); await mkdir(wheelDir);
  await run('python3', ['-m', 'pip', 'download', `redact-secret==${PUBLISHED.pythonVersion}`, '--no-deps', '--only-binary=:all:', '-d', wheelDir, '--quiet']);
  const [wheelName] = (await readdir(wheelDir)).filter(file => file.endsWith('.whl'));
  const wheelRow = rows('pypi:redact-secret').find(row => row.file === wheelName);
  if (!wheelRow || wheelRow.digest !== await digest(path.join(wheelDir, wheelName))) throw new Error('wheel does not match the release manifest');
  verified.push({ artifact: wheelRow.artifact, file: wheelName, algorithm: 'sha256' });
  // Crates: download, verify, build the CLI from its own published lockfile.
  const crateDir = path.join(scratch, 'crates'); await mkdir(crateDir);
  const crates = {};
  for (const name of ['redact-secret', 'redact-secret-cli']) {
    const file = path.join(crateDir, `${name}-${PUBLISHED.version}.crate`);
    await run('curl', ['-sSfL', '-o', file, `https://static.crates.io/crates/${name}/${name}-${PUBLISHED.version}.crate`]);
    const row = rows(`crate:${name}`)[0];
    if (!row || row.digest !== await digest(file)) throw new Error(`${name} crate does not match the release manifest`);
    verified.push({ artifact: row.artifact, file: path.basename(file), algorithm: 'sha256' });
    crates[name] = row.digest;
  }
  await run('tar', ['-xzf', path.join(crateDir, `redact-secret-cli-${PUBLISHED.version}.crate`), '-C', crateDir]);
  const cliSource = path.join(crateDir, `redact-secret-cli-${PUBLISHED.version}`);
  const cliLock = await readFile(path.join(cliSource, 'Cargo.lock'), 'utf8');
  if (!cliLock.includes(`name = "redact-secret"\nversion = "${PUBLISHED.version}"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "${crates['redact-secret']}"`))
    throw new Error('published CLI lockfile does not pin the verified core crate');
  const cliTarget = path.join(scratch, 'cli-target');
  await run('cargo', ['build', '--release', '--locked', '--quiet'], { cwd: cliSource, env: { ...process.env, CARGO_TARGET_DIR: cliTarget } });
  const rustRunner = await buildRustRunner(scratch, `redact-secret = "=${PUBLISHED.version}"`, crates['redact-secret']);
  return { identity: { kind: 'published', version: PUBLISHED.version, sourceCommit: PUBLISHED.sourceCommit, manifestVerification: { ledger: 'evidence/901/pii-gap-ledger-v1.json', verified } },
    tarballs, wheel: path.join(wheelDir, wheelName), cli: path.join(cliTarget, 'release', 'redact-secret'), rustRunner };
}

async function buildRustRunner(scratch, dependency, expectedChecksum) {
  const project = path.join(scratch, 'rust-runner');
  await cp(path.join(root, 'scripts/pii-parity/rust-runner/src'), path.join(project, 'src'), { recursive: true });
  await writeFile(path.join(project, 'Cargo.toml'), `[package]\nname = "pii-parity-rust-runner"\nversion = "0.0.0"\nedition = "2021"\npublish = false\n\n[dependencies]\n${dependency}\n\n[workspace]\n`);
  await run('cargo', ['build', '--release', '--quiet'], { cwd: project, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, 'rust-runner-target') } });
  if (expectedChecksum && !(await readFile(path.join(project, 'Cargo.lock'), 'utf8')).includes(`checksum = "${expectedChecksum}"`)) throw new Error('rust runner did not resolve the verified crate');
  return path.join(scratch, 'rust-runner-target', 'release', 'pii-parity-rust-runner');
}

async function coreCommitArtifacts(scratch) {
  const repo = args['core-repo'], commit = args['core-commit'], checkout = path.join(scratch, 'core');
  await run('git', ['-C', repo, 'fetch', '--quiet', 'origin', commit]).catch(() => {});
  await run('git', ['-C', repo, 'worktree', 'add', '--detach', checkout, commit]);
  try {
    if ((await run('git', ['rev-parse', 'HEAD'], { cwd: checkout })).trim() !== commit) throw new Error('core checkout head mismatch');
    const env = { ...process.env, npm_config_update_notifier: 'false' };
    // The core repository's own candidate recipe (scripts/benchmark-candidate.mjs buildCandidate).
    await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: checkout, env });
    await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: path.join(checkout, 'bindings/node'), env });
    await run(npm, ['run', 'js:build'], { cwd: checkout, env });
    await run(npm, ['run', 'build'], { cwd: path.join(checkout, 'bindings/node'), env });
    const wasmOut = path.join(scratch, 'wasm-output'), wasmCommonOut = path.join(scratch, 'wasm-common-output'), packDir = path.join(scratch, 'npm');
    await run(npm, ['run', 'wasm:build', '--', '--out-dir', wasmOut], { cwd: checkout, env });
    await run(npm, ['run', 'wasm:build:common', '--', '--out-dir', wasmCommonOut], { cwd: checkout, env });
    await mkdir(packDir);
    const pack = async directory => path.join(packDir, JSON.parse(await run(npm, ['pack', '--json', '--pack-destination', packDir], { cwd: directory, env }))[0].filename);
    const core = await pack(path.join(checkout, 'packages/javascript'));
    const suffix = nodePackage().replace('node-', '');
    const nodeManifest = JSON.parse(await readFile(path.join(checkout, 'bindings/node/npm', suffix, 'package.json'), 'utf8'));
    const nodeStage = path.join(scratch, 'node-package'); await cp(path.join(checkout, 'bindings/node/npm', suffix), nodeStage, { recursive: true });
    await cp(path.join(checkout, 'bindings/node', nodeManifest.main), path.join(nodeStage, nodeManifest.main));
    const node = await pack(nodeStage);
    const wasmStage = path.join(scratch, 'wasm-package'); await cp(path.join(checkout, 'bindings/wasm/npm'), wasmStage, { recursive: true });
    await cp(wasmOut, wasmStage, { recursive: true }); await cp(wasmCommonOut, wasmStage, { recursive: true });
    const wasm = await pack(wasmStage);
    const wheelDir = path.join(scratch, 'wheel');
    await run('maturin', ['build', '--release', '--locked', '--quiet', '-m', 'bindings/python/Cargo.toml', '-o', wheelDir], { cwd: checkout });
    const [wheelName] = (await readdir(wheelDir)).filter(file => file.endsWith('.whl'));
    await run('cargo', ['build', '--release', '--locked', '--quiet', '-p', 'redact-secret-cli'], { cwd: checkout, env: { ...process.env, CARGO_TARGET_DIR: path.join(scratch, 'core-target') } });
    const cli = path.join(scratch, 'core-target', 'release', 'redact-secret');
    const rustRunner = await buildRustRunner(scratch, `redact-secret = { path = "${path.join(checkout, 'crates/secret-scan-core')}" }`, null);
    const components = { core: await digest(core), node: await digest(node), wasm: await digest(wasm), wheel: await digest(path.join(wheelDir, wheelName)), cli: await digest(cli) };
    return { identity: { kind: 'core-commit', version: JSON.parse(await readFile(path.join(checkout, 'packages/javascript/package.json'), 'utf8')).version, sourceCommit: commit,
      coreCrateTree: (await run('git', ['rev-parse', `${commit}:crates/secret-scan-core`], { cwd: checkout })).trim(), components },
      tarballs: { core, node, wasm }, wheel: path.join(wheelDir, wheelName), cli, rustRunner, cleanup: async () => run('git', ['-C', repo, 'worktree', 'remove', '--force', checkout]) };
  } catch (error) { await run('git', ['-C', repo, 'worktree', 'remove', '--force', checkout]).catch(() => {}); throw error; }
}

// 4. Surfaces. Each returns { identity, cases } per selection with texts still present (they never leave this process).
async function nodeSurface(scratch, tarballs, artifact) {
  const installation = await installCandidate(tarballs);
  try {
    if (artifact === 'wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const results = {};
    for (const selection of SELECTIONS) {
      const jobFile = path.join(scratch, `job-${artifact}-${selection}.json`), outFile = path.join(scratch, `out-${artifact}-${selection}.json`);
      await writeFile(jobFile, JSON.stringify(jobFor(selection)));
      await run(process.execPath, [path.join(root, 'scripts/pii-parity/node-child.mjs'), installation.root, artifact, jobFile, outFile]);
      results[selection] = JSON.parse(await readFile(outFile, 'utf8'));
    }
    return { status: 'observed', results, unit: 'utf16-code-units' };
  } finally { await removeCandidate(installation); }
}

function chromePath() {
  for (const candidate of [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'])
    if (candidate && existsSync(candidate)) return candidate;
  return null;
}

async function browserSurface(scratch, tarballs) {
  const chrome = chromePath();
  if (!chrome) return { status: 'not-run', reason: 'no-headless-browser-on-host' };
  const installation = await installCandidate(tarballs);
  try {
    const moduleRoot = path.join(installation.root, 'node_modules');
    const page = `<!doctype html><meta charset="utf-8"><title>pii-427</title>
<script type="importmap">${JSON.stringify({ imports: { '#native': '/m/@redact-secret/core/dist/runtime/browser.js', '@redact-secret/wasm': '/m/@redact-secret/wasm/redact_secret_wasm.js' } })}</script>
<script type="module">
import * as api from '/m/@redact-secret/core/dist/index.js';
import { runJob } from '/runner/js-runner.mjs';
const post = body => fetch('/result', { method: 'POST', body: JSON.stringify(body) });
try {
  const job = await (await fetch('/job')).json();
  await api.initialize(job.selectors.length ? { pii: job.selectors } : {});
  if (api.artifact() !== 'wasm') throw new Error('browser did not load wasm');
  await post(runJob(api, job));
} catch (error) { await post({ error: String((error && error.code) || error) }); }
</script>`;
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.html': 'text/html' };
    const results = {}; let version = null;
    for (const selection of SELECTIONS) {
      const job = JSON.stringify(jobFor(selection));
      let resolveResult; const received = new Promise(resolve => { resolveResult = resolve; });
      const server = createServer(async (request, response) => {
        try {
          const url = new URL(request.url, 'http://127.0.0.1');
          if (url.pathname === '/result') { const body = []; for await (const part of request) body.push(part); response.end('ok'); resolveResult(JSON.parse(Buffer.concat(body).toString('utf8'))); return; }
          if (url.pathname === '/') { response.setHeader('content-type', 'text/html'); response.end(page); return; }
          if (url.pathname === '/job') { response.setHeader('content-type', 'application/json'); response.end(job); return; }
          const file = url.pathname.startsWith('/m/') ? path.join(moduleRoot, url.pathname.slice(3)) : url.pathname === '/runner/js-runner.mjs' ? path.join(root, 'scripts/pii-parity/js-runner.mjs') : null;
          if (!file || !file.startsWith(moduleRoot) && !file.endsWith('js-runner.mjs')) { response.statusCode = 404; response.end(); return; }
          response.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
        } catch { response.statusCode = 404; response.end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const profile = path.join(scratch, `chrome-${selection}`);
      const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
        `http://127.0.0.1:${server.address().port}/`], { stdio: 'ignore' });
      const timeout = setTimeout(() => resolveResult({ error: 'browser-timeout' }), 15 * 60_000);
      try { results[selection] = await received; } finally { clearTimeout(timeout); browser.kill('SIGKILL'); server.close(); }
      if (results[selection].error) throw new Error(`browser surface failed: ${results[selection].error}`);
    }
    version = (await run(chrome, ['--version'])).trim();
    return { status: 'observed', results, unit: 'utf16-code-units', runtime: version };
  } finally { await removeCandidate(installation); }
}

async function pythonSurface(scratch, wheel) {
  const venv = path.join(scratch, 'venv');
  await run('python3', ['-m', 'venv', venv]);
  const python = path.join(venv, 'bin', 'python');
  await run(python, ['-m', 'pip', 'install', '--quiet', '--no-deps', '--no-index', wheel]);
  const results = {};
  for (const selection of SELECTIONS) {
    const jobFile = path.join(scratch, `job-python-${selection}.json`), outFile = path.join(scratch, `out-python-${selection}.json`);
    await writeFile(jobFile, JSON.stringify(jobFor(selection)));
    await run(python, [path.join(root, 'scripts/pii-parity/python_runner.py'), jobFile, outFile]);
    results[selection] = JSON.parse(await readFile(outFile, 'utf8'));
  }
  return { status: 'observed', results, unit: 'unicode-code-points', runtime: (await run(python, ['--version'])).trim() };
}

const fromHex = value => Buffer.from(value, 'hex').toString('utf8');
function unhexResult(result) {
  const fix = op => { if (op && typeof op.textHex === 'string') { op.text = fromHex(op.textHex); delete op.textHex; } return op; };
  for (const row of result.cases) {
    fix(row.redact); fix(row.scanAndRedact); row.partitions.forEach(fix); row.incrementalFailures.forEach(fix);
    for (const limit of row.wholeLimits) { fix(limit.redact); fix(limit.scanAndRedact); }
  }
  return result;
}

async function rustSurface(scratch, runner) {
  const results = {};
  for (const selection of SELECTIONS) {
    const jobFile = path.join(scratch, `job-rust-${selection}.txt`), outFile = path.join(scratch, `out-rust-${selection}.json`);
    await writeFile(jobFile, rustJob(jobFor(selection)));
    await run(runner, [jobFile, outFile]);
    results[selection] = unhexResult(JSON.parse(await readFile(outFile, 'utf8')));
  }
  return { status: 'observed', results, unit: 'utf8-bytes', runtime: (await run('rustc', ['--version'])).trim() };
}

function spawnCollect(command, argv, chunks, delayMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { stdio: ['pipe', 'pipe', 'pipe'] }); const out = [];
    child.stdout.on('data', data => out.push(data)); child.stderr.on('data', () => {});
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout: Buffer.concat(out).toString('utf8') }));
    (async () => {
      for (const chunk of chunks) { child.stdin.write(chunk); if (delayMs) await new Promise(r => setTimeout(r, delayMs)); }
      child.stdin.end();
    })().catch(reject);
  });
}

async function cliSurface(scratch, cli) {
  const results = {};
  for (const selection of SELECTIONS) {
    const job = jobFor(selection), flags = job.selectors.flatMap(selector => ['--pii', selector]);
    const activation = (await spawnCollect(cli, ['--print-pii-activation', ...flags], [], 0)).stdout.trim();
    let rangeUnit = null, version = null;
    const cases = [];
    for (const row of job.cases) {
      const file = path.join(scratch, `cli-${selection}-${row.key.replace('/', '-')}.txt`); await writeFile(file, row.input);
      const check = await spawnCollect(cli, ['--json', ...flags, '--', file], [], 0);
      let scan;
      if (check.code === 0 || check.code === 1) {
        const report = JSON.parse(check.stdout); rangeUnit = report.rangeUnit; version = report.version;
        scan = report.failures.length ? { status: 'error', errorCode: report.failures[0].code }
          : { status: 'ok', findings: report.sources[0].findings.map(f => ({ type: f.type, detector: f.detector, action: f.action, confidence: f.confidence, start: f.start, end: f.end })) };
      } else scan = { status: 'error', errorCode: `exit-${check.code}` };
      const redactPath = await spawnCollect(cli, ['--redact', ...flags, '--', file], [], 0);
      const stdinWhole = await spawnCollect(cli, ['--redact', ...flags], [Buffer.from(row.input)], 0);
      const inside = row.partitions.find(p => p.id === 'inside-every-target').cuts;
      const points = Array.from(row.input), paced = []; let previous = 0;
      for (const cut of [...inside, points.length]) { paced.push(Buffer.from(points.slice(previous, cut).join(''))); previous = cut; }
      const stdinPaced = await spawnCollect(cli, ['--redact', ...flags], paced, 25);
      const asOp = result => result.code === 0 ? { status: 'ok', text: result.stdout } : { status: 'error', errorCode: `exit-${result.code}`, text: result.stdout };
      cases.push({ key: row.key, scan, scanAndRedact: { ...asOp(redactPath), findings: null },
        partitions: [{ id: 'cli-stdin-single-write', ...asOp(stdinWhole), findings: null }, { id: 'cli-stdin-paced-inside-every-target', ...asOp(stdinPaced), findings: null }] });
    }
    results[selection] = { identity: { rangeUnit, version, artifact: 'cli-binary', piiActivation: activation }, cases };
  }
  return { status: 'observed', results, unit: 'utf8-bytes',
    notApplicable: { redact: 'the CLI has no separate redact(findings) operation', wholeLimits: 'the CLI declares fixed limits; no caller-supplied whole-input limit',
      incrementalFailures: 'the CLI declares fixed incremental limits', partitions: 'chunking is the CLI read loop; only a single stdin write and a paced write are driven' } };
}

// 5. Normalize: ranges to UTF-8 (range-unit errors counted), outputs to digests, leak booleans, partitions deduplicated.
const caseByKey = new Map(shapedCases.map(row => [row.key, row]));
function normalize(surfaceRun) {
  const selections = {};
  for (const selection of SELECTIONS) {
    const result = surfaceRun.results[selection], cases = {};
    for (const row of result.cases) {
      const { document } = caseByKey.get(row.key), tables = offsetTables(document.input);
      // A value is left behind when the output holds more copies of it than the expected bytes do (a value can
      // legitimately recur elsewhere, e.g. on an optional or non-sensitive line).
      const replacingTargets = targetsFor(document, selection).required.filter(target => target.action !== 'warn');
      const occurrences = (text, value) => text.split(value).length - 1;
      const reference = expectedOutput(document, selection, []);
      const values = replacingTargets.map(target => { const value = Buffer.from(document.input).subarray(target.start, target.end).toString('utf8');
        return [target.id, value, occurrences(reference, value)]; });
      const leaks = text => values.filter(([, value, allowed]) => occurrences(text, value) > allowed).map(([id]) => id);
      const op = observed => {
        if (!observed) return { status: 'not-applicable' };
        if (observed.status !== 'ok') return { status: 'error', errorCode: observed.errorCode };
        let rangeUnitErrors = 0;
        const findings = observed.findings === null || observed.findings === undefined ? null : observed.findings.map(f => {
          const start = tables.toUtf8(f.start, surfaceRun.unit), end = tables.toUtf8(f.end, surfaceRun.unit);
          if (start === null || end === null) rangeUnitErrors += 1;
          return { type: f.type, detector: f.detector, action: f.action, confidence: f.confidence ?? null, start: start ?? -1, end: end ?? -1, native: [f.start, f.end] };
        });
        const text = typeof observed.text === 'string' ? observed.text : null;
        return { status: 'ok', findings, outputSha256: text === null ? null : sha256(text),
          valueLeft: text === null ? [] : leaks(text), rangeUnitErrors };
      };
      const whole = row.scanAndRedact && row.scanAndRedact.status === 'ok' ? row.scanAndRedact.text : null;
      const signatures = {}, byPartition = {};
      for (const partition of row.partitions ?? []) {
        const normalized = { ...op(partition), state: partition.state ?? null };
        const key = sha256(JSON.stringify(normalized)).slice(0, 16); signatures[key] = normalized; byPartition[partition.id] = key;
      }
      cases[row.key] = {
        scan: op(row.scan), redact: row.redact ? op(row.redact) : { status: 'not-applicable', reason: surfaceRun.notApplicable?.redact },
        scanAndRedact: op(row.scanAndRedact), incremental: { partitions: byPartition, signatures },
        wholeLimits: row.wholeLimits ? row.wholeLimits.map(limit => ({ id: limit.id,
          scan: limit.scan.status === 'ok' ? { status: 'ok', count: limit.scan.count } : { status: 'error', errorCode: limit.scan.errorCode },
          redact: limit.redact.status === 'ok' ? { status: 'ok', outputSha256: sha256(limit.redact.text) } : { status: 'error', errorCode: limit.redact.errorCode },
          scanAndRedact: limit.scanAndRedact.status === 'ok' ? { status: 'ok', outputSha256: sha256(limit.scanAndRedact.text) } : { status: 'error', errorCode: limit.scanAndRedact.errorCode } }))
          : { status: 'not-applicable', reason: surfaceRun.notApplicable?.wholeLimits },
        incrementalFailures: row.incrementalFailures ? row.incrementalFailures.map(failure => ({ id: failure.id, status: failure.status, errorCode: failure.errorCode ?? null, state: failure.state,
          emittedBytes: Buffer.byteLength(failure.text ?? ''), emittedIsPrefixOfWholeOutput: whole === null ? null : whole.startsWith(failure.text ?? ''),
          emittedLeaks: leaks(failure.text ?? '') }))
          : { status: 'not-applicable', reason: surfaceRun.notApplicable?.incrementalFailures },
      };
    }
    selections[selection] = { identity: result.identity, cases };
  }
  return selections;
}

const scratch = await mkdtemp(path.join(tmpdir(), 'pii-427-parity-'));
let artifacts;
try {
  artifacts = target === 'published' ? await publishedArtifacts(scratch) : await coreCommitArtifacts(scratch);
  console.log(`artifacts ready: ${artifacts.identity.kind} ${artifacts.identity.sourceCommit}`);
  const surfaces = [];
  for (const surface of SURFACES) {
    if (!surfacesRequested.includes(surface)) { surfaces.push({ surface, status: 'not-run', reason: 'not-requested' }); continue; }
    const started = Date.now();
    const observed = surface === 'node-addon' ? await nodeSurface(scratch, artifacts.tarballs, 'addon')
      : surface === 'node-wasm' ? await nodeSurface(scratch, artifacts.tarballs, 'wasm')
      : surface === 'browser-wasm' ? await browserSurface(scratch, artifacts.tarballs)
      : surface === 'python' ? await pythonSurface(scratch, artifacts.wheel)
      : surface === 'rust' ? await rustSurface(scratch, artifacts.rustRunner)
      : await cliSurface(scratch, artifacts.cli);
    if (observed.status !== 'observed') { surfaces.push({ surface, status: observed.status, reason: observed.reason }); continue; }
    surfaces.push({ surface, status: 'observed', unit: observed.unit, runtime: observed.runtime ?? null, notApplicable: observed.notApplicable ?? null, selections: normalize(observed) });
    console.log(`${surface}: observed in ${Math.round((Date.now() - started) / 1000)} s`);
  }
  const observation = {
    schemaVersion: 1, reportType: 'pii-mixed-parity-observation', supportClaims: false, issue: 'redact-secret/redact-secret-benchmarks#427',
    plan: { path: MIXED_PARITY_PLAN_FILE, frozenAt: planFrozenAt, commitment: planCommitment(plan) },
    benchmark: { commit: benchmarkCommit, harnessDirty }, target: artifacts.identity,
    platform: `${process.platform}-${process.arch}`, node: process.version, incrementalLimits: INCREMENTAL_LIMITS, surfaces,
  };
  await mkdir(path.dirname(observationFile), { recursive: true });
  await writeFile(observationFile, `${JSON.stringify(observation)}\n`);
  const report = buildMixedParityReport(observation);
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  for (const row of report.surfaceSummary) console.log(JSON.stringify(row));
  console.log(JSON.stringify(report.acceptance));
} finally {
  if (artifacts?.cleanup) await artifacts.cleanup().catch(() => {});
  if (!args['keep-scratch']) await rm(scratch, { recursive: true, force: true });
  else console.log(`scratch kept at ${scratch}`);
}
