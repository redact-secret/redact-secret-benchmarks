import { loadPiiCases } from './cases.ts';
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

export const piiDomain = Object.freeze({ ...piiIdentity, createMethods: createPiiMethods, createOperators: createPiiOperators,
  createValidators: createPiiValidators, loadCases: loadPiiCases,
  accounting,
  qualification,
  assessment,
  support,
  validatorQualification,
  validateCase: validatePiiCase, validateContract: validatePiiContract, execute: executePiiEvaluation,
  normalizeFinding: normalizePiiFinding, holdout: Object.freeze(piiHoldoutDomain), holdoutStorage: Object.freeze(piiHoldoutStorage) });

export type PiiDomain = typeof piiDomain;
