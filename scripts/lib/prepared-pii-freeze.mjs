import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { b11Commitment, b11PlanSetOf, B11_EXPECTED_ACTIVATION } from '../../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { b11ProtectedEpochs } from '../../benchmarks/evaluation/domains/pii/beta11-disposition.ts';
import { writeMeasurement } from './measurement-output.mjs';

export const PREPARED_PII_FREEZE_PATH = 'benchmarks/inputs/pii/prepared-freeze.json';
export const PREPARED_PII_FREEZE_ROLE = 'prepared-pii-freeze-candidate';
const schema = JSON.parse(readFileSync(new URL('../../schemas/prepared-pii-freeze-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A candidate freezes mechanics only; publication still requires independent source-bound registration. */
export function validatePreparedPiiFreeze(value, expected) {
  if (!validate(value)) throw new Error('Prepared freeze schema rejected: ' + JSON.stringify(validate.errors));
  if (value.freezeCommitment !== b11Commitment({ ...value, freezeCommitment: undefined }) ||
      !same(value.activation, B11_EXPECTED_ACTIVATION) || !same(value.protectedEpochs, b11ProtectedEpochs(value)))
    throw new Error('Prepared freeze commitment, activation or unspent protected epoch differs');
  if (expected) {
    if (value.candidate.sourceCommit !== expected.commit || value.role !== expected.role ||
        b11PlanSetOf(value) !== expected.planSet || value.benchmark.baseRevision !== expected.baseRevision)
      throw new Error('Prepared freeze identity differs from requested candidate');
    for (const [rows, paths] of [[value.frozenInputs, expected.inputs], [value.evaluationSchema, expected.schemaPaths]])
      if (!same(rows.map(row => row.path).sort(), [...paths].sort())) throw new Error('Prepared freeze must bind the complete current scope');
  }
  return value;
}

export function publishPreparedPiiFreeze(root, value, expected) {
  validatePreparedPiiFreeze(value, expected);
  const target = path.join(root, PREPARED_PII_FREEZE_PATH);
  writeMeasurement(target, JSON.stringify(value, null, 2) + '\n');
  return target;
}

export function requireReviewedPreparedPiiFreeze(root, bytes, registration) {
  const row = registration.canonicalInputs?.find(row => row.path === PREPARED_PII_FREEZE_PATH);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (!row || row.role !== PREPARED_PII_FREEZE_ROLE || row.reviewIssue !== 879 || row.bytes !== bytes.length || row.sha256 !== digest)
    throw new Error('Prepared freeze has no independent reviewed registration; candidate preparation does not authorise measurement');
}
