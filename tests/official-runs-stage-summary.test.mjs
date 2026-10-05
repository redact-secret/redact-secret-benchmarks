import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseTimings, renderStageSummary } from '../scripts/stage-timing-summary.mjs';

test('the stage summary lists each stage in order with its result and a total (#707)', () => {
  const md = renderStageSummary(parseTimings('engine build (cache hit)\t12\t0\nmethods run (2 repeats)\t1700\t1\n'), 'full: x', ['note one']);
  assert.match(md, /^### full: x/);
  assert.match(md, /- note one/);
  assert.match(md, /\| engine build \(cache hit\) \| 12 \| ok \|/);
  assert.match(md, /\| methods run \(2 repeats\) \| 1700 \| failed \(exit 1\) \|/);
  assert.match(md, /\*\*1712\*\*/);
});

test('ci-stage.sh records the timing of a failing stage and keeps its exit status (#707)', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'stage-')), 't.tsv');
  const run = spawnSync('scripts/ci-stage.sh', ['slow peer', '--', 'sh', '-c', 'exit 7'], { env: { ...process.env, STAGE_TIMINGS: file } });
  assert.equal(run.status, 7);
  assert.deepEqual(parseTimings(readFileSync(file, 'utf8')).map(r => [r.name, r.status]), [['slow peer', 7]]);
  assert.equal(execFileSync('scripts/ci-stage.sh', ['x', '--', 'true'], { env: { ...process.env, STAGE_TIMINGS: '' } }).length, 0);
});

test('the workflow exposes the plain artifact before the methods run, caches the engine build and summarises timings (#707)', async () => {
  const yml = (await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  const early = yml.indexOf('name: early-plain-');
  assert.ok(early > 0 && early < yml.indexOf('Methods run, twice'), 'the plain artifact is uploaded before the methods step');
  assert.match(yml, /key: engine-build-.*hashFiles\('credential-eval\/Cargo\.lock'.*steps\.engine\.outputs\.tag/);
  assert.ok(!/STAGE_TIMINGS: \$\{\{/.test(yml), 'the runner context is invalid in job-level env; the timing file is set through GITHUB_ENV');
  assert.match(yml, /stage-timing-summary\.mjs/);
  assert.match(yml, /pattern: official-run-\*/, 'the view still reads only the final official-run artifacts');
});
