import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SHARED_WITH_GROUP_C, AXES, cases, corpusDigest, partDigest, PARTS, FAMILY_IDS, ROWS, SCORED_ROWS, CONTRADICTIONS, EVIDENCE, EVIDENCE_INPUTS } from '../benchmarks/group-d/corpus-group-d.mjs';
import { scoreCase, summarize } from '../benchmarks/batch2/score-r2.mjs';

// Group D (#753) corpus tests. They read the generator, the evidence extraction and the two scorers; none runs a detector.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const json = (p) => JSON.parse(read(p).toString('utf8'));
const proposed = json('benchmarks/group-d/FROZEN-group-d.json.proposed');
const byCase = new Map(EVIDENCE_INPUTS.cases.map((c) => [c.id, c]));
const byFixture = new Map(EVIDENCE_INPUTS.fixtures.map((f) => [f.id, f]));
const bytes = (c) => Buffer.from(c.text, 'utf8');

test('the proposed digest file matches the generator and is not a freeze', () => {
  assert.equal(proposed.status, 'proposed');
  assert.equal(proposed.frozen, false);
  assert.equal(proposed.sha256, corpusDigest());
  assert.equal(proposed.cases, cases.length);
  for (const p of PARTS) assert.equal(proposed.parts[p].sha256, partDigest(p));
  assert.equal(proposed.expectationSources.evidence.commit, EVIDENCE.commit);
  assert.equal(corpusDigest(), corpusDigest(), 'generation is deterministic');
});

test('committed generated outputs are current (generate.mjs --check)', () => {
  execFileSync(process.execPath, [new URL('../benchmarks/group-d/generate.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
});

test('scorers are Batch 2 round 2 unchanged', () => {
  const sha = (p) => createHash('sha256').update(read(p)).digest('hex');
  assert.equal(proposed.scorer.sha256, sha('benchmarks/batch2/score-r2.mjs'));
  assert.equal(proposed.scorer.baseScorerSha256, sha('benchmarks/batch2/score.mjs'));
  assert.equal(proposed.scorer.changed, false);
});

test('ids are unique, axes are defined, spans are in bounds and ordered, no type or action is asserted', () => {
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    for (const a of c.axes) assert.ok(AXES[a], `${c.id}: axis ${a}`);
    assert.ok(c.axes.length > 0, c.id);
    assert.equal(c.expectedType, null, c.id);
    assert.equal(c.expectedAction, null, c.id);
    assert.ok(['positive', 'control', 'unsupported', 'conflict'].includes(c.kind), c.id);
    const spans = c.kind === 'positive' ? [c.expected, ...c.expectedExtra] : (c.probeSpans ?? []);
    let last = 0;
    for (const s of spans) {
      assert.ok(s.start >= last && s.end > s.start && s.end <= bytes(c).length, `${c.id}: span ${s.start}-${s.end}`);
      last = s.end;
    }
    if (c.kind !== 'positive') assert.equal(c.expected, null, c.id);
    if (c.kind === 'control') assert.equal(c.probeSpans, undefined, `${c.id}: a control carries no secret part`);
  }
});

test('all 23 rows are present and only the rows with a must-flag Case have positives', () => {
  assert.equal(FAMILY_IDS.length, 23);
  const mustFlagRows = new Set();
  for (const c of EVIDENCE_INPUTS.cases) if (c.outcome === 'must-flag') for (const r of c.inRows) mustFlagRows.add(r);
  assert.deepEqual([...SCORED_ROWS].sort(), [...mustFlagRows].filter((r) => ROWS[r]).sort());
  assert.equal(SCORED_ROWS.length, 9);
  for (const f of FAMILY_IDS) {
    const own = cases.filter((c) => c.family === f);
    assert.ok(own.length > 0, f);
    assert.equal(own.some((c) => c.kind === 'positive'), SCORED_ROWS.includes(f), f);
    assert.ok(own.some((c) => c.kind === 'unsupported'), `${f}: every row has observed probes`);
  }
  for (const f of ['algolia:search-only-api-key', 'algolia:secured-api-key', 'algolia:write-api-key', 'algolia:analytics-api-key', 'algolia:monitoring-api-key', 'algolia:usage-api-key', 'contentful:delivery-api-access-token', 'contentful:preview-api-access-token', 'asana:service-account-token', 'figma:cli-plan-access-token', 'jfrog:pairing-token', 'canva:authorization-code', 'x:oauth1-access-token', 'zoom:webhook-secret-token']) assert.ok(!SCORED_ROWS.includes(f), f);
});

test('every expectation traces to an evidence Case outcome and fixtures that exist', () => {
  for (const c of cases) {
    const ec = byCase.get(c.trace.caseId);
    assert.ok(ec, `${c.id}: Case ${c.trace.caseId}`);
    assert.equal(c.trace.caseOutcome, ec.outcome, c.id);
    for (const fid of c.trace.fixtureIds) assert.equal(byFixture.get(fid)?.case, c.trace.caseId, `${c.id}: fixture ${fid}`);
    assert.deepEqual(c.claims, ROWS[c.family].claims, c.id);
    assert.ok(c.trace.clause && c.trace.clause.length > 0, c.id);
    if (c.kind === 'positive') assert.equal(ec.outcome, 'must-flag', `${c.id}: positives need a must-flag Case`);
    if (c.kind === 'control') assert.equal(ec.outcome, 'must-not-flag', `${c.id}: controls need a must-not-flag Case`);
    if (c.kind === 'unsupported') assert.ok(ec.outcome === 'not-assertable' || c.trace.observedReason, `${c.id}: observed probes carry a reason`);
    if (c.kind === 'unsupported' || c.kind === 'conflict') assert.ok(c.trace.observedReason, c.id);
    if (c.kind === 'positive' || c.kind === 'control') assert.ok(ec.lifecycle, c.id);
  }
});

test('Case fixtures are reproduced verbatim: same text, same spans, same outcome mapping', () => {
  const fixtureCases = cases.filter((c) => c.trace.source === 'fixture');
  assert.equal(fixtureCases.length, EVIDENCE_INPUTS.fixtures.length);
  for (const c of fixtureCases) {
    const f = byFixture.get(c.trace.fixtureIds[0]);
    const expand = (t) => t.split('{{figd_}}').join(['fi', 'gd_'].join('')).split('{{hex64}}').join('0123456789abcdef'.repeat(4)).split('{{hex32}}').join('0123456789abcdef'.repeat(2));
    assert.equal(c.text, expand(f.text), c.id);
    if (c.kind === 'positive') {
      const spans = [c.expected, ...c.expectedExtra];
      assert.equal(spans.length, f.spans.length, c.id);
      spans.forEach((s, i) => {
        assert.equal(f.spans[i].role, 'secret');
        assert.equal(f.spans[i].start, s.start, c.id);
        assert.equal(f.spans[i].end, s.end, c.id);
        assert.equal(bytes(c).subarray(s.start, s.end).toString('utf8'), expand(f.spans[i].value), c.id);
      });
    }
  }
});

test('contradicting fixtures and unresolved-confidentiality rows are never scored', () => {
  for (const [fid, meta] of Object.entries(CONTRADICTIONS)) {
    const c = cases.find((x) => x.trace.fixtureIds[0] === fid && x.trace.source === 'fixture');
    assert.ok(c, fid);
    assert.equal(c.kind, 'conflict', fid);
    assert.equal(c.family, meta.row, fid);
    assert.ok(c.axes.includes('contradiction'), fid);
  }
  assert.equal(Object.keys(CONTRADICTIONS).length, 8);
  for (const c of cases.filter((x) => x.kind === 'conflict')) assert.ok(CONTRADICTIONS[c.trace.fixtureIds[0]], c.id);
  // a scored control carries no identifier literal the Group D author left unresolved
  const unresolved = [/1000000000000001\|/, /client_id=SYNTHETICappkey01/, /oauth_token="SYNTHETIC-x-oauth/, /X-Figma-Token-Id/];
  for (const c of cases.filter((x) => x.kind === 'control')) for (const re of unresolved) assert.ok(!re.test(c.text), `${c.id}: ${re}`);
});

test('policy-limited, carrier-unresolved and prefix-shaped probes are observed only', () => {
  for (const c of cases) {
    if (c.axes.some((a) => ['prefix-shape', 'policy-limited', 'role-ambiguity', 'derived-value', 'contradiction'].includes(a))) assert.ok(c.kind === 'unsupported' || c.kind === 'conflict', `${c.id}: ${c.axes}`);
  }
});

test('no vendor-prefix or token-shaped literal is committed in the generator or its inputs', () => {
  const banned = [/(?<!\{\{)figd_(?!\}\})/, /\bpat-na1-/, /eyJ[A-Za-z0-9_-]{8,}/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /xox[bap]-/, /\bsl\.[A-Za-z0-9_-]{20,}/, /0123456789abcdef0123456789abcdef/];
  for (const p of ['benchmarks/group-d/corpus-group-d.mjs', 'benchmarks/group-d/generate.mjs', 'benchmarks/group-d/evidence-inputs.json', 'benchmarks/group-d/extract-evidence-inputs.mjs', 'benchmarks/group-d/TRACEABILITY.md', 'benchmarks/group-d/traceability.json', 'benchmarks/group-d/FROZEN-group-d.json.proposed']) {
    const text = read(p).toString('utf8');
    for (const re of banned) assert.ok(!re.test(text), `${p}: ${re}`);
  }
});

test('the unchanged Batch 2 scorer can express the corpus (perfect and empty observations, no detector involved)', () => {
  const perfect = {};
  const empty = {};
  for (const c of cases) {
    const spans = c.kind === 'positive' ? [c.expected, ...c.expectedExtra] : [];
    perfect[c.id] = { findings: spans.map((s) => ({ start: s.start, end: s.end, type: 'x', detector: 'x', action: 'redact' })) };
    empty[c.id] = { findings: [] };
  }
  const p = summarize(cases, perfect);
  const positives = cases.filter((c) => c.kind === 'positive').length;
  assert.equal(p.positives, positives);
  assert.equal(p.exact, positives);
  assert.equal(p.fullyCovered, positives);
  assert.equal(p.misses, 0);
  assert.equal(p.controlFlagged, 0);
  assert.equal(p.pass, 0, 'pass cannot be true: the Cases state no type or action');
  const e = summarize(cases, empty);
  assert.equal(e.misses, positives);
  assert.equal(e.controlFlagged, 0);
  const some = cases.find((c) => c.kind === 'positive' && c.expectedExtra.length);
  assert.equal(scoreCase(some, perfect[some.id]).spans, 2);
  const control = cases.find((c) => c.kind === 'control');
  assert.equal(scoreCase(control, { findings: [{ start: 0, end: 1, type: 'x', detector: 'x', action: 'redact' }] }).flagged, true);
});

test('erratum D-B1/D-B2/A3: endpoint context and container downgrades hold', () => {
  for (const c of cases.filter((x) => x.family === 'algolia:admin-api-key' && x.kind === 'positive')) {
    const n = c.text.split('x-algolia-api-key').length - 1;
    const ctx = c.text.split('synthetic-create-api-key').length - 1;
    assert.ok(ctx >= n && ctx > 0, `${c.id}: every key header carries the create-key context`);
  }
  for (const id of ['elastic:cross-cluster-api-key:gd:repeat-response-and-log:unsupported', 'elastic:cross-cluster-api-key:gd:yaml-response:unsupported', 'meta:instagram-app-secret:gd:curl-data:unsupported', 'meta:instagram-app-secret:gd:curl-data-single:unsupported', 'meta:instagram-app-secret:gd:long-lived-url-fragment:unsupported', 'meta:app-access-token:gd:html-href:unsupported', 'meta:app-access-token:gd:url-fragment:unsupported']) assert.ok(cases.some((c) => c.id === id), id);
  assert.deepEqual(cases.filter((c) => c.trace.sharedWithGroupC).map((c) => c.id).sort(), [...SHARED_WITH_GROUP_C].sort());
  assert.equal(SHARED_WITH_GROUP_C.length, 8);
  assert.equal(cases.filter((c) => c.family === 'meta:app-access-token' && c.kind === 'positive' && !c.trace.sharedWithGroupC).length, 18);
  const down = cases.filter((c) => c.trace.downgraded);
  assert.equal(down.length, 7);
  for (const c of down) { assert.equal(c.kind, 'unsupported'); assert.equal(c.trace.downgradedFrom, 'positive'); assert.ok(c.trace.ruling, c.id); }
  assert.ok(cases.some((c) => c.axes.includes('class-extension')));
});
