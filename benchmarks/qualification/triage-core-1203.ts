/**
 * The product's classification of the base cases behind the 82 root causes that core #1199 to #1201 did not classify (#698): redact-secret#1203, settled by
 * core PR #1204 (merge 1e45cecf674344726e59bd35a37f28ba1966a06e) and `decision-settle-the-open-structured-file-url-carrier-and-control-roots-of-1203`.
 *
 * This repository records the product's reading and never asserts it (the boundary rule): each entry is what the core maintainers decided, cited. An
 * `evidenceProposal` is a proposed change to credential-evidence, kept apart from the disposition and never applied here: the snapshot is not edited.
 */
import type { Classification } from './triage-decisions.ts';

const CORE = 'https://github.com/redact-secret/redact-secret';
export const CORE_1203_LINKS = [`${CORE}/issues/1203`, `${CORE}/pull/1204`];
export const CORE_1203_ADR = 'redact-secret docs/decisions/2026-10-04-settle-the-open-structured-file-url-carrier-and-control-roots-of-1203.md (core PR #1204)';
const ADR_DECODING = 'redact-secret ADR defer-encoded-input-decoding (#491)';
const ADR_FRAGMENT = 'redact-secret docs/decisions/2026-10-04-define-fragmented-credentials-as-outside-the-raw-input-contract.md (core PR #1202)';

export interface Core1203Entry {
  classification: Classification;
  /** `fix`: an in-contract false positive fixed in core main (unreleased); the candidate replay verifies it. */
  kind: 'fix' | 'unsupported-family' | 'fragment' | 'encoded' | 'expectation';
  disposition: string;
  evidence: string[];
  /** A proposed credential-evidence change (case id and expectation). Never applied here. */
  evidenceProposal?: string;
}

const unsupported = (what: string): Core1203Entry => ({ classification: 'unsupported-or-feature-scope', kind: 'unsupported-family', disposition: `the product declares no ${what} family: the value is claimed only when a supported detector reads it independently, and that claim is incidental. A scope fact (core #1203, ADR), deferred with a reopening bar, not rejected`, evidence: [CORE_1203_ADR, 'core #1203 comment: every variant and assertion of the base case replays identically on published beta.13 and main'] });
const expectation = (disposition: string, evidenceProposal: string): Core1203Entry => ({ classification: 'expectation-or-contract-correction', kind: 'expectation', disposition, evidenceProposal, evidence: [CORE_1203_ADR, 'core #1203 comment: product findings, ranges and actions reproduced on published beta.13 and main'] });
const fix = (disposition: string): Core1203Entry => ({ classification: 'in-contract-product-bug', kind: 'fix', disposition, evidence: [CORE_1203_ADR, 'core PR #1204: synthetic benign/positive regression pairs pin the case id; the fix fails its test on the previous source'] });

export const CORE_1203: Record<string, Core1203Entry> = {
  'authored-provider-neutral--terraform-apply-sensitive': fix('in-contract false positive, fixed in core PR #1204 (unreleased): Terraform\'s exact `(sensitive value)` marker is a non-secret reference'),
  'exa--exa-api-key-your-key-here-placeholder': fix('in-contract false positive, fixed in core PR #1204 (unreleased): `exa` joins the closed placeholder provider list, like `fal` and `convex` (#919)'),
  'structured-credential-files-authored--documented-template-placeholders': fix('in-contract false positive, fixed in core PR #1204 (unreleased): a PEM frame whose whole body is a placeholder name (`PRIVATE_KEY`) is a template'),
  'structured-credential-files-authored--netrc-single-line-entry': unsupported('netrc'),
  'structured-credential-files-authored--netrc-three-line-entry': unsupported('netrc'),
  'structured-credential-files-authored--netrc-quoted-password-with-spaces': unsupported('netrc'),
  'structured-credential-files-authored--netrc-two-machines-and-default': unsupported('netrc'),
  'structured-credential-files-authored--kubeconfig-inline-bearer-token': unsupported('kubeconfig user token (the bare `token` name stays unmatched)'),
  'structured-credential-files-authored--kubeconfig-four-users-two-inline-secrets': unsupported('kubeconfig user token (the bare `token` name stays unmatched; the `password:` half is claimed exactly)'),
  'structured-credential-files-authored--kubeconfig-client-key-data-encoded-pem': { classification: 'unsupported-or-feature-scope', kind: 'encoded', disposition: 'out of scope: a base64 PEM is an encoded carrier the product does not decode', evidence: [ADR_DECODING, CORE_1203_ADR] },
  'http-auth-carriers-authored--cookie-header-session-id-among-preferences': unsupported('HTTP session-cookie'),
  'http-auth-carriers-authored--set-cookie-session-id-with-attributes': unsupported('HTTP session-cookie'),
  'url-credential-boundaries-authored--sas-token-in-config-line': unsupported('Azure SAS'),
  'url-credential-boundaries-authored--s3-presigned-url-in-prose': unsupported('S3-presigned URL (core warns only on the incidental `X-Amz-Credential` value)'),
  'url-credential-boundaries-authored--cloud-storage-signed-url-in-prose': unsupported('GCS-signed URL'),
  'http-auth-carriers-authored--basic-token-split-by-space': { classification: 'unsupported-or-feature-scope', kind: 'fragment', disposition: 'out of the raw-input contract: a credential cut by a space is a fragment; the first fragment is claimed incidentally and the rest stays', evidence: [ADR_FRAGMENT, CORE_1203_ADR] },
  'http-auth-carriers-authored--basic-empty-password': expectation('the product claims an `Authorization: Basic` value without decoding (#491), so an empty password cannot be told from a credential; the value is redacted by contract', 'http-auth-carriers-authored--basic-empty-password: expect `redact` (or review-required); an expectation that needs base64 decoding is not assertable on the raw-input contract'),
  'http-auth-carriers-authored--basic-rfc-published-example': expectation('the product claims an `Authorization: Basic` value without decoding (#491), so a published RFC 7617 example cannot be told from a credential; the value is redacted by contract', 'http-auth-carriers-authored--basic-rfc-published-example: expect `redact` (or review-required); not assertable without decoding'),
  'twilio-compound-credentials-authored--api-key-sid-alone': expectation('the documented identifier excluded under every contextual name is `SK` + 32 lowercase hex (#746); the evidence value is not that shape, so the generic assignment claims it', 'twilio-compound-credentials-authored--api-key-sid-alone: re-author the value as `SK` + 32 lowercase hex (the product returns clean) or expect a redact'),
  'authored-provider-neutral--pytest-fake-fixtures': expectation('a low-entropy literal under a credential name is `medium`, action `warn`, text unchanged, by the assignment contract; the control expects no finding at all', 'authored-provider-neutral--pytest-fake-fixtures: allow a warn-level finding on the control (policy-ambiguous, review-required) or rename the variable'),
  'structured-credential-files-authored--service-account-key-file-minified-json': expectation('a private-key block ends at its footer, as a raw PEM does; the escaped `\\n` after `-----END PRIVATE KEY-----` is a line separator and stays in the output', 'service-account-key-file-minified-json: expected span 134-548 (ends at the footer), not 134-550'),
  'structured-credential-files-authored--service-account-key-file-pretty-json': expectation('a private-key block ends at its footer, as a raw PEM does; the escaped `\\n` after `-----END PRIVATE KEY-----` is a line separator and stays in the output', 'service-account-key-file-pretty-json: expected span 150-564 (ends at the footer), not 150-566'),
  'structured-credential-files-authored--aws-credentials-file-two-profiles': expectation('the three secret spans are exact in every variant; the `aws-access-key` family redacts the two key ids, which the expectation does not list, so every variant fails the envelope check on collateral only', 'aws-credentials-file-two-profiles: add the two `aws_access_key_id` values as expected secret spans or allowed co-detections'),
  'exa--exa-api-key-other-host-twin': expectation('the Exa-gated detector does not fire off its host; the generic `x-api-key` header assignment redacts the UUID at high confidence on every host', 'exa-api-key-other-host-twin: scope the twin to the Exa family or accept a generic finding'),
};

/** Seed cases the 24 base cases cover: the candidate replay verifies the `fix` entries. */
export const CORE_1203_FIXES = Object.entries(CORE_1203).filter(([, e]) => e.kind === 'fix').map(([id]) => id);
