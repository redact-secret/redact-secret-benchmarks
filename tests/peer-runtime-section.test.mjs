import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { validatePeerRuntimeThroughputReport, peerRuntimeThroughputPlan } from '../benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts';

// #444: the /report section for #429's runtime redaction libraries. The page
// module uses import.meta.glob, so it loads through Vite like tests/pages.test.mjs.
const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const snapshot = await read('evidence/429/peer-pii-runtime-throughput.json');
const workloads = await read('qualification/pii-profile-cost-workloads-v1.json');
const unescape = html => html.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = html => unescape(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
test.after(() => server.close());
const page = await server.ssrLoadModule('/src/pages/peer-runtime-throughput.ts');
const measured = page.peerRuntimeSection();
const empty = page.peerRuntimeSection(null);

test('the committed snapshot is a valid, current #429 report and is what the page reads', () => {
  validatePeerRuntimeThroughputReport(snapshot);
  assert.equal(page.SNAPSHOT_PATH, 'evidence/429/peer-pii-runtime-throughput.json');
  assert.deepEqual(page.peerRuntimeSnapshot, snapshot);
  assert.deepEqual(page.WORKLOADS.map(w => w.id), workloads.workloads.map(w => w.id), 'the page names every workload, in file order');
});

test('roster: exactly the three runtime libraries in plan order, never a repository secret scanner', () => {
  const names = { 'redact-secret': 'redact-secret', 'flare-redact': 'flare-redact', openredaction: 'OpenRedaction' };
  const expected = peerRuntimeThroughputPlan.tools.map(t => names[t.id]);
  for (const table of measured.match(/<tbody>[\s\S]*?<\/tbody>/g)) {
    assert.deepEqual([...table.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(m => m[1]), expected, 'plan order, never sorted');
  }
  assert.equal(measured.match(/<tbody>/g).length, page.WORKLOADS.length, 'one table per workload');
  for (const html of [measured, empty]) assert.ok(!/gitleaks|trufflehog/i.test(html), 'no secret scanners, not even by name');
});

test('every value is the snapshot summary, formatted only', () => {
  for (const o of snapshot.observations) {
    const table = measured.slice(measured.indexOf(`<h3>${o.workload}</h3>`)).match(/<tbody>[\s\S]*?<\/tbody>/)[0];
    const name = o.tool === 'openredaction' ? 'OpenRedaction' : o.tool;
    const row = table.match(new RegExp(`<th scope="row">${name}</th>([\\s\\S]*?)</tr>`))[1];
    const cells = [...row.matchAll(/<td[^>]*>([^<]+)<\/td>/g)].map(m => m[1]);
    // Same formatter as the page: toFixed rounds a binary tie like 18.025 down, toLocaleString rounds it half-up.
    const fixed = (value, digits) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    assert.deepEqual(cells, [fixed(o.summary.medianMs, 2), fixed(o.summary.p95Ms, 2), fixed(o.summary.medianBytesPerSecond / 1e6, 1)], `${o.tool}/${o.workload}`);
  }
  assert.ok(text(measured).includes(`${peerRuntimeThroughputPlan.sampleProtocol.samplesPerCell} samples per cell`));
  assert.ok(text(measured).includes(`Measured ${snapshot.generatedAt.slice(0, 10)}`));
});

test('no rank, no verdict, no marked value', () => {
  for (const html of [measured, empty]) {
    // "Not a ranking" and the verbatim note's "no ranking assertion" are the only allowed uses.
    const words = text(html).replace(/not a ranking|no ranking assertion/gi, '');
    assert.ok(!/fastest|slowest|faster|slower|×|\b\d+(\.\d+)?x\b|\brank(ed|ing)?\b|winner|best|worst/i.test(words), 'no relative or ranking words');
    assert.ok(!/st-pass|st-fail|st-review|st-unstable/.test(html), 'no status verdicts');
  }
  for (const table of measured.match(/<tbody>[\s\S]*?<\/tbody>/g)) assert.ok(!/<(b|strong)\b/.test(table), 'no emphasised value');
  assert.ok(text(measured).includes('Reference only. Not a ranking'));
});

test('caveats: every methodology note verbatim, the async dagger lands on its note, redact-secret is marked unreleased', () => {
  for (const note of snapshot.methodologyNotes) assert.ok(unescape(measured).includes(note), note.slice(0, 40));
  const target = measured.match(/<li id="rt-note-async">([^<]+)<\/li>/);
  assert.ok(target && /async|asynchronous|promise/i.test(unescape(target[1])), 'the dagger target is the async note');
  assert.match(measured, /href="#rt-note-async" aria-label="Asynchronous call, see note \d+">†<\/a>/);
  assert.match(text(measured), /OpenRedaction [^ ]+ npm detect\(\) async/);
  assert.match(text(measured), /redact-secret [^ ]+ local build · unreleased scanAndRedact\(\) sync/);
});

test('Not measured: no snapshot shows the dashed mark and why, and no table', () => {
  assert.match(empty, /data-status="not-measured">Not measured/);
  assert.ok(!/<table/.test(empty));
  assert.ok(text(empty).includes('No runtime comparison has been committed yet'));
  assert.match(empty, /id="runtime-peers"/);
});
