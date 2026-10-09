import { createHash } from 'node:crypto';
import data from '../../../inputs/pii/scorer-reference.json' with { type: 'json' };

export const piiScorerReferenceSource = {"path":"evidence/901/428/core-401158d09a67/pii-beta11-report-v2.json","revision":"65ffe7dcb3e7124e7f66cff96cab814f0365f69a","sha256":"f1413ad3f7674c9b28d4dd62e2fc8f2b739eaeec76338c373cc508dcef90e59e","role":"frozen-scorer-comparison-reference"};
const digest = '63222cbc47ed87ed4e3d0d5dbec796cdbdd6394440618ee06477803b091bd6f2';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validateScorerReference(value) {
  if (value?.schemaVersion !== 1 || value.inputType !== 'pii-scorer-reference' ||
      JSON.stringify(value.source) !== JSON.stringify(piiScorerReferenceSource) || value.dataSha256 !== digest || sha(value.data) !== digest)
    throw new Error('PII scorer reference source or projection binding mismatch');
  return structuredClone(value.data);
}
export const piiScorerReference = validateScorerReference(data);
