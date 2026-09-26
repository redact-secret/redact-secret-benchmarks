import type { Finding } from '../../../types.ts';
import type { Scanner } from '../../../engine/types.ts';
import { createMethods } from './methods/index.ts';
import { createHoldoutMethods } from './methods/holdout.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './cases.ts';
import { validateAssessment, validateContracts, classifyFixture, controlAxis, contracts, scoredContractIds } from './assessment.ts';
import { publicEvaluation } from '../../../engine/public-report.ts';
import { credentialIdentity } from './identity.ts';
import { familyEvidence, classifyFamilySupport, statusCriteria, buildSupportMatrix } from './qualification.ts';
import { reviewEntryId } from './review.ts';

const normalizeFinding = ({ path, start, end, family, action }: Finding, scanner: Pick<Scanner, 'capabilities'>): Finding => ({
  path, start, end,
  ...(scanner.capabilities?.classification !== false && family && Object.hasOwn(contracts, family) ? { family } : {}),
  ...(action !== undefined ? { action } : {}),
});

/**
 * The one internal composition root for current evaluator semantics.
 * It is deliberately a closed repository contract, not a third-party plugin API.
 */
export const credentialDomain = Object.freeze({
  ...credentialIdentity,
  createMethods,
  createHoldoutMethods,
  createOperators,
  loadCases,
  assessment: Object.freeze({ validateAssessment, validateContracts, classifyFixture, controlAxis, contracts, scoredContractIds }),
  normalizeFinding,
  qualification: Object.freeze({ familyEvidence, classifyFamilySupport, statusCriteria, buildSupportMatrix }),
  review: Object.freeze({ reviewEntryId }),
  reporting: Object.freeze({ publicEvaluation }),
});

export type CredentialDomain = typeof credentialDomain;
