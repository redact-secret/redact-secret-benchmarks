import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { checkQualificationAuthority, filesNamingTheAuthorityFile } from '../scripts/check-qualification-authority.mjs';
import { AUTHORITY_FILE, AUTHORITY_READERS, authorityFreshnessProblems, authorityShapeProblems, unlistedReaders } from '../benchmarks/qualification/authority.ts';

// Structure and rules only. Which value is committed, and which digests it names, is never asserted: the gate (authority:check) holds
// the committed file against the repository, and a repin or a new run is what makes `new` stale. These tests choose their own values.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const committed = await read(AUTHORITY_FILE);
const schema = await read('schemas/qualification-authority-v1.json');
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const clone = () => structuredClone(committed);

const digest = c => `sha256:${c.repeat(64)}`;
const newFile = () => ({
  ...clone(), authority: 'new',
  new: { ...committed.new, policyRevision: `rs-policy-1:sha256:${'a'.repeat(64)}`, semanticDigests: { 'pop-a': digest('1'), 'pop-a+methods': digest('2'), 'pop-b': digest('3') } },
});
const context = () => ({
  policyRevision: `rs-policy-1:sha256:${'a'.repeat(64)}`,
  runs: [
    { id: 'pop-a@linux-x64', canonical: true, semanticDigest: digest('1') },
    { id: 'pop-a+methods@linux-x64', canonical: true, semanticDigest: digest('2') },
    { id: 'pop-b@linux-x64', canonical: true, semanticDigest: digest('3') },
    { id: 'pop-b@darwin-arm64', canonical: false, semanticDigest: digest('9') },
  ],
  parity: {
    summary: { unexplained: 0 },
    identities: { new: { policyRevision: `rs-policy-1:sha256:${'a'.repeat(64)}`, populations: [
      { population: 'pop-a', run: 'pop-a@linux-x64', semanticDigest: digest('1'), methodsRun: { run: 'pop-a+methods@linux-x64', semanticDigest: digest('2') } },
      { population: 'pop-b', run: 'pop-b@linux-x64', semanticDigest: digest('3') },
    ] } },
  },
  decisionStatus: 'accepted',
  exitDecisionStatus: 'accepted',
  exitRehearsalPresent: true,
});

test('the committed authority file is one valid value, and the gate holds', async () => {
  assert.deepEqual(authorityShapeProblems(committed), []);
  assert.equal(validate(committed), true, JSON.stringify(validate.errors));
  assert.ok(['legacy', 'new'].includes(committed.authority));
  assert.deepEqual(await checkQualificationAuthority(), []);
});

test('the schema and the shape check agree: each refuses the same malformed files', () => {
  const mutations = {
    'an unknown authority': f => { f.authority = 'both'; },
    'another schema tag': f => { f.schema = 'redact-secret/qualification-authority/v2'; },
    'no legacy block': f => { delete f.legacy; },
    'no authorisation block': f => { delete f.new; },
    'an extra top-level field': f => { f.extra = 1; },
    'an extra field in the authorisation': f => { f.new.extra = 1; },
    'a policy revision that is not a revision': f => { f.new.policyRevision = 'nope'; },
    'a digest that is not a digest': f => { f.new.semanticDigests['pop-a'] = 'sha256:abc'; },
    'no run named': f => { f.new.semanticDigests = {}; },
    'a decision outside docs/decisions': f => { f.new.decision = 'README.md'; },
    'a parity report outside docs/generated': f => { f.new.parityReport = 'elsewhere/report.json'; },
    'no exit condition for the oracle period': f => { f.legacy.oracle.exitCondition = 'later'; },
    'a release that is not a package version': f => { f.new.release = 'beta.12'; },
    'an exit with no owner': f => { f.legacy.oracle.exit.recordedBy = ''; },
    'an exit with an unknown field': f => { f.legacy.oracle.exit.extra = 1; },
    'an exit that names another inventory command': f => { f.legacy.oracle.exit.callerInventory = 'npm test'; },
    'an exit whose rehearsal has no anchor': f => { f.legacy.oracle.exit.rollbackRehearsal = 'docs/specs/qualification-cutover.md'; },
    'an exit whose decision is outside docs/decisions': f => { f.legacy.oracle.exit.decision = 'README.md'; },
  };
  for (const [name, change] of Object.entries(mutations)) {
    const f = newFile();
    change(f);
    assert.notEqual(validate(f), true, `the schema accepts ${name}`);
    assert.notDeepEqual(authorityShapeProblems(f), [], `the shape check accepts ${name}`);
  }
  assert.equal(validate(newFile()), true);
  assert.deepEqual(authorityShapeProblems(newFile()), []);
});

test('legacy asks nothing of the new path: a stale authorisation does not matter while the value is legacy, and rolling back leaves it in place', () => {
  const f = newFile();
  f.authority = 'legacy';
  assert.deepEqual(authorityFreshnessProblems(f, { ...context(), policyRevision: `rs-policy-1:sha256:${'f'.repeat(64)}`, runs: [], parity: undefined, decisionStatus: undefined }), []);
});

test('new is authorised only while the policy, every canonical run, the parity report and the decision hold', () => {
  assert.deepEqual(authorityFreshnessProblems(newFile(), context()), []);
  const problems = change => authorityFreshnessProblems(newFile(), (() => { const c = context(); change(c); return c; })()).join(' | ');
  assert.match(problems(c => { c.policyRevision = `rs-policy-1:sha256:${'b'.repeat(64)}`; }), /policy inputs changed/);
  assert.match(problems(c => { c.runs[0].semanticDigest = digest('7'); }), /new official run needs a new authorisation/);
  assert.match(problems(c => { c.runs = c.runs.filter(r => r.id !== 'pop-b@linux-x64'); }), /records no canonical run/);
  assert.match(problems(c => { c.runs.push({ id: 'pop-c@linux-x64', canonical: true, semanticDigest: digest('4') }); }), /not covered by the authorisation/);
  assert.equal(problems(c => { c.runs.find(r => !r.canonical).semanticDigest = digest('8'); }), '', 'a non-canonical run never makes the authorisation stale');
  assert.match(problems(c => { c.parity = undefined; }), /absent/);
  assert.match(problems(c => { c.parity.summary.unexplained = 3; }), /unexplained differences/);
  assert.match(problems(c => { c.parity.identities.new.policyRevision = `rs-policy-1:sha256:${'c'.repeat(64)}`; }), /compared the policy/);
  assert.match(problems(c => { c.parity.identities.new.populations[1].semanticDigest = digest('6'); }), /compared another run of pop-b/);
  assert.match(problems(c => { c.decisionStatus = undefined; }), /does not exist/);
  assert.match(problems(c => { c.decisionStatus = 'proposed'; }), /not accepted/);
});

test('a recorded oracle exit holds only for the authorised release, its parity report, an accepted decision and a rehearsal that resolves (#660)', () => {
  const exit = newFile().legacy.oracle.exit;
  assert.ok(exit, 'the committed file records the exit');
  const problems = (change, edit = () => {}) => authorityFreshnessProblems((() => { const f = newFile(); edit(f); return f; })(), (() => { const c = context(); change(c); return c; })()).join(' | ');
  assert.equal(problems(() => {}), '');
  assert.match(problems(() => {}, f => { f.legacy.oracle.exit.release = '@redact-secret/core@9.9.9'; }), /a new release needs its own exit/);
  assert.match(problems(() => {}, f => { f.legacy.oracle.exit.parityReport = 'docs/generated/other-report.json'; }), /oracle exit cites/);
  assert.match(problems(c => { c.exitDecisionStatus = undefined; }), /does not exist/);
  assert.match(problems(c => { c.exitDecisionStatus = 'proposed'; }), /not accepted/);
  assert.match(problems(c => { c.exitRehearsalPresent = false; }), /does not resolve to a heading/);
  const without = newFile(); delete without.legacy.oracle.exit;
  assert.deepEqual(authorityShapeProblems(without), [], 'an authority file without an exit is still valid: the exit is a record, not a requirement');
  assert.equal(validate(without), true);
});

test('only listed readers may name the file; a new reader is a decision', () => {
  assert.deepEqual(unlistedReaders([AUTHORITY_FILE, 'web/services/authority.ts', 'docs/specs/qualification-cutover.md', 'web/scripts/check-export.mjs', 'web/tests/unit/overlay.ts']), []);
  assert.deepEqual(unlistedReaders(['scripts/publish-site.mjs', 'web/services/run.ts', '.github/workflows/publish-site.yml']), ['scripts/publish-site.mjs', 'web/services/run.ts', '.github/workflows/publish-site.yml']);
  assert.ok(AUTHORITY_READERS.every(r => r.why.length > 10), 'every reader says why it reads the file');
  const texts = new Map([['a.mjs', 'reads benchmarks/qualification-authority.json'], ['b.mjs', 'nothing'], ['c.png', 'qualification-authority.json']]);
  assert.deepEqual(filesNamingTheAuthorityFile([...texts.keys()], path => texts.get(path)), ['a.mjs']);
});
