import type { Fixture } from '../../../types.ts';
import type { HoldoutCorpus, ManifestEvaluationIdentity } from '../../../../holdout/types.ts';
import { HoldoutError, serialize, type HoldoutStorageAdapter } from '../../../../holdout/storage.ts';
import { validateCorpus } from '../../../scoring/scoring.ts';
import { validateAssessment } from '../credential/assessment.ts';
import { credentialPolicyIdentity } from './identity.ts';

export type CredentialPolicyHoldoutCorpus = HoldoutCorpus<Fixture> & { schemaVersion: 2 };

export function validateCredentialPolicyHoldoutCorpus(value: unknown): CredentialPolicyHoldoutCorpus {
  try {
    const corpus = value as CredentialPolicyHoldoutCorpus;
    if (corpus.schemaVersion !== 2 || typeof corpus.seed !== 'string' || !corpus.seed) throw new Error();
    validateCorpus(corpus);
    const ids = new Set(corpus.fixtures.map(fixture => fixture.id));
    for (const fixture of corpus.fixtures) {
      validateAssessment(fixture);
      if (!['bearer-token', 'connection-string', 'otpauth-uri', 'generic-token'].includes(fixture.policyFamily ?? '') ||
          fixture.assessment.tier === 'T0' || (fixture.twinOf && !ids.has(fixture.twinOf))) throw new Error();
      const positive = fixture.expected.some(range => (range.role ?? 'secret') === 'secret');
      if ((positive && fixture.assessment.tier !== 'T3') || positive !== Boolean(fixture.expectedAction) || fixture.expectedAction === 'block') throw new Error();
    }
    return corpus;
  } catch { throw new HoldoutError('invalid-credential-policy-corpus'); }
}

export const credentialPolicyManifestEvaluation: ManifestEvaluationIdentity = Object.freeze({
  schemaVersion: 1,
  domain: credentialPolicyIdentity.domain,
  evaluationProfile: credentialPolicyIdentity.evaluationProfiles.evaluation,
  domainAccountingVersion: credentialPolicyIdentity.domainAccountingVersion,
});

export const credentialPolicyHoldoutStorage: HoldoutStorageAdapter<CredentialPolicyHoldoutCorpus> = Object.freeze({
  evaluation: credentialPolicyManifestEvaluation,
  validateCorpus: validateCredentialPolicyHoldoutCorpus,
  serializeCorpus: serialize,
});
