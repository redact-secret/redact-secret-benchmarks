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

const D = n => `sha256:${String(n).padStart(64, '0')}`;
function currentMeasurement() {
  const evidence = { source: 'synthetic', revision: 'r1', evidence_schema: 'synthetic/1', corpus_digest: D(1), release: { tag: 'r1', manifest_digest: D(2) } };
  const distribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  const stableDistribution = { documented: 0, empirical: 0, 'policy-qualified': 0 };
  const view = {
    schema: 'redact-secret/qualification-view/v1', adapter: { id: 'synthetic', version: 1 }, publication: 'public',
    policy: { id: 'synthetic', revision: `rs-policy-1:${D(3)}`, components: [], scanner: 'redact-secret', populations: { 'pop-a': 'floors-and-gates' }, methodsRequired: [], criteria: {}, fixtureProfilesVersion: 1, rules: [], differentialPeers: [], attributionFallback: [], axisCoverage: { populations: ['pop-a'] } },
    populations: [{ population: 'pop-a', role: 'floors-and-gates', denominator: 'pop-a', runClass: 'public', unattributed: [], aggregates: [], cases: [], artifact: {
      artifactDigest: D(4), semanticDigest: D(5), schema: 'credential-eval/run-artifact/v1', engine: { name: 'credential-eval', version: '9.9.9' }, protocolVersion: '1', configHash: D(6), evidence, engineRunClass: 'official', publication: 'public', methods: [], caseCount: 0,
      scanners: [{ id: 'redact-secret', version: '1.0.0', mode: 'default', build: 'released', adapter: { id: 'synthetic', version: '1' }, configurationHash: D(7), status: 'complete' }],
    } }], scanners: [], distribution, stableDistribution, families: [], supportMatrix: { distribution, stableDistribution, families: [] }, undetected: [], knownGaps: [], unmappedFamilies: [],
  };
  const registry = { engine: { version: '9.9.9' }, scanners: [{ id: 'redact-secret', version: '1.0.0' }], populations: [{ id: 'pop-a', evidence: { revision: 'r1', corpusDigest: D(1), release: { tag: 'r1', manifestDigest: D(2) } } }], runs: [{ id: 'pop-a@linux-x64', population: 'pop-a', canonical: true, platform: 'linux-x64', artifact: { semanticDigest: D(5) } }] };
  return { view, publicationContext: { registry, taxonomy: [], policyRevision: view.policy.revision, roster: { required: ['redact-secret'], optional: [] } } };
}

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

test('new authority publishes only a pinned official engine view without requiring legacy run.json', async () => {
  const f = await fixture();
  try {
    const { view, publicationContext } = currentMeasurement();
    await rm(path.join(f.results, 'run.json'));
    await writeFile(path.join(f.results, 'qualification-v1.json'), JSON.stringify(view));
    await assembleSite({ ...f, credentialAuthority: 'new', publicationContext });
    assert.deepEqual(JSON.parse(await readFile(path.join(f.out, 'results/qualification-v1.json'), 'utf8')), view);
    await assert.rejects(stat(path.join(f.out, 'results/run.json')));
  } finally { await rm(f.dir, { recursive: true, force: true }); }
});

test('new authority refuses missing, malformed, unrecorded, wrong-product and wrong-evidence views before writing', async () => {
  const mutations = [
    () => undefined, () => ({}),
    v => { v.populations[0].artifact.semanticDigest = D(99); return v; },
    v => { v.populations[0].artifact.evidence.corpus_digest = D(99); return v; },
    v => { v.populations[0].artifact.scanners[0].version = '2.0.0'; return v; },
    v => { v.populations[0].artifact.engineRunClass = 'exploratory'; return v; },
    v => { v.publication = 'internal'; return v; },
    v => { v.policy.revision = `rs-policy-1:${D(99)}`; return v; },
    v => { v.populations[0].artifact.scanners = []; return v; },
    v => { v.populations = []; return v; },
  ];
  for (const mutate of mutations) {
    const f = await fixture();
    try {
      const { view, publicationContext } = currentMeasurement();
      const changed = mutate(view);
      if (changed) await writeFile(path.join(f.results, 'qualification-v1.json'), JSON.stringify(changed));
      await assert.rejects(assembleSite({ ...f, credentialAuthority: 'new', publicationContext }));
      await assert.rejects(stat(f.out));
    } finally { await rm(f.dir, { recursive: true, force: true }); }
  }
});
