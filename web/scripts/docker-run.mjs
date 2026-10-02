/**
 * Runs the web browser checks inside the official Playwright image, the way CI runs them: Linux, the
 * bundled Chromium (never PW_CHANNEL), CI=true, a 4-core cap like a hosted runner. Use it for the final
 * verification before a push: a pass on a Mac with Google Chrome is not a pass on the runner.
 *
 *   node scripts/docker-run.mjs layout   npm run check:layout:docker   build, then check:layout
 *   node scripts/docker-run.mjs e2e      npm run test:e2e:docker       build, then the Playwright suite
 *   node scripts/docker-run.mjs all      npm run check:docker          every step of the web CI job after install
 *   node scripts/docker-run.mjs clean                                  drop this checkout's named volumes
 *
 * What it does: mounts the repository read-only at /src, copies it (without .git, node_modules and build
 * output) to /work inside a throwaway container, installs with `npm ci` (node_modules live in named
 * volumes keyed by this checkout, refreshed only when a lockfile changes, never bind-mounted from the
 * host: wrong architecture and slow), runs the benchmark run and the builds fresh, then the check. The browser checks run on the
 * legacy pipeline's export (the committed authority is flipped in the container's copy only); the committed state is built and recounted
 * last, with no qualification view, as CI does. Nothing is
 * published to the host: the container has its own network namespace, so several agents never clash on
 * a port. Playwright traces of a failure come back in web/test-results.
 *
 * Environment: DOCKER_CPUS (default 4), DOCKER_MEMORY (default 6g), DOCKER_PLATFORM (default native;
 * linux/amd64 is what CI runs but is emulated, so slow, on Apple silicon), PW_IMAGE (override the tag).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const mode = process.argv[2];
if (!['layout', 'e2e', 'all', 'clean'].includes(mode)) {
  console.error('usage: node scripts/docker-run.mjs layout | e2e | all | clean');
  process.exit(2);
}

// The image tag follows the pinned Playwright, so the browser build matches the library that drives it.
const playwright = JSON.parse(readFileSync(path.join(webRoot, 'package.json'), 'utf8')).devDependencies['@playwright/test'];
const image = process.env.PW_IMAGE ?? `mcr.microsoft.com/playwright:v${playwright}-noble`;
const key = createHash('sha256').update(repoRoot).digest('hex').slice(0, 8);
const volumes = { webModules: `rsb-${key}-web-node-modules`, rootModules: `rsb-${key}-root-node-modules`, npmCache: 'rsb-npm-cache' };

const docker = (args, options = {}) => spawnSync('docker', args, { stdio: 'inherit', ...options });

if (mode === 'clean') {
  docker(['volume', 'rm', '-f', volumes.webModules, volumes.rootModules]);
  process.exit(0);
}

const sh = String.raw;
// Mirrors the web job of .github/workflows/validate.yml. `set -e` stops at the first failing step.
const prepare = sh`
set -euo pipefail
export CI=true
mkdir -p /work && cd /work
tar -C /src --exclude=./.git --exclude=./node_modules --exclude=./graft --exclude=./.claude --exclude=./.playwright-mcp \
  --exclude=./web/node_modules --exclude=./web/out --exclude=./web/.next --exclude=./web/storybook-static \
  --exclude=./web/test-results --exclude=./web/coverage --exclude=./public/results/qualification-v1.json -cf - . | tar -xf -
stamp() { sha256sum "$1" | cut -d' ' -f1; }
if [ "$(cat web/node_modules/.lock 2>/dev/null)" != "$(stamp web/package-lock.json)" ]; then (cd web && npm ci --ignore-scripts && stamp package-lock.json > node_modules/.lock); fi
if [ "$(cat node_modules/.lock 2>/dev/null)" != "$(stamp package-lock.json)" ]; then npm ci --ignore-scripts && stamp package-lock.json > node_modules/.lock; fi
node --import tsx scripts/generate-fixtures.mjs --ensure
npm run bench > /dev/null
cd web
`;
// CI has no qualification view, and the committed authority is `new` (#608): the browser checks run on the export of the legacy pipeline,
// built by flipping the one committed value in this container's copy (with-authority.mjs), exactly as the web job does. The committed
// state is built and recounted last. The copy leaves out a view that may sit in a local public/results, as CI has none.
const build = sh`
node scripts/with-authority.mjs legacy -- sh -c 'npm run build && npm run check:routes'
npm run build-storybook
`;
const committed = sh`
npm run build
npm run check:routes
`;
// Each browser check reports its own wall time, apart from install and build.
const timed = (label, command) => `s=$SECONDS; ${command} && r=0 || r=$?; echo "[docker] ${label}: $((SECONDS - s))s"; [ $r -eq 0 ]`;
const layout = timed('check:layout', 'npm run check:layout');
const e2e = timed('test:e2e', 'PW_WORKERS=2 PW_OUTPUT_DIR=/out npm run test:e2e');
// check:layout and the suite share the machine, as in CI: the suite starts first in the background with 2 workers.
const both = sh`
npm run check:no-sx
npm run check:header
npm run typecheck
${build}
(${e2e}) > /tmp/e2e.log 2>&1 & e2e=$!
status=0
${layout} || status=$?
wait $e2e || { status=$?; }
cat /tmp/e2e.log
if [ $status -eq 0 ]; then
${committed}
fi
exit $status
`;
const steps = { layout: `${build}\n${layout}`, e2e: `${build}\n${e2e}`, all: both }[mode];
const script = `${prepare}\nexport WEB_REQUIRE_RUN=1\n${steps}`;

mkdirSync(path.join(webRoot, 'test-results'), { recursive: true });
const name = `rsb-web-${mode}-${process.pid}-${Date.now().toString(36)}`;
// Node inside a container sees the host's cores, not the cap: tell check:layout what a 4 vCPU runner would give it (cores - 1).
const cpus = Number(process.env.DOCKER_CPUS ?? 4);
const args = [
  'run', '--rm', '--init', '--ipc=host', '--name', name,
  `--cpus=${cpus}`, '-e', `LAYOUT_WORKERS=${Math.max(2, cpus - 1)}`, `--memory=${process.env.DOCKER_MEMORY ?? '6g'}`,
  ...(process.env.DOCKER_PLATFORM ? ['--platform', process.env.DOCKER_PLATFORM] : []),
  '-v', `${repoRoot}:/src:ro`,
  '-v', `${volumes.webModules}:/work/web/node_modules`, '-v', `${volumes.rootModules}:/work/node_modules`,
  '-v', `${volumes.npmCache}:/root/.npm`,
  '-v', `${path.join(webRoot, 'test-results')}:/out`,
  image, 'bash', '-c', script,
];
console.log(`docker run ${name} (${image}, ${cpus} cpus): ${mode}`);
const started = Date.now();
const result = docker(args);
console.log(`docker ${mode}: ${((Date.now() - started) / 1000).toFixed(0)}s, exit ${result.status}`);
process.exit(result.status ?? 1);
