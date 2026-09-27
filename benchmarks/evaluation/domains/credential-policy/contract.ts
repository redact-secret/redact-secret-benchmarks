import { credentialPolicyIdentity } from './identity.ts';
import { credentialPolicyHoldoutDomain } from './holdout.ts';
import { credentialPolicyHoldoutStorage } from './holdout-corpus.ts';

export const credentialPolicyDomain = Object.freeze({ ...credentialPolicyIdentity,
  holdout: Object.freeze(credentialPolicyHoldoutDomain), holdoutStorage: Object.freeze(credentialPolicyHoldoutStorage) });

