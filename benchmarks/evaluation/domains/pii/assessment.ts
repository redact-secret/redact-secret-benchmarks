import Ajv from 'ajv';
import assessmentSchema from '../../../../schemas/pii-assessment-v1.json';
import { validatePiiCase, validatePiiContract } from './contract-model.ts';
import type { PiiAuthority, PiiCase, PiiContract } from './types.ts';

export interface PiiAssessment {
  schemaVersion: 1; caseId: string; category: 'pii'; family: string; displayName: string;
  identityDomain: PiiContract['identityDomain']; scope: PiiContract['scope']; qualificationProfile: { id: 'pii-v1'; version: 1 };
  typeIdentity: PiiContract['typeExpectation']; context: PiiContract['context']; sensitivity: PiiContract['sensitivityExpectation']; authority: PiiAuthority[];
}

const validateSchema = new Ajv({ strict: true }).compile(assessmentSchema);

export function validatePiiAssessment(value: unknown): PiiAssessment {
  if (!validateSchema(value)) throw new Error('Invalid PII assessment schema');
  const row = structuredClone(value as unknown as PiiAssessment);
  validatePiiContract({ category: row.category, family: row.family, displayName: row.displayName, identityDomain: row.identityDomain, scope: row.scope,
    typeExpectation: row.typeIdentity, sensitivityExpectation: row.sensitivity, context: row.context, authority: row.authority,
    referenceEvidence: null, qualificationProfile: row.qualificationProfile });
  return row;
}

/** Safe authored contract projection: input bytes, ranges, seeds and fixture paths never cross this boundary. */
export function assessPiiCase(input: PiiCase): PiiAssessment {
  const row = validatePiiCase(structuredClone(input)), contract = row.contract;
  return validatePiiAssessment({ schemaVersion: 1, caseId: row.id, category: contract.category, family: contract.family,
    displayName: contract.displayName, identityDomain: contract.identityDomain, scope: contract.scope,
    qualificationProfile: structuredClone(contract.qualificationProfile), typeIdentity: structuredClone(contract.typeExpectation),
    context: structuredClone(contract.context), sensitivity: contract.sensitivityExpectation, authority: structuredClone(contract.authority) });
}
