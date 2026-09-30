import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/beta8/index.ts';
import { HANDOFF_REVISION } from '../benchmarks/lib/beta8/528-sources.ts';
import { beta8ProfileCounts } from '../scripts/report-beta8-profiles.mjs';
import { findingFamily, scoredArrivalFamilies } from '../scanners/families.mjs';
import { polarChecksum, cratesCheckChar } from '../fixtures/generated/beta8/528-shared.mjs';

// Beta.12 #1014 broad-discovery contracts and corpus (#528): the conventions tests/beta8.test.mjs cannot see because
// they are specific to these ten slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = 'abcdefghij'.split('').map(k => `528${k}`);
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
const families = {
  'bitwarden-secrets-manager-access-token': ['bitwarden:secrets-manager-access-token', 1019, 'bitwarden.md'],
  'polar-token': ['polar:organization-access-token', 1020, 'polar.md'],
  'polar-api-credential': ['polar:api-credential', 1020, 'polar.md'],
  'sonarqube-token': ['sonarqube:user-token', 1021, 'sonarqube.md'],
  'sonarqube-analysis-token': ['sonarqube:analysis-token', 1021, 'sonarqube.md'],
  'rubygems-api-key': ['rubygems:api-key', 1023, 'rubygems.md'],
  'clojars-deploy-token': ['clojars:deploy-token', 1025, 'clojars.md'],
  'crates-io-token': ['crates-io:api-token', 1031, 'crates-io.md'],
  'crates-io-trusted-publishing-token': ['crates-io:trusted-publishing-token', 1031, 'crates-io.md'],
  'dynatrace-token': ['dynatrace:api-token', 1032, 'dynatrace.md'],
  'paddle-api-key': ['paddle:api-key', 1033, 'paddle.md'],
  'honeycomb-api-key': ['honeycomb:ingest-key', 1034, 'honeycomb.md'],
  'axiom-token': ['axiom:api-token', 1035, 'axiom.md'],
  'axiom-personal-token': ['axiom:personal-token', 1035, 'axiom.md'],
};
const targetOf = f => (f.arrivalTargets ?? f.detectors)[0];
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();
const corpusOf = target => corpora.find(([, c]) => c.fixtures.some(f => targetOf(f) === target))[1];
const positivesOf = target => corpusOf(target).fixtures.filter(f => targetOf(f) === target && secretsOf(f).length && !f.twinOf);
const valuesOf = target => positivesOf(target).map(f => valueOf(f, secretsOf(f)[0]));
const fixturesOf = target => corpusOf(target).fixtures.filter(f => targetOf(f) === target);
const controlsOf = target => fixturesOf(target).filter(f => !f.twinOf && !secretsOf(f).length);
const policyFields = id => contracts[id].fields.filter(f => f.field.startsWith('policy-'));

test('the fourteen #528 families: ten graduated to registry detectors at the 4fb7882 re-pin, four sibling types scored by finding type, each with a taxonomy row, a contract and a profile', async () => {
  const taxonomy = await read('benchmarks/support/taxonomy.json');
  const registry = new Set((await read('benchmarks/detectors.json')).detectors.map(d => d.id));
  assert.deepEqual(modules.map(m => m.issue), slices);
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
    assert.equal(contract.validate, undefined, `${id}: no post-check narrows the lexical grammar (a checksum never rejects)`);
    assert.ok(contract.fields.some(f => f.field === 'peer-lag' && f.basis === 'tool'), `${id}: records where the peers lag or overreach`);
    assert.ok(contract.fields.some(f => f.field === 'boundary' && f.basis === 'research-hypothesis'), `${id}: the boundary is a recorded handoff decision`);
  }
  for (const m of modules) assert.ok(Object.values(m.profiles).every(p => p === 'documented-24'), m.issue);
});

test('every contract traces to its #1014 handoff at the frozen product revision, its product issue and #528', () => {
  assert.match(HANDOFF_REVISION, /^[0-9a-f]{40}$/);
  const base = `https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/1014/`;
  for (const [id, [, productIssue, file]] of Object.entries(families)) {
    const refs = new Set(contracts[id].references);
    assert.ok(refs.has(`${base}${file}`), `${id}: handoff permalink`);
    assert.ok(refs.has(`${base}README.md`), `${id}: handoff index`);
    assert.ok(refs.has('https://github.com/redact-secret/redact-secret/issues/1014'), `${id}: #1014`);
    assert.ok(refs.has(`https://github.com/redact-secret/redact-secret/issues/${productIssue}`), `${id}: product issue`);
    assert.ok(refs.has('https://github.com/redact-secret/redact-secret-benchmarks/issues/528'), `${id}: #528`);
  }
});

test('policy is marked as policy: only the Polar and crates.io checksums are policy fields, and they corroborate only', () => {
  for (const id of Object.keys(families)) {
    const expected = id === 'polar-token' || id === 'crates-io-trusted-publishing-token' ? ['policy-checksum'] : [];
    assert.deepEqual(policyFields(id).map(f => f.field), expected, id);
    for (const f of policyFields(id)) {
      assert.equal(f.basis, 'research-hypothesis', `${id}.${f.field}: policy is never a provider basis`);
      assert.match(f.claim, /^POLICY, not T1: .*never rejects/, `${id}.${f.field}`);
    }
    for (const f of contracts[id].fields.filter(x => !x.field.startsWith('policy-') && x.basis === 'research-hypothesis'))
      assert.equal(f.field, 'boundary', `${id}.${f.field}: a research hypothesis outside policy is a boundary decision`);
  }
  for (const id of ['polar-token', 'crates-io-trusted-publishing-token']) {
    assert.ok(contracts[id].fields.some(f => f.field === 'checksum' && f.basis === 'provider-code'), `${id}: the checksum itself is a provider fact`);
    assert.match(contracts[id].review, /POLICY, not T1/, id);
  }
});

test('every target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => Object.hasOwn(families, c.target));
  assert.equal(counts.length, 14);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
});

test('every family has a positive in each of the nine #860 probe contexts', () => {
  const probe = ['bare-prose', 'dotenv', 'export', 'bearer-header', 'x-api-key-header', 'json-token', 'json-api-key', 'sdk-kwarg', 'chat-paste'];
  for (const target of Object.keys(families))
    for (const slug of probe) assert.ok(fixturesOf(target).some(f => f.id === `${target}-${slug}` && secretsOf(f).length), `${target}-${slug}`);
});

test('no #528 source file carries a complete synthetic credential as a literal', async () => {
  const files = [...slices.flatMap(key => [`fixtures/generated/beta8/${key}.mjs`, `benchmarks/lib/beta8/${key}.ts`]), 'fixtures/generated/beta8/528-shared.mjs', 'benchmarks/lib/beta8/528-sources.ts', 'tests/beta12-528-corpus.test.mjs'];
  const shapes = [/0\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9]{30}:/i, /polar_[a-z_]{2,6}_[A-Za-z0-9_-]{40,}/, /sq[uap]_[0-9a-f]{40}/,
    /rubygems_[0-9a-f]{40,}/, /CLOJARS_[0-9a-f]{40,}/, /\bcio(?:_tp_)?[A-Za-z0-9]{30,}/, /dt0[cs][0-9]{2}\.[A-Z2-7]{24}\./, /pdl_(?:live|sdbx)_apikey_[a-z0-9]{20,}/,
    /hc[a-z]i[kc]_[a-z0-9]{40,}/, /xa[ap]t-[0-9a-f]{8}-[0-9a-f]{4}-/];
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
      assert.ok(f.mutation && f.mutationKind && !['context', 'checksum'].includes(f.mutationKind), `${f.id}: a structural twin, never a checksum twin`);
      assert.equal(f.expected.length, 0, `${f.id}: a structural twin asserts silence`);
    }
  }
});

test('checksums corroborate only: Polar polar_oat_ and crates.io cio_tp_ positives carry both matching and mismatching checks', () => {
  const polar = valuesOf('polar-token').map(v => v.slice(10));
  const polarOk = polar.filter(b => polarChecksum(b.slice(0, 37)) === b.slice(37));
  assert.ok(polarOk.length >= 9, 'probe positives carry the provider checksum');
  assert.equal(polar.length - polarOk.length, 2, 'two shape-valid positives with a wrong checksum are still positives');
  assert.ok(positivesOf('polar-token').filter(f => f.id.includes('checksum-mismatch')).every(f => polarChecksum(valueOf(f, secretsOf(f)[0]).slice(10, 47)) !== valueOf(f, secretsOf(f)[0]).slice(47)));
  const tp = valuesOf('crates-io-trusted-publishing-token').map(v => v.slice(7));
  assert.equal(tp.filter(b => cratesCheckChar(b.slice(0, 31)) !== b[31]).length, 2, 'two positives with a wrong check character');
  for (const target of Object.keys(families)) assert.ok(!fixturesOf(target).some(f => f.twinOf && /checksum|check character/i.test(f.mutation)), `${target}: no checksum twin`);
});

test('Bitwarden: 94-byte positives with canonical padded keys; the unpadded key is a twin; version-dotted UUIDs and Password Manager ids are controls', () => {
  const values = valuesOf('bitwarden-secrets-manager-access-token');
  assert.ok(values.every(v => v.length === 94 && Buffer.from(v.slice(70), 'base64').length === 16));
  assert.ok(values.some(v => /[A-F]/.test(v.slice(2, 38))), 'an uppercase UUID (parser-accepted) is a positive');
  const twins = fixturesOf('bitwarden-secrets-manager-access-token').filter(f => f.twinOf).map(f => f.id);
  for (const t of ['unpadded-key', 'single-padding', 'secret-29', 'secret-31', 'key-21', 'key-23', 'version-1', 'leading-digit-glue', 'leading-v-glue', 'trailing-glue']) assert.ok(twins.some(id => id.includes(t)), t);
  for (const slug of ['secret-without-key', 'version-dotted-uuid', 'semver-then-uuid', 'password-manager-client-id']) assert.ok(controlsOf('bitwarden-secrets-manager-access-token').some(f => f.id.includes(slug)), slug);
});

test('Polar: seven role prefixes and both eras are positives; polar_ci_ and checkout secrets are controls; whsec_ is not authored', () => {
  const values = valuesOf('polar-api-credential');
  assert.deepEqual([...new Set(values.map(v => v.match(/^polar_([a-z_]+?)_(?=[A-Za-z0-9_-]{43}$)/)[1]))].sort(), ['at_o', 'at_u', 'crt', 'cs', 'pat', 'rt_o', 'rt_u']);
  assert.ok(values.some(v => /[-_]/.test(v.slice(-43))) && values.some(v => /^[A-Za-z0-9]{43}$/.test(v.slice(-43))), 'era-1 and era-2 bodies');
  for (const target of ['polar-token', 'polar-api-credential']) assert.ok(controlsOf(target).some(f => /polar_c[il]?_/.test(f.content)), `${target}: a public or browser-side sibling control`);
  for (const [, corpus] of corpora.filter(([id]) => id === 'beta8-528b')) assert.ok(!corpus.fixtures.some(f => /whsec_/.test(f.content)), 'whsec_ belongs to stripe-token and is not authored');
});

test('SonarQube: squ_ is the user family and sqa_/sqp_ the analysis family; sqb_ badge tokens and bare SHAs are controls only', () => {
  assert.ok(valuesOf('sonarqube-token').every(v => v.startsWith('squ_')));
  const a = valuesOf('sonarqube-analysis-token');
  assert.ok(a.some(v => v.startsWith('sqa_')) && a.some(v => v.startsWith('sqp_')) && a.every(v => /^sq[ap]_/.test(v)));
  for (const target of ['sonarqube-token', 'sonarqube-analysis-token']) {
    assert.ok(!positivesOf(target).some(f => /sqb_/.test(f.content)), `${target}: sqb_ never beside a positive`);
    assert.ok(controlsOf(target).some(f => /token=sqb_[0-9a-f]{40}/.test(f.content)), `${target}: a badge URL control`);
  }
});

test('crates.io: cio and cio_tp_ never cross; cio words, identifiers and a cio run inside a longer value are controls', () => {
  assert.ok(valuesOf('crates-io-token').every(v => !v.startsWith('cio_')));
  assert.ok(valuesOf('crates-io-trusted-publishing-token').every(v => v.startsWith('cio_tp_')));
  for (const slug of ['cio-words', 'cio-identifiers', 'cio-inside-long-run']) assert.ok(controlsOf('crates-io-token').some(f => f.id.includes(slug)), slug);
});

test('Dynatrace: dt0c01, dt0s01 and dt0s16 positives, the URL-encoded OTel header and the Api-Token scheme; the token identifier alone is a control', () => {
  const values = valuesOf('dynatrace-token');
  assert.deepEqual([...new Set(values.map(v => v.slice(0, 6)))].sort(), ['dt0c01', 'dt0s01', 'dt0s16']);
  assert.ok(positivesOf('dynatrace-token').some(f => /Api-Token%20dt0/.test(f.content)), 'the documented URL-encoded OTel form');
  assert.ok(positivesOf('dynatrace-token').some(f => /Authorization: Api-Token dt0/.test(f.content)));
  assert.equal(controlsOf('dynatrace-token').filter(f => /dt0[cs][0-9]{2}\.[A-Z2-7]{24}(?![A-Z2-7.])/.test(f.content)).length, 2, 'the token identifier alone, in a log and in a UI table');
});

test('Paddle: live and sandbox keys; the apikey_ id alone and a legacy-shaped value are controls; every segment has a length twin', () => {
  const values = valuesOf('paddle-api-key');
  assert.ok(values.some(v => v.startsWith('pdl_live_')) && values.some(v => v.startsWith('pdl_sdbx_')));
  assert.ok(controlsOf('paddle-api-key').filter(f => /"?apikey_[a-z0-9]{26}\b/.test(f.content) && !/pdl_/.test(f.content)).length >= 2);
  for (const t of ['id-25', 'id-27', 'secret-21', 'secret-23', 'suffix-2', 'suffix-4', 'test-environment', 'missing-apikey']) assert.ok(fixturesOf('paddle-api-key').some(f => f.twinOf && f.id.includes(t)), t);
});

test('Honeycomb: ik_ and ic_ with several type letters are positives; key and environment ids are controls; no management key is authored', () => {
  const values = valuesOf('honeycomb-api-key');
  assert.ok(values.some(v => v.slice(3, 6) === 'ik_') && values.some(v => v.slice(3, 6) === 'ic_'));
  assert.ok(new Set(values.map(v => v[2])).size >= 4, 'more than one type letter');
  const corpus = generated['beta8-528i'];
  assert.ok(!corpus.fixtures.some(f => /hc[a-z]mk_[A-Za-z0-9]{26}:/.test(f.content)), 'the issuance-gated management key is authored neither way');
  for (const slug of ['ingest-key-id', 'environment-id', 'configuration-key-id']) assert.ok(controlsOf('honeycomb-api-key').some(f => f.id.includes(slug)), slug);
});

test('Axiom: xaat- and xapt- are separate families over the same lowercase UUID body; placeholders and bare UUIDs are controls', () => {
  assert.ok(valuesOf('axiom-token').every(v => v.startsWith('xaat-')));
  assert.ok(valuesOf('axiom-personal-token').every(v => v.startsWith('xapt-')));
  assert.ok(controlsOf('axiom-token').some(f => /xaat-your-api-token/.test(f.content)) && controlsOf('axiom-token').some(f => f.id.includes('bare-uuid')));
});

test('peer labels map to the arrival families they measure; unmapped pinned-peer labels are recorded as lag', () => {
  assert.deepEqual(findingFamily('gitleaks', 'rubygems-api-token'), { family: 'rubygems-api-key' });
  assert.deepEqual(findingFamily('gitleaks', 'clojars-api-token'), { family: 'clojars-deploy-token' });
  assert.deepEqual(findingFamily('gitleaks', 'dynatrace-api-token'), { family: 'dynatrace-token' });
  assert.deepEqual(findingFamily('gitleaks', 'sonar-api-token'), { family: 'sonarqube-token' });
  assert.deepEqual(findingFamily('trufflehog', 'RubyGems'), { family: 'rubygems-api-key' });
  assert.deepEqual(findingFamily('trufflehog', 'SonarCloud'), {});
  assert.deepEqual(findingFamily('trufflehog', 'Honeycomb'), {});
  for (const id of ['bitwarden-secrets-manager-access-token', 'polar-token', 'polar-api-credential', 'crates-io-token', 'crates-io-trusted-publishing-token', 'paddle-api-key', 'axiom-token', 'axiom-personal-token'])
    assert.match(contracts[id].fields.find(f => f.field === 'peer-lag').claim, /^no .* rule in trufflehog 3\.97\.4 or gitleaks 8\.30\.1/, id);
  assert.match(contracts['dynatrace-token'].fields.find(f => f.field === 'peer-lag').claim, /dt0c01 only/);
  assert.match(contracts['clojars-deploy-token'].fields.find(f => f.field === 'peer-lag').claim, /overreaches/);
  assert.match(contracts['rubygems-api-key'].fields.find(f => f.field === 'peer-lag').claim, /overreaches on a non-hex body/);
});
