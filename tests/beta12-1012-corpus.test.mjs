import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts, classifyFixture } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/beta8/index.ts';
import { EVIDENCE_REVISION } from '../benchmarks/lib/beta8/1012-sources.ts';
import { gitlabRoutablePatValid } from '../benchmarks/lib/beta8/1012c.ts';
import { beta8ProfileCounts } from '../scripts/report-beta8-profiles.mjs';
import { findingFamily, scoredArrivalFamilies } from '../scanners/families.mjs';
import { vercelChecksum } from '../fixtures/generated/beta8/1012-shared.mjs';

// Beta.12 #1012 first-measured variants (#528): the conventions tests/beta8.test.mjs cannot see because they are specific
// to these five slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = 'abcde'.split('').map(k => `1012${k}`);
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
// id -> [taxonomy family, kind, tier, product issue, record file]
const families = {
  'aws-secret-access-key': ['aws:iam-user-secret-access-key', 'registry', 'T2', 1028, '1012/aws-iam-user-secret-access-key.md'],
  'google-oauth-client-secret': ['google:oauth-client-secret', 'registry', 'T2', 1029, '1012/google-oauth2-credential.md'],
  'gitlab-routable-personal-access-token': ['gitlab:routable-personal-access-token', 'unscored', 'T1', 1022, '1012/gitlab-routable-personal-access-token.md'],
  'aws-sts-temporary-access-key': ['aws:sts-temporary-access-key', 'unscored', 'T2', 1027, '1012/aws-sts-temporary-access-key.md'],
  'vercel-personal-access-token': ['vercel:personal-access-token', 'scored', 'T2', 1036, '1013/vercel.md'],
  'vercel-app-access-token': ['vercel:app-access-token', 'scored', 'T2', 1036, '1013/vercel.md'],
  'vercel-app-refresh-token': ['vercel:app-refresh-token', 'scored', 'T2', 1036, '1013/vercel.md'],
};
const targetOf = f => (f.arrivalTargets ?? f.detectors)[0];
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();
const fixturesOf = target => corpora.flatMap(([category, c]) => c.fixtures.filter(f => targetOf(f) === target).map(f => ({ ...f, category })));
const positivesOf = target => fixturesOf(target).filter(f => secretsOf(f).length && !f.twinOf);
const valuesOf = target => positivesOf(target).map(f => valueOf(f, secretsOf(f)[0]));
const inside = (id, v) => new RegExp(contracts[id].pattern).test(v) && (!contracts[id].validate || contracts[id].validate(v));

test('the seven #1012 families: two registry detectors, two unscored and three scored arrival families, each with its taxonomy row', async () => {
  const taxonomy = await read('benchmarks/support/taxonomy.json');
  const registry = new Set((await read('benchmarks/detectors.json')).detectors.map(d => d.id));
  assert.deepEqual(modules.map(m => m.issue), slices);
  for (const [id, [taxonomyId, kind, tier]] of Object.entries(families)) {
    const row = taxonomy.families.find(f => f.id === taxonomyId);
    assert.ok(row, `${id}: taxonomy row ${taxonomyId}`);
    assert.equal(row.supportStatus, undefined, `${id}: no hand-edited support status`);
    assert.equal(contracts[id].tier, tier, id);
    if (kind === 'registry') {
      assert.ok(registry.has(id) && !arrivalIds.has(id), `${id}: a registry detector at the pin`);
      assert.deepEqual(row.detectors, [id]);
    } else {
      assert.ok(arrivalIds.has(id) && !registry.has(id), `${id}: an arrival family`);
      assert.equal(scoredArrivalFamilies.includes(id), kind === 'scored', `${id}: ${kind}`);
      assert.deepEqual(row.detectors, kind === 'scored' ? [id] : [], id);
    }
  }
  assert.equal(contracts['aws-secret-access-key'].contextGated, true, 'no bare-value claim for the unprefixed AWS secret');
});

test('every contract traces to its research record at the frozen product revision, its product issue and #528', () => {
  assert.equal(EVIDENCE_REVISION, '4fb78827f1ddf5b3106f25130ca510a836ada186');
  const base = `https://github.com/redact-secret/redact-secret/blob/${EVIDENCE_REVISION}/docs/audits/evidence/`;
  for (const [id, [, , , productIssue, file]] of Object.entries(families)) {
    const refs = new Set(contracts[id].references);
    assert.ok(refs.has(`${base}${file}`), `${id}: record permalink`);
    assert.ok(refs.has(`https://github.com/redact-secret/redact-secret/issues/${productIssue}`), `${id}: product issue`);
    assert.ok(refs.has('https://github.com/redact-secret/redact-secret-benchmarks/issues/528'), `${id}: #528`);
    assert.ok(contracts[id].fields.some(f => f.field === 'peer-lag' && f.basis === 'tool'), `${id}: records where the pinned peers lag or overreach`);
    if (contracts[id].tier === 'T2') assert.ok(contracts[id].corroboration.length >= 2, `${id}: T2 names its corroboration`);
  }
});

test('the product finding types map to the families that are scored by them, and the shared types do not', () => {
  assert.deepEqual(findingFamily('redact-secret', 'vercel-token', 'vercel_personal_access_token'), { family: 'vercel-personal-access-token' });
  assert.deepEqual(findingFamily('redact-secret', 'vercel-token', 'vercel_app_access_token'), { family: 'vercel-app-access-token' });
  assert.deepEqual(findingFamily('redact-secret', 'vercel-token', 'vercel_app_refresh_token'), { family: 'vercel-app-refresh-token' });
  assert.deepEqual(findingFamily('redact-secret', 'vercel-token', 'vercel_token'), { family: 'vercel-token' });
  assert.deepEqual(findingFamily('redact-secret', 'gitlab-token', 'gitlab_token'), { family: 'gitlab-token' });
  assert.deepEqual(findingFamily('redact-secret', 'aws-access-key', 'aws_access_key_id'), { family: 'aws-access-key' });
  assert.deepEqual(findingFamily('redact-secret', 'aws-secret-access-key', 'aws_secret_access_key'), { family: 'aws-secret-access-key' });
  assert.deepEqual(findingFamily('redact-secret', 'google-oauth-client-secret', 'google_oauth_client_secret'), { family: 'google-oauth-client-secret' });
});

test('every target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => Object.hasOwn(families, c.target));
  assert.equal(counts.length, 7);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
  assert.equal(counts.find(c => c.target === 'aws-secret-access-key').profile, 'context-48');
});

test('every positive satisfies its contract and every twin is outside it or keeps the value beside a removed gate', () => {
  for (const [category, corpus] of corpora) {
    const byId = new Map(corpus.fixtures.map(f => [f.id, f]));
    for (const f of corpus.fixtures) {
      const id = targetOf(f);
      for (const r of secretsOf(f)) assert.ok(inside(id, valueOf(f, r)), `${category}--${f.id}`);
      if (!f.twinOf) continue;
      const positive = byId.get(f.twinOf);
      assert.ok(positive && secretsOf(positive).length, `${f.id}: twin names an authored positive`);
      assert.equal(f.expected.length, 0, `${f.id}: a twin asserts silence`);
      if (f.mutationKind === 'context') {
        assert.equal(id, 'aws-secret-access-key', `${f.id}: only the context-gated family has context twins`);
        assert.ok(f.content.includes(valueOf(positive, secretsOf(positive)[0])), `${f.id}: keeps the value byte-for-byte`);
      }
    }
  }
});

test('AWS secret: every positive carries a gate, the bare value is a control, and the AKIA id is a companion after the value', () => {
  const gate = /aws_secret_access_key|AWS_SECRET_ACCESS_KEY|SecretAccessKey|secretAccessKey|aws_secret_key|secret access key|AKIA[A-Z2-7]{16}/;
  for (const f of positivesOf('aws-secret-access-key')) {
    assert.match(f.content, gate, f.id);
    assert.equal(classifyFixture(f.category, f).kind, 'policy', `${f.id}: context-gated positives are policy`);
    const companions = f.expected.filter(r => r.role === 'companion');
    if (companions.length) assert.ok(companions.every(r => r.start > secretsOf(f)[0].end && /^AKIA/.test(valueOf(f, r))), f.id);
  }
  assert.ok(positivesOf('aws-secret-access-key').filter(f => f.expected.some(r => r.role === 'companion')).length >= 2);
  const twins = fixturesOf('aws-secret-access-key').filter(f => f.twinOf);
  assert.ok(twins.filter(f => f.mutationKind === 'context').length >= 10);
  for (const t of ['value-39', 'value-41', 'equals-inside', 'hyphen-inside']) assert.ok(twins.some(f => f.id.includes(t)), t);
  assert.ok(fixturesOf('aws-secret-access-key').some(f => f.id.endsWith('bare-line-near-miss')));
});

test('GitLab routable: every positive passes the provider CRC and length check; checksum and length-holder twins fail only that check', () => {
  const values = valuesOf('gitlab-routable-personal-access-token');
  assert.ok(values.every(gitlabRoutablePatValid));
  const widths = values.map(v => v.slice(6).split('.')[0].length);
  assert.ok(widths.includes(27) && widths.includes(300), 'the documented payload bounds');
  const twins = fixturesOf('gitlab-routable-personal-access-token').filter(f => f.twinOf);
  for (const t of ['checksum-mismatch', 'length-holder-mismatch', 'version-one-char', 'missing-separator', 'uppercase-base36', 'payload-26', 'leading-glue', 'trailing-glue']) assert.ok(twins.some(f => f.id.includes(t)), t);
  assert.equal(twins.find(f => f.id.includes('checksum-mismatch')).mutationKind, 'checksum');
  for (const [, c] of corpora.filter(([id]) => id === 'beta8-1012c')) assert.ok(!c.fixtures.some(f => /glrt-|glpat-[A-Za-z0-9_-]{20}(?![A-Za-z0-9_.-])/.test(f.content)), 'no legacy glpat- or glrt- value is authored');
});

test('ASIA: bodies cover both the base32 class and the wider [A-Z0-9]; a bare id scores as policy; AKIA is not authored', () => {
  const values = valuesOf('aws-sts-temporary-access-key');
  assert.ok(values.some(v => /[0189]/.test(v.slice(4))) && values.some(v => /^[A-Z2-7]{16}$/.test(v.slice(4))));
  for (const f of positivesOf('aws-sts-temporary-access-key')) assert.equal(classifyFixture(f.category, f).kind, 'policy', f.id);
  for (const [, c] of corpora.filter(([id]) => id === 'beta8-1012d')) assert.ok(!c.fixtures.some(f => /AKIA[A-Z0-9]{16}/.test(f.content)));
});

test('Vercel: each class is marker_ + 56 alphanumerics; the checksum suffix corroborates only; vci_ and vck_ are not authored', () => {
  for (const [id, marker] of [['vercel-personal-access-token', 'vcp_'], ['vercel-app-access-token', 'vca_'], ['vercel-app-refresh-token', 'vcr_']]) {
    const values = valuesOf(id);
    assert.ok(values.every(v => v.startsWith(marker) && v.length === 60));
    const ok = values.filter(v => vercelChecksum(v.slice(4, 54)) === v.slice(54));
    assert.equal(values.length - ok.length, 2, `${id}: two positives with a wrong suffix are still positives`);
    assert.ok(!fixturesOf(id).some(f => f.twinOf && /checksum|suffix/i.test(f.mutation)), `${id}: no checksum twin`);
  }
  for (const [, c] of corpora.filter(([id]) => id === 'beta8-1012e')) assert.ok(!c.fixtures.some(f => /vc[ik]_/.test(f.content)));
});

test('no #1012 source file carries a complete synthetic credential as a literal', async () => {
  const files = [...slices.flatMap(key => [`fixtures/generated/beta8/${key}.mjs`, `benchmarks/lib/beta8/${key}.ts`]), 'fixtures/generated/beta8/1012-shared.mjs', 'benchmarks/lib/beta8/1012-sources.ts', 'tests/beta12-1012-corpus.test.mjs'];
  const shapes = [/GOCSPX-[A-Za-z0-9_-]{28}/, /glpat-[A-Za-z0-9_-]{27,}\./, /ASIA[A-Z0-9]{16}/, /AKIA[A-Z0-9]{16}/, /vc[par]_[A-Za-z0-9]{56}/];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const shape of shapes) assert.equal(shape.test(source), false, `${file} matches ${shape}`);
  }
});
