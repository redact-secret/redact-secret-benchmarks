import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { figure, directionWord, withheldReason, interval, scaleMax, statusMark, byteView, byteLines, displayText, segment, redactionLane, laneMarks, OUTCOME_NAME, OUTCOME_SHAPE, evidenceCrumb, actionEmptyState } from '../src/components/index.ts';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const categories = await read('benchmarks/categories.json');
const fixtures = (await Promise.all(categories.map(async c => (await read(c.corpus)).fixtures.map(f => ({ ...f, slug: `${c.id}--${f.id}` }))))).flat();
const text = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

test('Figure: the direction word follows the published direction', () => {
  assert.equal(directionWord('upper'), 'at most');
  assert.equal(directionWord('lower'), 'at least');
  assert.equal(directionWord(null), '');
  const leak = figure({ question: 'Does it miss real secrets?', value: { point: 0, bound: 0.026894, n: 139, direction: 'upper' }, observed: { count: 0, of: 139, noun: 'secret spans leaked' }, definition: 'Leaked span rate.' });
  assert.match(leak, /<small>at most<\/small> 2\.7%/, 'the bound is the large number, not the point');
  assert.match(text(leak), /at most 2\.7%/, 'read aloud or copied, the word and the number stay apart');
  assert.match(leak, /<b>0 of 139<\/b> secret spans leaked/);
  assert.match(leak, /class="def">Leaked span rate\./);
  const twins = figure({ question: 'Does it tell near-twins apart?', value: { point: 0.859155, bound: 0.75978, n: 71, direction: 'lower' }, observed: { count: 61, of: 71, noun: 'pairs discriminated' } });
  assert.match(twins, /<small>at least<\/small> 76\.0%/);
  assert.ok(!twins.includes('85.9%</p>'), 'the point estimate never takes the large slot');
});

test('Figure: an unbounded ratio shows its point with no direction word', () => {
  const html = figure({ question: 'Collateral', value: { point: 0.125, bound: null, n: 40, direction: null }, format: v => v.toFixed(3) });
  assert.match(html, /<p class="v">0\.125<\/p>/);
  assert.ok(!html.includes('at most') && !html.includes('class="iv"'));
});

test('Figure: a withheld rate shows the reason and the n it needs, never a number', () => {
  const html = figure({ question: 'Does it flag safe values?', value: { withheld: 'insufficient-evidence', n: 3, needed: 5 }, observed: { count: 0, of: 3, noun: 'controls flagged' } });
  assert.match(html, /data-status="withheld">Withheld</);
  assert.match(text(html), /needs at least 5, has 3/);
  assert.ok(!/\d%/.test(text(html)), 'no percentage for n < minDenominator');
  assert.ok(!html.includes('class="iv"'), 'no interval without a published bound');
  assert.match(html, /<b>0 of 3<\/b>/, 'counts stay visible when the rate is withheld');
  assert.match(withheldReason({ withheld: 'insufficient-coverage', n: 2, needed: 10 }), /authored twin coverage: needs at least 10, has 2/);
  assert.equal(withheldReason({ withheld: 'insufficient-evidence', n: 9, detail: 'Too much of this group is still pending review.' }), 'Too much of this group is still pending review.');
  const unmeasured = figure({ question: 'q', value: { withheld: 'not-measured', n: 0 } });
  assert.match(unmeasured, /class="st st-nm" data-status="not-measured">Not measured</, 'not measured is dashed ink-muted, not a status colour');
});

test('Figure: few samples is a flag beside the counts, set by the caller', () => {
  const base = { question: 'q', value: { point: 0, bound: 0.390334, n: 6, direction: 'upper' }, observed: { count: 0, of: 6, noun: 'controls flagged' } };
  assert.match(figure({ ...base, fewSamples: true }), /<b>0 of 6<\/b> controls flagged <span class="st st-held"[^>]*>Few samples</);
  assert.ok(!figure(base).includes('Few samples'));
  assert.match(figure({ ...base, href: '/coverage?x=<' }), /href="\/coverage\?x=&lt;"/, 'hrefs are escaped');
  assert.ok(!figure({ ...base, question: '<script>' }).includes('<script>'));
});

test('Interval: tick at the published bound, triangle at the observed value, nothing round', () => {
  const upper = interval({ lo: 0, point: 0, hi: 0.027, max: 0.05, direction: 'upper' });
  assert.match(upper, /class="tick" style="left:54\.00%"/);
  assert.match(upper, /class="tri" style="left:0\.00%"/);
  assert.match(upper, /aria-label="Observed 0\.0%\. Published bound: at most 2\.7%/);
  const lower = interval({ lo: 0.76, point: 0.859, hi: 0.859, max: 1, direction: 'lower' });
  assert.match(lower, /class="tick" style="left:76\.00%"/);
  assert.match(lower, /class="tri" style="left:85\.90%"/);
  assert.match(interval({ lo: 0, point: 2, hi: 3, max: 1, direction: 'upper' }), /class="tri" style="left:100\.00%"/, 'values clamp to the axis');
  assert.ok(!/circle|dot|round/.test(upper));
  assert.deepEqual([0.026, 0.0717, 0.2, 0.39, 0.96].map(scaleMax), [0.05, 0.1, 0.25, 0.5, 1]);
});

test('StatusMark: always a word; failure and not-measured have their own shape', () => {
  assert.match(statusMark('fail'), /class="st st-fail"[^>]*>Failed</);
  assert.match(statusMark('unstable'), /st-unstable[^>]*>Unstable</);
  assert.match(statusMark('not-measured'), /st-nm[^>]*>Not measured</);
  assert.match(statusMark('pass', 'Met'), />Met</);
  assert.throws(() => statusMark('pass', ' '), /needs a word/);
  assert.ok(!statusMark('info', '<b>').includes('<b>'));
});

test('ByteView: every fixture round-trips byte for byte, and highlights are exactly the secret bytes', () => {
  for (const f of fixtures) {
    const lines = byteLines(f.content), total = Buffer.byteLength(f.content);
    assert.equal(lines[0].start, 0, f.slug);
    assert.equal(lines.at(-1).end, total, f.slug);
    lines.forEach((line, i) => { if (i) assert.equal(line.start, lines[i - 1].end, f.slug); });
    assert.equal(lines.flatMap(line => segment(f.content, line.start, line.end, f.expected)).map(s => s.text).join(''), f.content, f.slug);
    const highlighted = lines.flatMap(line => segment(f.content, line.start, line.end, f.expected)).filter(s => s.marks.length).reduce((n, s) => n + (s.end - s.start), 0);
    assert.equal(highlighted, f.expected.reduce((n, s) => n + (s.end - s.start), 0), f.slug);
  }
});

test('ByteView: secrets are green inside an ink-underlined envelope; whitespace is drawn', () => {
  const content = 'postgres://fixture:s3cret@db.example.invalid/app';
  const html = byteView({ content, spans: [{ start: 19, end: 25, role: 'secret' }], envelopes: [{ start: 0, end: 48 }] });
  assert.match(html, /<span class="env"><span class="sec">s3cret<\/span><\/span>/);
  assert.equal(text(html), content);
  assert.equal(text(displayText('a b\tc\r\n')), 'a·b→c␍␊');
  assert.match(displayText('﻿x'), /title="byte order mark U\+FEFF">BOM</);
  assert.ok(!byteView({ content: '<script>alert(1)</script>', spans: [] }).includes('<script>'));
  assert.match(byteView({ content: '', spans: [] }), /∅/);
});

test('RedactionLane: mirrors the displayed bytes on every fixture line, so bars align under any glyph', () => {
  for (const f of fixtures) for (const line of byteLines(f.content)) {
    const bytesText = text(byteView({ content: f.content, spans: f.expected, envelopes: f.expected.flatMap(s => s.envelope ? [s.envelope] : []), line }));
    const laneText = text(redactionLane({ content: f.content, marks: f.expected.map(s => ({ start: s.start, end: s.end, shape: 'fill' })), line, label: 'x' }));
    assert.equal(laneText, bytesText === '∅' ? '' : bytesText, `${f.slug} line ${line.index}`);
  }
});

test('RedactionLane: five outcomes, three shapes, read from the report', () => {
  assert.deepEqual(OUTCOME_SHAPE, { EXACT: 'fill', COVERED: 'fill', OVERBROAD: 'fill', PARTIAL: 'hatch', MISS: 'outline' });
  assert.equal(Object.keys(OUTCOME_NAME).length, 5);
  const secret = [{ start: 19, end: 25 }];
  assert.deepEqual(laneMarks(secret, ['EXACT'], [{ start: 19, end: 25 }]), [{ start: 19, end: 25, shape: 'fill' }]);
  assert.deepEqual(laneMarks(secret, ['OVERBROAD'], [{ start: 0, end: 48 }]), [{ start: 0, end: 48, shape: 'fill' }]);
  assert.deepEqual(laneMarks(secret, ['PARTIAL'], [{ start: 21, end: 25 }]), [{ start: 21, end: 25, shape: 'hatch' }]);
  assert.deepEqual(laneMarks(secret, ['MISS'], []), [{ start: 19, end: 25, shape: 'outline' }]);
  assert.deepEqual(laneMarks([], undefined, [{ start: 2, end: 4 }]), [{ start: 2, end: 4, shape: 'fill' }], 'a finding on a control file is a solid bar');
  const lane = redactionLane({ content: 'postgres://fixture:s3cret@db', marks: laneMarks(secret, ['PARTIAL'], [{ start: 21, end: 25 }]), label: 'gitleaks: Partly exposed' });
  assert.match(lane, /<i class="hatch">cret<\/i>/);
  assert.match(lane, /role="img" aria-label="gitleaks: Partly exposed"/);
});

test('EvidenceCrumb: every part but the current one is a link', () => {
  const html = evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: 'GitHub tokens', href: '/coverage/github-token' }, { label: 'fixture-id', href: '/fixture/x' }]);
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert.match(html, /<li aria-current="page">fixture-id<\/li>/);
  assert.match(html, /aria-label="Breadcrumb"/);
});

test('ActionEmptyState: what is missing, the next command, no apology', () => {
  const html = actionEmptyState({ title: 'No benchmark results for this checkout', body: 'The corpus is here, but no scanner has run against it.', command: 'npm run bench' });
  assert.match(html, /<pre class="cmd"><code>npm run bench<\/code><\/pre>/);
  assert.match(html, /role="status"/);
  assert.throws(() => actionEmptyState({ title: 'Sorry, nothing here', body: 'x' }), /does not apologise/);
});
