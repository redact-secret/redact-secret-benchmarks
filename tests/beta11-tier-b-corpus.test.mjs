import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/beta8/index.ts';
import { HANDOFF_REVISION } from '../benchmarks/lib/beta8/436-sources.ts';
import { beta8ProfileCounts } from '../scripts/report-beta8-profiles.mjs';

// Beta.11 #860 Tier B contracts and corpus (#436): the conventions tests/beta8.test.mjs cannot see
// because they are specific to these six slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = ['436a', '436b', '436c', '436d', '436e', '436f'];
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
const families = {
  'convex-deployment-key': ['convex:deployment-key', 912, 'convex.md'],
  'onepassword-service-account-token': ['onepassword:service-account-token', 913, 'onepassword.md'],
  'inngest-signing-key': ['inngest:signing-key', 914, 'inngest.md'],
  'resend-api-key': ['resend:api-key', 915, 'resend.md'],
  'apify-api-token': ['apify:api-token', 916, 'apify.md'],
  'wandb-api-key': ['wandb:api-key', 917, 'wandb.md'],
};
const targetOf = f => (f.arrivalTargets ?? f.detectors)[0];
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();
const positivesOf = (corpus, target) => corpus.fixtures.filter(f => targetOf(f) === target && secretsOf(f).length && !f.twinOf);

test('the six Tier B families are T1 registry families since the 1127bf9 re-pin, one slice each, with a taxonomy row, a contract and a profile', async () => {
  const taxonomy = await read('benchmarks/support/taxonomy.json');
  const registry = new Set((await read('benchmarks/detectors.json')).detectors.map(d => d.id));
  assert.deepEqual(modules.map(m => m.arrivalFamilies.length), [0, 0, 0, 0, 0, 0]);
  const graduated = modules.flatMap(m => Object.keys(m.registryContracts));
  assert.deepEqual(graduated.sort(), Object.keys(families).sort());
  for (const id of graduated) {
    const [taxonomyId] = families[id];
    assert.ok(!arrivalIds.has(id) && registry.has(id), `${id}: graduated to a registry detector`);
    const row = taxonomy.families.find(f => f.id === taxonomyId);
    assert.ok(row, `${id}: taxonomy row ${taxonomyId}`);
    assert.deepEqual(row.detectors, [id], `${id}: the taxonomy row maps to its registry detector`);
    assert.equal(row.supportStatus, undefined, `${id}: no hand-edited support status`);
    const contract = contracts[id];
    assert.equal(contract.tier, 'T1', id);
    assert.ok(contract.providerSource, `${id}: T1 cites its provider source`);
    assert.ok(contract.fields.some(f => f.basis === 'provider-documentation' && f.status === 'frozen'), id);
    assert.equal(contract.contextGated, undefined, `${id}: a bare-value claim`);
  }
  for (const m of modules) assert.deepEqual(Object.values(m.profiles), ['documented-24'], m.issue);
});

test('every contract traces to its #860 handoff at the frozen product revision', () => {
  assert.match(HANDOFF_REVISION, /^[0-9a-f]{40}$/);
  for (const [id, [, productIssue, file]] of Object.entries(families)) {
    const refs = contracts[id].references;
    assert.ok(refs.includes(`https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/${file}`), `${id}: handoff permalink`);
    assert.ok(refs.includes(`https://github.com/redact-secret/redact-secret/issues/${productIssue}`), `${id}: product issue`);
    assert.ok(refs.includes('https://github.com/redact-secret/redact-secret-benchmarks/issues/436'), `${id}: #436`);
  }
});

test('every Tier B target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => Object.hasOwn(families, c.target));
  assert.equal(counts.length, 6);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
});

test('every family has a positive in each of the nine re-rank probe contexts', () => {
  const probe = ['bare-prose', 'dotenv', 'export', 'bearer-header', 'x-api-key-header', 'json-token', 'json-api-key', 'sdk-kwarg', 'chat-paste'];
  for (const [category, corpus] of corpora)
    for (const target of new Set(corpus.fixtures.map(targetOf)))
      for (const slug of probe) assert.ok(corpus.fixtures.some(f => f.id === `${target}-${slug}` && secretsOf(f).length), `${category}: ${target}-${slug}`);
});

test('no Tier B source file carries a complete synthetic credential as a literal', async () => {
  const files = [...slices.flatMap(key => [`fixtures/generated/beta8/${key}.mjs`, `benchmarks/lib/beta8/${key}.ts`]), 'fixtures/generated/beta8/436-shared.mjs', 'benchmarks/lib/beta8/436-sources.ts'];
  const shapes = [/\|01[0-9a-f]{70,}/, /ops_eyJ[A-Za-z0-9_-]{100,}/, /signkey-(?:prod|test|branch)-[0-9a-f]{60,}/, /\bre_[A-Za-z0-9]{8}_[A-Za-z0-9]{24}\b/,
    /apify_api_[A-Za-z0-9]{20,}/, /wandb_v1_[A-Za-z0-9_]{60,}/, /whsec_[A-Za-z0-9]{24,}/];
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

test('Convex: the span is the whole key; positives carry every typed lead and the 74, 76 and 96 body lengths; no eyJ2 body is authored', () => {
  const corpus = generated['beta8-436a'];
  const values = positivesOf(corpus, 'convex-deployment-key').map(f => valueOf(f, secretsOf(f)[0]));
  for (const lead of ['prod:', 'dev:', 'preview:', 'project:', 'convex-self-hosted|']) assert.ok(values.some(v => v.startsWith(lead)), lead);
  assert.ok(values.some(v => /^[a-z]+-[a-z]+-[0-9]+\|/.test(v)), 'an untyped dashboard admin key');
  assert.deepEqual([...new Set(values.map(v => v.length - v.indexOf('|') - 1))].sort((a, b) => a - b), [74, 76, 96]);
  assert.ok(!corpus.fixtures.some(f => f.content.includes('|eyJ2')), 'the issuance-gated cloud body is asserted by no fixture');
});

test('1Password: bodies at the 250 floor, the 634-character example length, 630 and 866; = and == padding inside the span; the Connect JWT is a twin', () => {
  const corpus = generated['beta8-436b'];
  const values = positivesOf(corpus, 'onepassword-service-account-token').map(f => valueOf(f, secretsOf(f)[0]));
  const bodies = new Set(values.map(v => v.replace(/=+$/, '').length - 7));
  for (const n of [250, 627, 630, 866]) assert.ok(bodies.has(n), `body ${n}`);
  assert.ok(values.some(v => v.endsWith('==')) && values.some(v => /[^=]=$/.test(v)), 'padding is inside the span');
  assert.ok(values.some(v => v.includes('-') && v.includes('_')), 'a Base64url body with - and _');
  const jwt = corpus.fixtures.find(f => f.id === 'onepassword-service-account-token-connect-jwt-twin');
  assert.ok(jwt && jwt.twinOf && /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(jwt.content), 'the Connect token is a prefix twin, never a control');
});

test('Inngest: all three environment labels; Resend: every positive body is mixed case; Apify: bodies of 20, 36 and 128 and no longer run', () => {
  const inngest = positivesOf(generated['beta8-436c'], 'inngest-signing-key').map(f => valueOf(f, secretsOf(f)[0]));
  for (const label of ['prod', 'test', 'branch']) assert.ok(inngest.some(v => v.startsWith(`signkey-${label}-`)), label);
  for (const v of positivesOf(generated['beta8-436d'], 'resend-api-key').map(f => valueOf(f, secretsOf(f)[0])))
    assert.ok(/[A-Z]/.test(v.slice(3)) && /[a-z]/.test(v.slice(3)), 'mixed case, so the product guard is not what a positive measures');
  const apify = generated['beta8-436e'];
  assert.deepEqual([...new Set(positivesOf(apify, 'apify-api-token').map(f => valueOf(f, secretsOf(f)[0]).length - 10))].sort((a, b) => a - b), [20, 36, 128]);
  assert.ok(!apify.fixtures.some(f => /apify_api_[A-Za-z0-9]{129,}/.test(f.content)), 'the 128 cap is product policy: no fixture asserts a longer run either way');
});

test('W&B: positives at 85, 86 and 87 in all, split and unsplit bodies, the on-prem host label as an envelope, and no length or version twin', () => {
  const corpus = generated['beta8-436f'];
  const positives = positivesOf(corpus, 'wandb-api-key');
  const values = positives.map(f => valueOf(f, secretsOf(f)[0]));
  assert.deepEqual([...new Set(values.map(v => v.length))].sort(), [85, 86, 87]);
  assert.ok(values.filter(v => v.length === 86).length > values.length / 2, 'most positives carry the documented 86');
  assert.ok(values.some(v => v.slice(9).includes('_')) && values.some(v => !v.slice(9).includes('_')));
  const onPrem = corpus.fixtures.find(f => f.id === 'wandb-api-key-on-prem-host-label');
  const [span] = secretsOf(onPrem);
  assert.ok(valueOf(onPrem, span).startsWith('wandb_v1_'));
  assert.ok(Buffer.from(onPrem.content).subarray(span.envelope.start, span.start).toString().endsWith('local-'));
  const twins = corpus.fixtures.filter(f => f.twinOf);
  assert.ok(!twins.some(f => f.mutationKind === 'length'), 'no length twin (orchestrator decision on redact-secret#917)');
  assert.ok(!corpus.fixtures.some(f => f.content.includes('wandb_v2_')), 'a future version is never asserted');
});
