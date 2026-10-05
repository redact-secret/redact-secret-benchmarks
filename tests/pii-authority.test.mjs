import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { checkPiiAuthority, computeCriteria, filesNamingTheAuthorityFile } from '../scripts/check-pii-authority.mjs';
import {
  PII_AUTHORITY_FILE, PII_AUTHORITY_READERS, PII_EXIT_CRITERIA, criteriaDriftProblems, piiAuthorityFreshnessProblems, piiAuthorityShapeProblems, unlistedPiiAuthorityReaders,
} from '../benchmarks/evaluation/domains/pii/authority.ts';

// Structure and rules only. Which value is committed, and which digests the evidence has, is never asserted: the gate (pii:authority:check)
// holds the committed file against the repository. These tests choose their own values, and every authorisation here is a synthetic
// fixture of the validator, never an acceptance.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const committed = await read(PII_AUTHORITY_FILE);
const schema = await read('schemas/pii-authority-v1.json');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const clone = () => structuredClone(committed);
const hex = c => c.repeat(64);

const allMet = () => Object.fromEntries(PII_EXIT_CRITERIA.map(c => [c.id, 'met']));
const newFile = () => {
  const file = clone();
  file.authority = 'new';
  file.exitCriteria = file.exitCriteria.map(c => ({ ...c, state: 'met' }));
  file.new.target.engine = `redact-secret/pii-eval@${'a'.repeat(40)}`;
  file.new.target.populations = ['pop-a', 'pop-b'];
  file.new.authorisation = {
    release: 'synthetic-fixture', acceptedOn: '2000-01-01', acceptedBy: 'synthetic-fixture', decision: 'docs/decisions/2000-01-01-synthetic-fixture.md',
    engineCommit: 'a'.repeat(40), policyDigest: hex('1'), populationDigests: { 'pop-a': hex('2'), 'pop-b': hex('3') },
  };
  return file;
};
const context = () => ({ computed: allMet(), policyDigest: hex('1'), engineCommit: 'a'.repeat(40), populationDigests: { 'pop-a': hex('2'), 'pop-b': hex('3') }, decisionStatus: 'accepted' });

test('the committed PII authority file is one valid value, and the gate holds', async () => {
  assert.deepEqual(piiAuthorityShapeProblems(committed), []);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.ok(['legacy', 'new'].includes(committed.authority));
  assert.deepEqual(await checkPiiAuthority(), []);
});

test('the schema and the shape check agree: each refuses the same malformed files', () => {
  const mutations = {
    'an unknown authority': f => { f.authority = 'both'; },
    'another schema tag': f => { f.schema = 'redact-secret/pii-authority/v2'; },
    'no legacy block': f => { delete f.legacy; },
    'no new block': f => { delete f.new; },
    'no criteria': f => { delete f.exitCriteria; },
    'an extra top-level field': f => { f.extra = 1; },
    'an extra field in the legacy block': f => { f.legacy.extra = 1; },
    'an authorisation that is not null or an authorisation': f => { f.new.authorisation = 'accepted'; },
    'an authorisation without the owner': f => { f.new.authorisation = { release: 'x' }; },
    'an engine that is not a commit': f => { f.new.target.engine = 'redact-secret/pii-eval@main'; },
    'a decision outside docs/decisions': f => { f.legacy.oracle.decision = 'README.md'; },
    'an exit condition that says nothing': f => { f.legacy.oracle.exitCondition = 'later'; },
    'no one who decides': f => { f.legacy.oracle.decidedBy = ''; },
    'a criterion state that is not met or unmet': f => { f.exitCriteria[0].state = 'maybe'; },
    'a criterion dropped': f => { f.exitCriteria.pop(); },
    'an independence statement that does not name the credential authority': f => { f.independence = 'independent'; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const file = clone(); mutate(file);
    assert.equal(validate(file), false, `the schema accepted ${name}`);
    assert.notDeepEqual(piiAuthorityShapeProblems(file), [], `the shape check accepted ${name}`);
  }
});

test('every exit criterion is listed once, with the basis the rules give it, and the file cannot reorder or relabel them', () => {
  assert.deepEqual(committed.exitCriteria.map(c => [c.id, c.basis]), PII_EXIT_CRITERIA.map(c => [c.id, c.basis]));
  const swapped = clone(); swapped.exitCriteria.reverse();
  assert.ok(piiAuthorityShapeProblems(swapped).some(p => /exitCriteria must be exactly/.test(p)));
  const relabelled = clone(); relabelled.exitCriteria[0].basis = 'owner';
  assert.ok(piiAuthorityShapeProblems(relabelled).some(p => /is computed, not owner/.test(p)));
});

test('legacy asks nothing of the new path, and a recorded criterion that disagrees with the tree is a drift under either value', () => {
  const legacy = clone(); legacy.authority = 'legacy';
  assert.deepEqual(piiAuthorityFreshnessProblems(legacy, { ...context(), computed: {}, decisionStatus: undefined }), []);
  const file = clone();
  const computed = Object.fromEntries(PII_EXIT_CRITERIA.filter(c => c.basis === 'computed').map(c => [c.id, 'unmet']));
  const agreeing = { ...file, exitCriteria: file.exitCriteria.map(c => (c.basis === 'computed' ? { ...c, state: 'unmet' } : c)) };
  assert.deepEqual(criteriaDriftProblems(agreeing, computed), []);
  const stale = { ...agreeing, exitCriteria: agreeing.exitCriteria.map(c => (c.id === 'linux-engine-replay-equal' ? { ...c, state: 'met' } : c)) };
  assert.match(criteriaDriftProblems(stale, computed).join('\n'), /linux-engine-replay-equal is recorded met but the tree computes unmet/);
  assert.match(criteriaDriftProblems(agreeing, { ...computed, 'linux-engine-replay-equal': 'met' }).join('\n'), /recorded unmet but the tree computes met/);
  assert.match(criteriaDriftProblems(agreeing, {}).join('\n'), /cannot be computed/);
});

test('new needs an owner authorisation, and a credential authority setting does not stand in for it', () => {
  assert.deepEqual(piiAuthorityShapeProblems(newFile()), []);
  assert.deepEqual(piiAuthorityFreshnessProblems(newFile(), context()), []);
  const none = newFile(); none.new.authorisation = null;
  const problems = piiAuthorityFreshnessProblems(none, context());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /no owner authorisation is recorded/);
  assert.match(problems[0], /credential authority setting is not authorisation for PII/);
});

test('new is stale after a repin, a policy change, a changed population, an unaccepted decision or an unmet criterion', () => {
  const stale = (mutateContext, mutateFile = () => {}) => { const f = newFile(); mutateFile(f); const c = context(); mutateContext(c); return piiAuthorityFreshnessProblems(f, c).join('\n'); };
  assert.match(stale(c => { c.engineCommit = 'b'.repeat(40); }), /a repin needs a new authorisation/);
  assert.match(stale(c => { c.policyDigest = hex('9'); }), /product policy .* changed/);
  assert.match(stale(c => { c.populationDigests['pop-a'] = hex('9'); }), /population pop-a has semantic digest/);
  assert.match(stale(() => {}, f => { delete f.new.authorisation.populationDigests['pop-b']; }), /does not cover population pop-b/);
  assert.match(stale(c => { c.decisionStatus = 'proposed'; }), /is proposed, not accepted/);
  assert.match(stale(c => { c.decisionStatus = undefined; }), /does not exist/);
  assert.match(stale(c => { c.computed['official-mode-measurement'] = 'unmet'; }), /exit criterion official-mode-measurement is not met/);
  assert.match(stale(() => {}, f => { f.exitCriteria.find(c => c.id === 'owner-accepted-verdict').state = 'unmet'; }), /exit criterion owner-accepted-verdict is not met/);
  assert.match(stale(() => {}, f => { f.new.target.engine = `redact-secret/pii-eval@${'c'.repeat(40)}`; }), /another engine than new.target/);
});

test('the computed criteria are recomputed from the tree, each one met or unmet, and none is hand-decided', async () => {
  const { state, digests, engineCommit } = await computeCriteria();
  assert.deepEqual(Object.keys(state), PII_EXIT_CRITERIA.filter(c => c.basis === 'computed').map(c => c.id));
  assert.ok(Object.values(state).every(v => v === 'met' || v === 'unmet'));
  assert.equal(Object.keys(digests).length, 4);
  assert.match(engineCommit, /^[0-9a-f]{40}$/);
  // A tree with no evidence computes every criterion unmet.
  const bare = await computeCriteria({
    read: path => { const v = JSON.parse(JSON.stringify(readJsonSync(path))); if (path.endsWith('pii-eval-migration.json')) { v.acceptance.benchmarkPopulationDualRun = 'accepted-representable-cases'; } return v; },
    readIfPresent: () => undefined,
  });
  assert.equal(bare.state['linux-engine-replay-equal'], 'unmet');
  assert.equal(bare.state['rollback-rehearsed-for-target'], 'unmet');
  assert.equal(bare.state['legacy-callers-inventoried'], 'unmet');
  assert.equal(bare.state['population-dual-run-complete'], 'unmet');
});

import { readFileSync } from 'node:fs';
function readJsonSync(path) { return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')); }

test('the PII authority is independent of the credential authority: neither names or imports the other', async () => {
  const credentialFile = await readFile(new URL(`../benchmarks/${['qualification', 'authority.json'].join('-')}`, import.meta.url), 'utf8');
  assert.ok(!credentialFile.includes('pii-authority'));
  for (const path of ['benchmarks/evaluation/domains/pii/authority.ts', 'scripts/check-pii-authority.mjs', 'web/services/pii-authority.ts']) {
    const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+['"][^'"]*qualification\/authority|qualification-authority\.json|services\/authority['"]/.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), `${path} reads the credential authority`);
  }
  const credentialReaders = await readFile(new URL('../benchmarks/qualification/authority.ts', import.meta.url), 'utf8');
  assert.ok(!credentialReaders.includes('pii-authority'));
});

test('a path that names the file and is not a listed reader is a new reader, and a reader is a decision', async () => {
  assert.deepEqual(unlistedPiiAuthorityReaders(['web/services/pii-authority.ts', 'docs/specs/pii-authority.md', 'web/tests/unit/pii-authority.test.ts']), []);
  assert.deepEqual(unlistedPiiAuthorityReaders(['web/services/other.ts', 'scripts/publish-pii-support.ts']), ['web/services/other.ts', 'scripts/publish-pii-support.ts']);
  const naming = filesNamingTheAuthorityFile(['a.ts', 'b.ts', 'logo.png'], path => ({ 'a.ts': 'reads benchmarks/pii-authority.json', 'b.ts': 'nothing', 'logo.png': 'benchmarks/pii-authority.json' })[path]);
  assert.deepEqual(naming, ['a.ts']);
  assert.ok(PII_AUTHORITY_READERS.every(r => r.why.length > 10));
});
