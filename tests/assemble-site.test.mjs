import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assembleSite } from '../scripts/assemble-site.mjs';

const FILES = {
  'index.html': '<h1>x</h1>', 'robots.txt': 'User-agent: *\nAllow: /\n', 'favicon.svg': '<svg/>', '404.html': 'nf',
  'report/index.html': 'r', 'evaluation/qualification/index.html': 'q', '_next/static/a.js': 'a',
};

async function fixture(overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'assemble-'));
  const webOut = path.join(dir, 'out'); const results = path.join(dir, 'results');
  for (const [file, text] of Object.entries({ ...FILES, ...overrides })) {
    if (text === null) continue;
    await mkdir(path.dirname(path.join(webOut, file)), { recursive: true });
    await writeFile(path.join(webOut, file), text);
  }
  await mkdir(results, { recursive: true });
  await writeFile(path.join(results, 'run.json'), '{}');
  return { dir, webOut, results, out: path.join(dir, 'dist') };
}

test('the export becomes the root and the measured files sit at /results/', async () => {
  const f = await fixture();
  try {
    const { files } = await assembleSite(f);
    assert.equal(files, 8);
    assert.equal(await readFile(path.join(f.out, 'index.html'), 'utf8'), '<h1>x</h1>');
    assert.equal(await readFile(path.join(f.out, 'results/run.json'), 'utf8'), '{}');
    await assert.rejects(stat(path.join(f.out, 'next')));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('a missing robots.txt, favicon, qualification page or run is refused before anything is written', async () => {
  for (const missing of ['robots.txt', 'favicon.svg', 'evaluation/qualification/index.html', 'index.html']) {
    const f = await fixture({ [missing]: null });
    try {
      await assert.rejects(assembleSite(f), new RegExp(missing.replace('.', '\\.')));
      await assert.rejects(stat(f.out));
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  }
  const f = await fixture();
  try { await rm(path.join(f.results, 'run.json')); await assert.rejects(assembleSite(f), /no run\.json/); } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('an export that owns results/, or names the retired /next/ prefix, is refused', async () => {
  let f = await fixture({ 'results/x.json': '{}' });
  try { await assert.rejects(assembleSite(f), /own results/); } finally { await rm(f.dir, { recursive: true, force: true }); }
  f = await fixture({ 'report/index.html': '<a href="/next/report/">x</a>' });
  try { await assert.rejects(assembleSite(f), /retired \/next\/ prefix/); } finally { await rm(f.dir, { recursive: true, force: true }); }
  f = await fixture({ 'assets/x.js': '1' });
  try { await assert.rejects(assembleSite(f), /legacy build output/); } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('a /next/ string in the measured data is not the export\'s concern', async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.results, 'x.json'), '{"note":"\\"/next/\\""}');
    await assembleSite(f);
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});
