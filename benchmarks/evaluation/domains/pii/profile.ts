import Ajv from 'ajv';
import profileSchema from '../../../../schemas/pii-qualification-profile-v1.json';
import profileData from '../../../../qualification/pii-v1.json';
import { validateMechanicalAccounting, type MechanicalAccountingConfig } from '../../../accounting/shared/primitives.ts';

export const PII_METRIC_IDS = ['type-miss-rate', 'wrong-family-rate', 'wrong-jurisdiction-rate', 'sensitive-miss-rate', 'non-sensitive-flag-rate',
  'context-discrimination-rate', 'benign-suppression-rate', 'jurisdiction-collision-rate', 'range-collateral-rate', 'measurable-share'] as const;
export type PiiMetricId = (typeof PII_METRIC_IDS)[number];
export interface PiiQualificationProfile {
  schemaVersion: 1; id: 'pii-v1'; version: 1; domain: 'pii'; evaluationProfile: 'pii-v1'; domainAccountingVersion: 'pii-v1';
  mechanics: MechanicalAccountingConfig;
  metrics: Record<PiiMetricId, { direction: 'upper' | 'lower'; threshold: number; applicability: 'required' | 'jurisdictional' | 'reported-spans' }>;
  gates: { requiredMethods: ['type-validation', 'context-discrimination', 'pii-benign']; minBenignCases: number; minBenignAxes: number;
    requireProtectedEvidence: true; requireIndependentEvidence: true };
}

const validate = new Ajv({ strict: true }).compile(profileSchema);
const canonicalProfileText = JSON.stringify(profileData);
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
export function validatePiiQualificationProfile(value: unknown): PiiQualificationProfile {
  if (!validate(value) || JSON.stringify(value) !== canonicalProfileText) throw new Error('Invalid PII qualification profile');
  const profile = value as unknown as PiiQualificationProfile;
  validateMechanicalAccounting(profile.mechanics);
  return profile;
}

export const piiV1Profile = deepFreeze(validatePiiQualificationProfile(profileData));
