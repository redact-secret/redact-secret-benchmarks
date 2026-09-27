import { createRegistry } from '../../../substrate/registry.ts';
import type { PiiMethod } from '../types.ts';
import type { PiiOperator, PiiValidator } from '../types.ts';
import { schemaOnly } from './schema-only.ts';
import { typeValidation } from './type-validation.ts';
import { contextDiscrimination } from './context-discrimination.ts';
import { piiBenign } from './benign.ts';
import { jurisdictionCollision } from './jurisdiction-collision.ts';
import { piiBenignCollisionEvidence, type PiiBenignCollisionEvidence } from '../benign-collision-evidence.ts';
import { mutation } from './mutation.ts';
import { referenceDifferential } from './reference-differential.ts';
import { createPiiValidators } from '../validators.ts';
import { createPiiOperators } from '../operators.ts';
import type { Registry } from '../../../substrate/registry.ts';

export function createPiiMethods(validators: Registry<PiiValidator> = createPiiValidators(), operators: Registry<PiiOperator> = createPiiOperators(),
  evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence) {
  const registry = createRegistry<PiiMethod>('PII method', ['validateCase', 'generate', 'evaluate']);
  for (const method of [schemaOnly, typeValidation(validators, evidence), contextDiscrimination, piiBenign(validators, evidence), jurisdictionCollision(validators, evidence),
    mutation(operators), referenceDifferential(validators)]) registry.register(method);
  return registry;
}
