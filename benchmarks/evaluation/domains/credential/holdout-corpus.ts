import { validateCorpus } from '../../../scoring/scoring.ts';
import { validateAssessment } from './assessment.ts';
import { validateStructures } from '../../../lib/validate-structures.ts';
import type { Fixture } from '../../../types.ts';
import type { HoldoutCorpus, ManifestEvaluationIdentity } from '../../../../holdout/types.ts';
import { HoldoutError, serialize, type HoldoutStorageAdapter } from '../../../../holdout/storage.ts';
import { credentialAccountingIdentity } from './accounting.ts';

export type CredentialHoldoutCorpus = HoldoutCorpus<Fixture> & { schemaVersion: 2 };

export function validateCredentialHoldoutCorpus(value: unknown): CredentialHoldoutCorpus {
  try {
    const corpus = value as CredentialHoldoutCorpus;
    if (corpus.schemaVersion !== 2 || typeof corpus.seed !== 'string' || !corpus.seed) throw new Error();
    validateCorpus(corpus);
    for (const fixture of corpus.fixtures) {
      validateAssessment(fixture);
      if (fixture.twinOf || fixture.assessment.tier === 'T0') throw new Error();
    }
    validateStructures(corpus.fixtures);
    return corpus;
  } catch { throw new HoldoutError('invalid-corpus'); }
}

export const credentialManifestEvaluation: ManifestEvaluationIdentity = Object.freeze({
  schemaVersion: 1, ...credentialAccountingIdentity('evaluation-v1'),
});

export const credentialHoldoutStorage: HoldoutStorageAdapter<CredentialHoldoutCorpus> = Object.freeze({
  evaluation: credentialManifestEvaluation,
  validateCorpus: validateCredentialHoldoutCorpus,
  serializeCorpus: serialize,
});
