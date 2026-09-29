import Ajv from 'ajv';
import profileSchema from '../../../../schemas/pii-qualification-profile-v1.json';
import profileData from '../../../../qualification/pii-v1.json';
import { validateMechanicalAccounting, type MechanicalAccountingConfig } from '../../../accounting/shared/primitives.ts';

export const PII_METRIC_IDS = ['type-miss-rate', 'wrong-family-rate', 'wrong-jurisdiction-rate', 'sensitive-miss-rate', 'non-sensitive-flag-rate',
  'context-discrimination-rate', 'benign-suppression-rate', 'jurisdiction-collision-rate', 'range-collateral-rate', 'measurable-share'] as const;
export type PiiMetricId = (typeof PII_METRIC_IDS)[number];
/** Each metric's [population, numerator, denominator], verbatim; the accounting report and the UI read the same strings. */
export const PII_METRIC_LABELS: Readonly<Record<PiiMetricId, readonly [population: string, numerator: string, denominator: string]>> = Object.freeze({
  'type-miss-rate': ['scanner-source × authored valid-type occurrence', 'type state is miss', 'resolved type assertions for authored valid types'],
  'wrong-family-rate': ['scanner-source × authored valid-type occurrence', 'type state is wrong-family', 'resolved type assertions for authored valid types'],
  'wrong-jurisdiction-rate': ['scanner-source × authored jurisdictional valid-type occurrence', 'type state is wrong-jurisdiction', 'resolved jurisdictional type assertions'],
  'sensitive-miss-rate': ['scanner-source × authored sensitive occurrence', 'sensitivity state is miss', 'resolved sensitivity assertions for authored sensitive occurrences'],
  'non-sensitive-flag-rate': ['scanner-source × authored non-sensitive occurrence', 'sensitivity state is false-positive', 'resolved sensitivity assertions for authored non-sensitive occurrences'],
  'context-discrimination-rate': ['complete scanner-source × authored context trios', 'both sensitive and non-sensitive endpoints pass', 'resolved complete context trios'],
  'benign-suppression-rate': ['scanner-source × distinct authored benign case', 'non-sensitive assertion passes', 'resolved authored benign cases'],
  'jurisdiction-collision-rate': ['scanner-source × authored jurisdiction collision case', 'target family and jurisdiction assertion passes', 'resolved collision type assertions'],
  'range-collateral-rate': ['scanner-source × reported span for authored valid type', 'range is overbroad or partial', 'exact, overbroad, or partial reported spans'],
  'measurable-share': ['all scanner-source × authored axis assertions', 'resolved pass or fail assertions', 'all eligible authored axes including unresolved axes'],
});
export interface PiiQualificationProfile {
  schemaVersion: 1; id: 'pii-v1'; version: 1; domain: 'pii'; evaluationProfile: 'pii-v1'; domainAccountingVersion: 'pii-v1';
  mechanics: MechanicalAccountingConfig;
  metrics: Record<PiiMetricId, { direction: 'upper' | 'lower'; threshold: number; applicability: 'required' | 'jurisdictional' | 'reported-spans' }>;
  gates: { requiredMethods: ['type-validation', 'context-discrimination', 'pii-benign']; minBenignCases: number; minBenignAxes: number;
    requireProtectedEvidence: true; requireIndependentEvidence: true; requireTrustedAccountingSource: true };
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
