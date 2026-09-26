import { createMethods } from './methods/index.ts';
import { createHoldoutMethods } from './methods/holdout.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './cases.ts';
import { validateAssessment, validateContracts, classifyFixture, controlAxis, contracts, scoredContractIds } from './assessment.ts';
import { publicEvaluation } from './public-report.ts';
import { credentialIdentity } from './identity.ts';
import { familyEvidence, classifyFamilySupport, statusCriteria, buildSupportMatrix, completenessReasons, validateQualificationEvidence } from './qualification.ts';
import { reviewEntryId } from './review.ts';
import * as accounting from './accounting.ts';
import { normalizeFinding } from './normalization.ts';
import { credentialHoldoutDomain } from './holdout.ts';
import { credentialHoldoutStorage } from './holdout-corpus.ts';

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
  accounting,
  holdout: Object.freeze(credentialHoldoutDomain),
  holdoutStorage: Object.freeze(credentialHoldoutStorage),
  normalizeFinding,
  qualification: Object.freeze({ familyEvidence, classifyFamilySupport, statusCriteria, buildSupportMatrix, completenessReasons, validateQualificationEvidence }),
  review: Object.freeze({ reviewEntryId }),
  reporting: Object.freeze({ publicEvaluation }),
});

export type CredentialDomain = typeof credentialDomain;
