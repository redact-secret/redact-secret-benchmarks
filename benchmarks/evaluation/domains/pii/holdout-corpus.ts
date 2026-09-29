import type { HoldoutCorpus, ManifestEvaluationIdentity } from '../../../../holdout/types.ts';
import { HoldoutError, serialize, type HoldoutStorageAdapter } from '../../../../holdout/storage.ts';
import { validatePiiCase } from './contract-model.ts';
import { piiIdentity } from './identity.ts';
import type { PiiCase } from './types.ts';

export type PiiHoldoutCorpus = HoldoutCorpus<PiiCase> & { schemaVersion: 1 };

export function validatePiiHoldoutCorpus(value: unknown): PiiHoldoutCorpus {
  try {
    const corpus = value as PiiHoldoutCorpus;
    if (!corpus || corpus.schemaVersion !== 1 || typeof corpus.seed !== 'string' || !corpus.seed || !Array.isArray(corpus.fixtures) || !corpus.fixtures.length)
      throw new Error();
    const cases = corpus.fixtures.map(validatePiiCase);
    if (cases.some(c => c.visibility !== 'holdout') || new Set(cases.map(c => c.id)).size !== cases.length) throw new Error();
    return corpus;
  } catch { throw new HoldoutError('invalid-corpus'); }
}

export const piiManifestEvaluation: ManifestEvaluationIdentity = Object.freeze({ schemaVersion: 1, domain: piiIdentity.domain,
  evaluationProfile: piiIdentity.evaluationProfile, domainAccountingVersion: piiIdentity.domainAccountingVersion });

export const piiHoldoutStorage: HoldoutStorageAdapter<PiiHoldoutCorpus> = Object.freeze({
  evaluation: piiManifestEvaluation, validateCorpus: validatePiiHoldoutCorpus, serializeCorpus: serialize,
});
