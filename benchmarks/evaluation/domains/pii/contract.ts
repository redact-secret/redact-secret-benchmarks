import { loadPiiDomainCases } from './cases.ts';
import { validatePiiCase, validatePiiContract } from './contract-model.ts';
import { executePiiEvaluation, normalizePiiFinding } from './execution.ts';
import { piiHoldoutDomain } from './holdout.ts';
import { piiHoldoutStorage } from './holdout-corpus.ts';
import { piiIdentity } from './identity.ts';
import { createPiiMethods } from './methods/index.ts';
import { createPiiOperators } from './operators.ts';
import { createPiiValidators } from './validators.ts';
import * as accounting from './accounting.ts';
import * as qualification from './qualification.ts';
import * as assessment from './assessment.ts';
import * as support from './support.ts';
import * as validatorQualification from './validator-qualification.ts';
import * as contextEvidence from './context-evidence.ts';
import * as benignCollisionEvidence from './benign-collision-evidence.ts';
import type { Registry } from '../../substrate/registry.ts';
import type { PiiOperator, PiiValidator } from './types.ts';
import {
  piiBenignCollisionEvidence, validatePiiBenignCollisionEvidence,
  type PiiBenignCollisionValidationOptions,
} from './benign-collision-evidence.ts';

export interface PiiDomainConfiguration {
  evidence?: unknown;
  evidenceValidation?: PiiBenignCollisionValidationOptions;
  validators?: Registry<PiiValidator>;
  operators?: Registry<PiiOperator>;
}

/** Bind cases and methods to one validated evidence corpus so data-only additions are executable. */
export function configurePiiDomain(options: PiiDomainConfiguration = {}) {
  const evidenceValidation = options.evidenceValidation ?? {};
  const evidence = validatePiiBenignCollisionEvidence(options.evidence ?? piiBenignCollisionEvidence, evidenceValidation);
  return Object.freeze({ ...piiIdentity,
    createMethods: (validators: Registry<PiiValidator> = options.validators ?? createPiiValidators(),
      operators: Registry<PiiOperator> = options.operators ?? createPiiOperators()) => createPiiMethods(validators, operators, evidence),
    createOperators: createPiiOperators,
    createValidators: createPiiValidators,
    loadCases: () => loadPiiDomainCases(evidence, evidenceValidation),
    configure: configurePiiDomain,
    accounting,
    qualification,
    assessment,
    support,
    validatorQualification,
    contextEvidence,
    benignCollisionEvidence,
    validateCase: validatePiiCase, validateContract: validatePiiContract, execute: executePiiEvaluation,
    normalizeFinding: normalizePiiFinding, holdout: Object.freeze(piiHoldoutDomain), holdoutStorage: Object.freeze(piiHoldoutStorage) });
}

export const piiDomain = configurePiiDomain();

export type PiiDomain = typeof piiDomain;
