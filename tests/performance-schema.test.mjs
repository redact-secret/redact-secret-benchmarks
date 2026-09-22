import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { completeAssessmentProblem } from '../benchmarks/lib/performance-schema.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: true, allErrors: true });
const validAssessment = ajv.compile(await read('schemas/performance-assessment-v1.json'));
const validCriteria = ajv.compile(await read('schemas/performance-criteria-v1.json'));

test('the committed release-build evidence summary matches the pinned assessment schema', async () => {
  const summary = await read('evidence/603/summary.json');
  const valid = validAssessment(summary);
  assert.ok(valid, JSON.stringify(validAssessment.errors));
  assert.equal(completeAssessmentProblem(summary), null);
});

test('the committed performance criteria match their schema', async () => {
  const criteria = await read('benchmarks/performance-criteria.json');
  const valid = validCriteria(criteria);
  assert.ok(valid, JSON.stringify(validCriteria.errors));
});

test('completeAssessmentProblem rejects a schemaVersion the pin does not recognize', () => {
  const problem = completeAssessmentProblem({ schemaVersion: '2', status: 'complete', repetitions: 5, performanceProfiles: [], requiredSurfaces: [], runs: [], validationFailures: [] });
  assert.match(problem, /schemaVersion/);
});

test('completeAssessmentProblem rejects an unrecognized surface', () => {
  const problem = completeAssessmentProblem({
    schemaVersion: '1', status: 'complete', repetitions: 5, performanceProfiles: [], requiredSurfaces: [],
    runs: [{ surface: 'java', kind: 'performance', profileId: 'x', resultPath: 'x', markdownPath: 'x', path: 'whole-input', status: 'complete' }],
    validationFailures: [],
  });
  assert.match(problem, /unrecognized surface/);
});

test('completeAssessmentProblem accepts a minimal, well-formed summary', () => {
  const problem = completeAssessmentProblem({
    schemaVersion: '1', status: 'incomplete', repetitions: 0, performanceProfiles: [], requiredSurfaces: ['rust-core'], runs: [], validationFailures: ['x'],
  });
  assert.equal(problem, null);
});
