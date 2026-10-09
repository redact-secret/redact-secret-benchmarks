import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/credential-regressions/index.ts';
import { HANDOFF_REVISION } from '../benchmarks/lib/credential-regressions/464-sources.ts';
import { beta8ProfileCounts } from '../scripts/report-fixture-profiles.mjs';
import { findingFamily, scoredArrivalFamilies } from '../scanners/families.mjs';

// Beta.12 #860 issuance-research contracts and corpus (#464): the conventions tests/beta8.test.mjs cannot see
// because they are specific to these six slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = ['464a', '464b', '464c', '464d', '464e', '464f'];
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
const families = {
  'daytona-api-key': ['daytona:api-key', 970, 'daytona.md'],
  'clickhouse-cloud-api-secret': ['clickhouse-cloud:api-key', 971, 'clickhouse-cloud.md'],
  'nvidia-api-key': ['nvidia:ngc-api-key', 972, 'nvidia.md'],
  'browserbase-api-key': ['browserbase:api-key', 973, 'browserbase.md'],
  'cerebras-api-key': ['cerebras:inference-api-key', 975, 'cerebras.md'],
  'runpod-api-key': ['runpod:api-key', 974, 'runpod.md'],
};
const targetOf = f => (f.arrivalTargets ?? f.detectors)[0];
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();
const positivesOf = (corpus, target) => corpus.fixtures.filter(f => targetOf(f) === target && secretsOf(f).length && !f.twinOf);
const valuesOf = (corpus, target) => positivesOf(corpus, target).map(f => valueOf(f, secretsOf(f)[0]));
const widths = (values, prefix) => [...new Set(values.map(v => v.length - prefix))].sort((a, b) => a - b);
const policyFields = id => contracts[id].fields.filter(f => f.field.startsWith('policy-'));

test('the six #464 families graduated to registry detectors at the 4fb7882 re-pin, one slice each, with a taxonomy row, a contract and a profile', async () => {
  const taxonomy = await read('benchmarks/support/taxonomy.json');
  const registry = new Set((await read('benchmarks/detectors.json')).detectors.map(d => d.id));
  const graduated = modules.flatMap(m => Object.keys(m.registryContracts ?? {})).sort();
  const siblings = modules.flatMap(m => m.arrivalFamilies.map(f => f.id)).sort();
  assert.deepEqual([...graduated, ...siblings].sort(), Object.keys(families).sort());
  assert.ok(graduated.every(id => registry.has(id) && !arrivalIds.has(id)), 'graduated ids are registry detectors, never arrival ids');
  assert.ok(siblings.every(id => arrivalIds.has(id) && !registry.has(id) && scoredArrivalFamilies.includes(id)), 'sibling types stay arrival families scored by finding type');
  for (const [id, [taxonomyId]] of Object.entries(families)) {
    const row = taxonomy.families.find(f => f.id === taxonomyId);
    assert.ok(row, `${id}: taxonomy row ${taxonomyId}`);
    assert.deepEqual(row.detectors, [id], `${id}: the taxonomy row maps to the family's own id`);
    assert.equal(row.supportStatus, undefined, `${id}: no hand-edited support status`);
    const contract = contracts[id];
    assert.equal(contract.tier, 'T1', id);
    assert.ok(contract.providerSource, `${id}: T1 cites its provider source`);
    assert.equal(contract.contextGated, undefined, `${id}: a bare-value claim`);
    assert.ok(contract.fields.some(f => f.field === 'peer-lag' && f.basis === 'tool'), `${id}: records where the peers lag or overreach`);
    assert.ok(contract.fields.some(f => f.field === 'boundary' || f.field === 'body' || f.field === 'body-length'), id);
  }
  for (const m of modules) assert.deepEqual(Object.values(m.profiles), ['documented-24'], m.issue);
});

test('every contract traces to its #860 handoff and issuance research at the frozen product revision', () => {
  assert.match(HANDOFF_REVISION, /^[0-9a-f]{40}$/);
  const base = `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/`;
  for (const [id, [, productIssue, file]] of Object.entries(families)) {
    const refs = new Set(contracts[id].references);
    assert.ok(refs.has(`${base}${file}`), `${id}: handoff permalink`);
    assert.ok(refs.has(`${base}issuance-research/${file}`), `${id}: issuance research permalink`);
    assert.ok(refs.has('https://github.com/redact-secret/redact-secret/issues/860#issuecomment-5880547337'), `${id}: rulings R9-R10`);
    assert.ok(refs.has(`https://github.com/redact-secret/redact-secret/issues/${productIssue}`), `${id}: product issue`);
    assert.ok(refs.has('https://github.com/redact-secret/redact-secret-benchmarks/issues/464'), `${id}: #464`);
  }
});

test('policy is marked as policy: caps, the RunPod floor, the Cerebras alphabet and the ClickHouse uppercase guard are never T1 fields', () => {
  const expected = {
    'daytona-api-key': [],
    'clickhouse-cloud-api-secret': ['policy-uppercase-guard'],
    'nvidia-api-key': ['policy-upper-bound'],
    'browserbase-api-key': ['policy-upper-bound'],
    'cerebras-api-key': ['policy-alphabet'],
    'runpod-api-key': ['policy-floor', 'policy-upper-bound'],
  };
  for (const [id, names] of Object.entries(expected)) {
    assert.deepEqual(policyFields(id).map(f => f.field), names, id);
    for (const f of policyFields(id)) {
      assert.equal(f.basis, 'research-hypothesis', `${id}.${f.field}: policy is never a provider basis`);
      assert.match(f.claim, /^POLICY/, `${id}.${f.field}`);
    }
    for (const f of contracts[id].fields.filter(x => !x.field.startsWith('policy-') && x.basis === 'research-hypothesis'))
      assert.ok(['boundary', 'bb-test', 'self-provisioned-runner-key'].includes(f.field), `${id}.${f.field}: a research hypothesis outside policy is a boundary or exclusion note`);
    assert.match(contracts[id].review, id === 'daytona-api-key' ? /T1 as of v0\.190\.0/ : /POLICY/, id);
  }
});

test('every target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => Object.hasOwn(families, c.target));
  assert.equal(counts.length, 6);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
});

test('every family has a positive in each of the nine re-rank probe contexts', () => {
  const probe = ['bare-prose', 'dotenv', 'export', 'bearer-header', 'x-api-key-header', 'json-token', 'json-api-key', 'sdk-kwarg', 'chat-paste'];
  for (const [category, corpus] of corpora)
    // generic-token and pinecone-api-key are the targets of controls relabelled as accepted policy (#948 and
  // docs/decisions/2026-09-30-accept-credential-named-and-typed-neighbour-redactions.md), never probed families.
    for (const target of new Set(corpus.fixtures.map(targetOf).filter(t => Object.hasOwn(families, t))))
      for (const slug of probe) assert.ok(corpus.fixtures.some(f => f.id === `${target}-${slug}` && secretsOf(f).length), `${category}: ${target}-${slug}`);
});

test('no #464 source file carries a complete synthetic credential as a literal', async () => {
  const files = [...slices.flatMap(key => [`fixtures/generators/credential-regressions/${key}.mjs`, `benchmarks/lib/credential-regressions/${key}.ts`]), 'fixtures/generators/credential-regressions/464-shared.mjs', 'benchmarks/lib/credential-regressions/464-sources.ts'];
  const shapes = [/dtn_[0-9a-f]{40,}/, /\b4b1d[A-Za-z0-9]{30,}/, /nvapi-[A-Za-z0-9_-]{40,}/, /bb_live_[A-Za-z0-9]{20,}/, /csk[-_][A-Za-z0-9_-]{40,}/,
    /rpa_[A-Za-z0-9]{31,}/, /pcsk_[A-Za-z0-9]{6}_[A-Za-z0-9]{40,}/];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const shape of shapes) assert.equal(shape.test(source), false, `${file} matches ${shape}`);
  }
});

test('every positive satisfies its own contract pattern, and every twin differs from its positive by one recorded property outside the contract', () => {
  for (const [category, corpus] of corpora) {
    const byId = new Map(corpus.fixtures.map(f => [f.id, f]));
    for (const f of corpus.fixtures) {
      const pattern = new RegExp(contracts[targetOf(f)].pattern);
      for (const r of secretsOf(f)) assert.ok(pattern.test(valueOf(f, r)), `${category}--${f.id}`);
      if (!f.twinOf) continue;
      const positive = byId.get(f.twinOf);
      assert.ok(positive && secretsOf(positive).length, `${f.id}: twin names an authored positive`);
      assert.ok(f.mutation && f.mutationKind && f.mutationKind !== 'context', f.id);
      assert.equal(f.expected.length, 0, `${f.id}: a structural twin asserts silence`);
    }
  }
});

test('no fixture asserts silence on a bound only project policy sets: no over-cap twin or control, no 129-byte run', () => {
  const caps = { 'nvidia-api-key': /nvapi-[A-Za-z0-9_-]{129,}/, 'browserbase-api-key': /bb_live_[A-Za-z0-9]{129,}/, 'runpod-api-key': /rpa_[A-Za-z0-9]{129,}/ };
  for (const [target, over] of Object.entries(caps)) {
    const corpus = corpora.find(([, c]) => c.fixtures.some(f => targetOf(f) === target))[1];
    assert.ok(!corpus.fixtures.some(f => over.test(f.content)), `${target}: the 128 cap is product policy`);
    assert.ok(valuesOf(corpus, target).some(v => v.length === v.indexOf('_') + 1 + 128 || v.length === v.indexOf('-') + 1 + 128 || v.length - 128 === (target === 'nvidia-api-key' ? 6 : target === 'runpod-api-key' ? 4 : 8)), `${target}: a positive reaches the cap`);
  }
});

test('Daytona: bodies are lowercase hex of 64; dtn_secret_, dtn_artifact_ and bare 64-hex are never positives', () => {
  const corpus = generated['beta8-464a'];
  const values = valuesOf(corpus, 'daytona-api-key');
  assert.ok(values.every(v => /^dtn_[0-9a-f]{64}$/.test(v)));
  for (const slug of ['secret-placeholder', 'secret-then-hex', 'artifact-marker', 'bare-sha256'])
    assert.ok(corpus.fixtures.some(f => f.id.includes(slug) && !secretsOf(f).length && !f.twinOf), slug);
  // DAYTONA_API_KEY=<bare 64 hex> is a generic-token policy row since the #948 relabel (Beta.12 graduation), never a daytona positive.
  for (const id of ['daytona-api-key-named-bare-hex-encoded-value', 'daytona-api-key-runner-key-unprefixed-encoded-value'])
    assert.ok(corpus.fixtures.some(f => f.id === id && targetOf(f) === 'generic-token' && f.assessment.kind === 'policy'), id);
  const twins = corpus.fixtures.filter(f => f.twinOf).map(f => f.id.replace('daytona-api-key-', ''));
  for (const t of ['body-63-twin', 'body-65-twin', 'uppercase-hex-byte-twin', 'non-hex-letter-twin', 'uppercase-prefix-twin', 'hyphen-separator-twin', 'leading-glue-twin']) assert.ok(twins.includes(t), t);
});

test('ClickHouse: every positive and every twin body is mixed case, so the uppercase guard (policy) is never what is measured; the key ID is unclaimed', () => {
  const corpus = generated['beta8-464b'];
  for (const v of valuesOf(corpus, 'clickhouse-cloud-api-secret')) assert.ok(/[A-Z]/.test(v.slice(4)), 'mixed case');
  for (const f of corpus.fixtures.filter(x => x.twinOf)) assert.ok(/[A-Z]/.test(f.content.match(/(?:4b1d|4B1D|4b1c)[A-Za-z0-9_-]*/)[0].slice(4)), `${f.id}: a twin keeps a mixed-case body`);
  assert.ok(!corpus.fixtures.some(f => f.mutation && /all-lower|all-hex|lowercase body/i.test(f.mutation)), 'no all-lowercase twin');
  assert.ok(corpus.fixtures.some(f => f.id.includes('key-id-alone') && !secretsOf(f).length), 'the key ID alone is a benign control');
  assert.ok(corpus.fixtures.some(f => f.id.includes('uuid-with-4b1d')) && corpus.fixtures.some(f => f.id.includes('sha1-digest-4b1d')) && corpus.fixtures.some(f => f.id.includes('sha256-digest-4b1d')));
  assert.ok(corpus.fixtures.some(f => f.id.endsWith('knowledge-base-39-byte-total-twin')), 'the 39-byte total is a length twin');
  const pairs = positivesOf(corpus, 'clickhouse-cloud-api-secret').filter(f => /curl-user-literal|python-requests|dotenv-key-id-pair|terraform/.test(f.id));
  assert.equal(pairs.length, 4);
  for (const f of pairs) assert.equal(secretsOf(f).length, 1, `${f.id}: only the secret is expected, the key ID stays unmarked`);
});

test('NVIDIA: bodies of 60, 64, 70 and 128 with _ and -; a 59 twin and control; the dot twin leaves no 60-byte run', () => {
  const corpus = generated['beta8-464c'];
  const values = valuesOf(corpus, 'nvidia-api-key');
  assert.deepEqual(widths(values, 6), [60, 64, 70, 128]);
  assert.ok(values.some(v => v.slice(6).includes('_')) && values.some(v => v.slice(6).includes('-')));
  const dot = corpus.fixtures.find(f => f.id === 'nvidia-api-key-dot-in-body-twin');
  const run = dot.content.match(/nvapi-[A-Za-z0-9_-]+/g).map(m => m.length - 6);
  assert.ok(run.every(n => n < 60), 'no run reaches the provider floor');
  assert.ok(corpus.fixtures.some(f => f.id === 'nvidia-api-key-body-59-twin') && corpus.fixtures.some(f => f.id === 'nvidia-api-key-body-59-near-miss'));
  assert.ok(!corpus.fixtures.some(f => f.twinOf && f.mutationKind === 'length' && /129|over/i.test(f.mutation)), 'no over-cap twin');
});

test('Browserbase: bodies of 20, 32 and 128; bb_test_ and bb_live_session_ are never positives; the X-BB-API-Key header is a positive', () => {
  const corpus = generated['beta8-464d'];
  assert.deepEqual(widths(valuesOf(corpus, 'browserbase-api-key'), 8), [20, 32, 128]);
  assert.ok(!corpus.fixtures.some(f => targetOf(f) === 'browserbase-api-key' && f.expected.length && /bb_test_/.test(valueOf(f, f.expected[0]))), 'bb_test_ is never a browserbase positive');
  // BROWSERBASE_API_KEY=bb_test_... is a generic-token policy row since the #948 relabel (Beta.12 graduation).
  assert.ok(corpus.fixtures.some(f => f.id === 'browserbase-api-key-bb-test-key-near-miss' && targetOf(f) === 'generic-token' && f.assessment.kind === 'policy'));
  for (const slug of ['live-session-identifier', 'timestamp-cookie', 'project-id']) assert.ok(corpus.fixtures.some(f => f.id.includes(slug) && !secretsOf(f).length), slug);
  assert.ok(corpus.fixtures.some(f => f.id === 'browserbase-api-key-x-bb-api-key-header' && /X-BB-API-Key: /.test(f.content)));
  for (const t of ['body-19', 'trailing-underscore', 'trailing-hyphen', 'uppercase-prefix', 'hyphen-prefix', 'leading-glue']) assert.ok(corpus.fixtures.some(f => f.twinOf && f.id.includes(t)), t);
});

test('Cerebras: both prefixes in every probe context; lowercase-only and _/- bodies are positives; pcsk_ is a typed Pinecone row and a boundary twin; no alphabet twin', () => {
  const corpus = generated['beta8-464e'];
  const probe = ['bare-prose', 'dotenv', 'export', 'bearer-header', 'x-api-key-header', 'json-token', 'json-api-key', 'sdk-kwarg', 'chat-paste'];
  for (const slug of probe) {
    assert.ok(corpus.fixtures.some(f => f.id === `cerebras-api-key-${slug}` && /csk-/.test(f.content) && secretsOf(f).length), `${slug} csk-`);
    assert.ok(corpus.fixtures.some(f => f.id === `cerebras-api-key-${slug}-underscore` && /csk_/.test(f.content) && secretsOf(f).length), `${slug} csk_`);
  }
  const values = valuesOf(corpus, 'cerebras-api-key');
  assert.ok(widths(values, 4).every(w => w === 48));
  assert.ok(values.some(v => /^csk[-_][a-z0-9]{48}$/.test(v)), 'a lowercase-only body (the tool class) is a positive');
  assert.ok(values.some(v => v.slice(4).includes('_')) && values.some(v => v.slice(4).includes('-')) && values.some(v => /[A-Z]/.test(v)));
  assert.ok(!corpus.fixtures.some(f => f.twinOf && f.mutationKind === 'alphabet'), 'the alphabet is policy (R10): no alphabet twin, no dot or plus twin');
  const pinecone = corpus.fixtures.filter(f => f.id.includes('pinecone-key') && !f.twinOf);
  assert.equal(pinecone.length, 1);
  assert.match(pinecone[0].content, /pcsk_[A-Za-z0-9]{6}_[A-Za-z0-9]{63}\n/, 'a real-shape Pinecone key, built at run time');
  // The Pinecone key is a typed pinecone-api-key policy row (accepted as the Pinecone detector's correct finding), never a Cerebras positive.
  assert.ok(targetOf(pinecone[0]) === 'pinecone-api-key' && secretsOf(pinecone[0]).length === 1 && pinecone[0].assessment.kind === 'policy');
  assert.ok(corpus.fixtures.filter(f => f.twinOf && /pcsk/.test(f.mutation)).length === 2, 'pcsk_ and pcsk- leading-glue twins');
});

test('RunPod: bodies of 31, 46 (in and out of the 40-upper-plus-6-mixed layout) and 128; the 30 twin is labelled POLICY; Redirect.pizza and rps_ are never positives', () => {
  const corpus = generated['beta8-464f'];
  const values = valuesOf(corpus, 'runpod-api-key');
  assert.deepEqual(widths(values, 4), [31, 46, 128]);
  assert.ok(values.some(v => /^rpa_[A-Z0-9]{40}[A-Za-z0-9]{6}$/.test(v)) && values.some(v => v.length === 50 && !/^rpa_[A-Z0-9]{40}/.test(v)), 'with and without the tool layout');
  const twin30 = corpus.fixtures.find(f => f.id === 'runpod-api-key-body-30-policy-floor-twin');
  assert.match(twin30.mutation, /^length: POLICY \(ruling R10\), not T1/);
  assert.equal(corpus.fixtures.filter(f => f.twinOf && /POLICY/.test(f.mutation)).length, 1, 'the only policy twin');
  // Redirect.pizza and rps_ values under their own credential variables are generic-token policy rows since the #948 relabel.
  for (const slug of ['redirect-pizza-30', 's3-secret-rps']) assert.ok(corpus.fixtures.some(f => f.id.includes(slug) && targetOf(f) === 'generic-token' && f.assessment.kind === 'policy' && !f.twinOf), slug);
  assert.ok(!corpus.fixtures.some(f => /rpa_[A-Za-z0-9]{16,29}(?![A-Za-z0-9])/.test(f.content)), 'a 16-30 body is an accepted false negative; only the 30 boundary is authored');
});

test('peer labels map to the arrival families they measure, and no peer overreach is hidden: trufflehog NVAPI and gitleaks clickhouse only', () => {
  assert.deepEqual(findingFamily('trufflehog', 'NVAPI'), { family: 'nvidia-api-key' });
  assert.deepEqual(findingFamily('gitleaks', 'clickhouse-cloud-api-secret-key'), { family: 'clickhouse-cloud-api-secret' });
  for (const id of ['daytona-api-key', 'browserbase-api-key', 'cerebras-api-key', 'runpod-api-key'])
    assert.ok(contracts[id].fields.some(f => f.field === 'peer-lag' && /no (Cerebras |RunPod )?rule|no .* rule/i.test(f.claim)), `${id}: no pinned-peer rule is recorded`);
  assert.match(contracts['nvidia-api-key'].fields.find(f => f.field === 'peer-lag').claim, /exact 64/);
  assert.match(contracts['nvidia-api-key'].fields.find(f => f.field === 'peer-lag').claim, /\{60,70\}/);
  assert.match(contracts['runpod-api-key'].fields.find(f => f.field === 'peer-lag').claim, /rpa_\[A-Z0-9\]\{40\}\[A-Za-z0-9\]\{6\}/);
  assert.match(contracts['cerebras-api-key'].fields.find(f => f.field === 'tool-alphabet').claim, /\[a-z0-9\]/);
});
