// Credential support semantics stay behind this facade; public domain routing belongs to #279.
export { familyEvidence } from '../../../support/evidence.ts';
export { classifyFamilySupport, statusCriteria } from '../../../support/status.ts';
export type { SupportStatus } from '../../../support/status.ts';
export { buildSupportMatrix } from '../../../support/matrix.ts';
import { validateEvidence, completenessReasons } from './evidence.ts';

export { completenessReasons };
export const validateQualificationEvidence = (report: unknown) => validateEvidence(report, 'qualification');
