import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export const PII_CONVERSION_OBSERVATION_SOURCE = Object.freeze({"path":"evidence/901/428/core-401158d09a67/pii-beta11-observation-v2.json","revision":"65ffe7dcb3e7124e7f66cff96cab814f0365f69a","sha256":"74d2c16dcf68c35b615ca96848f73fcc9eb4911350c582fcf0c680ecb198903f","role":"frozen-engine-conversion-observation"});
const expectedDigest = '38a53afa473f396ad5607cdbba487c53d5fbbb0f42b321a5cd57980627a57def';
const schema = JSON.parse(readFileSync(new URL('../../../../schemas/pii-conversion-observation-v1.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Only primary-lane findings and original candidate identities are current engine-conversion inputs. */
export function validatePiiConversionObservation(value) {
  if (!validate(value) || JSON.stringify(value.source) !== JSON.stringify(PII_CONVERSION_OBSERVATION_SOURCE) ||
      value.dataSha256 !== expectedDigest || hash(value.data) !== expectedDigest)
    throw new Error('PII conversion observation source or projection binding mismatch');
  return structuredClone(value.data);
}
export function loadPiiConversionObservation(root = fileURLToPath(new URL('../../../../', import.meta.url))) {
  return validatePiiConversionObservation(JSON.parse(readFileSync(join(root, 'benchmarks/inputs/pii/conversion-observation.json'), 'utf8')));
}
