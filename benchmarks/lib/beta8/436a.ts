import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, B436, product, at, src, reason } from './436-sources.ts';

// Issue #436, slice a: Beta.11 contract for Convex deployment and admin keys with a hex body (#860
// Tier B, READY for the hex body only; handoff docs/audits/evidence/860/convex.md; product
// redact-secret#912). Owned by this slice only; see docs/specs/beta8-evidence.md.
//
// T1 under ruling R1: the `{name}|{encrypted}` join, the version byte 01 and lowercase hex come from
// the provider's own Apache-2.0 backend (the self-hosted issuer); the 74–96 even hex length is derived
// from that generator's proto sizes. The typed leads come from the provider CLI regexes and docs. The
// current cloud deploy-key body (`eyJ2…`) is ISSUANCE-GATED (ruling R4 fixes its prefix only), so no
// fixture asserts it either way. The secret span is the whole key: the provider's `format_admin_key`
// builds `{name}|{encrypted}` as one credential string that the CLI consumes whole.
export const issue = '436a';

const BACKEND = 'https://github.com/get-convex/convex-backend/tree/032e81e264a8b23b8d566d8f83f773d2bfbedb88';
const blob = (path: string) => `https://github.com/get-convex/convex-backend/blob/032e81e264a8b23b8d566d8f83f773d2bfbedb88/${path}`;
const ADMIN_KEY_RS = blob('crates/common/src/types/admin_key.rs');
const BROKER_RS = blob('crates/keybroker/src/broker.rs');
const ENCRYPTOR_RS = blob('crates/keybroker/src/encryptor.rs');
const CLI_DEPLOYMENT = blob('npm-packages/convex/src/cli/lib/deployment.ts');
const CLI_NAME = blob('npm-packages/convex/src/cli/lib/extractDeploymentNameForWorkOS.ts');
const READ_CREDENTIALS = blob('self-hosted/docker-build/read_credentials.sh');
const DOCS_KEY_TYPES = 'https://docs.convex.dev/cli/deploy-key-types';
const HANDOFF = handoff('convex.md');

/** Typed leads (CLI regexes + backend `remove_type_prefix`), the untyped bounded name, one `|`, then `01` + an even 74–96 lowercase hex body. */
const NAME = '[a-z0-9][a-z0-9-]{0,62}';
export const CONVEX_PATTERN = `^(?:(?:prod|dev):[a-z]+-[a-z]+-[0-9]+|(?:preview|project):${NAME}:${NAME}|${NAME})\\|01(?:[0-9a-f]{2}){36,47}$`;

/** Families measured here that no registry detector targets at the pinned product revision. */
export const arrivalFamilies: ArrivalFamily[] = [
  { id: 'convex-deployment-key', taxonomy: 'convex:deployment-key', issue, reason: reason('convex-deployment-key', 'convex_deployment_key', 912, 'Only the hex-body keys are in scope; the cloud eyJ2 body is issuance-gated.') },
];

/** Contracts for `arrivalFamilies` ids only. */
export const contracts: Record<string, FormatContract> = {
  'convex-deployment-key': {
    tier: 'T1',
    pattern: CONVEX_PATTERN,
    providerSource: provider(ADMIN_KEY_RS, 'convex-backend 032e81e: format_admin_key / split_admin_key / remove_type_prefix, ADMIN_KEY_VERSION = 1, encrypt_proto + const_hex::encode (re-checked 2026-09-28)', 'provider code (ruling R1): an optional prod:/dev: + cloud name or preview:/project: + two slugs lead, the deployment or instance name, exactly one |, then 01 + lowercase hex whose even length 74–96 is derived from the generator (29-byte envelope plus a 8–19-byte AdminKey proto); the docs show the typed leads and the | join', at),
    corroboration: [],
    references: [BACKEND, ADMIN_KEY_RS, BROKER_RS, ENCRYPTOR_RS, CLI_DEPLOYMENT, CLI_NAME, READ_CREDENTIALS, DOCS_KEY_TYPES, HANDOFF, RERANK, R860, RULINGS_R1_R3, RULINGS_R2_R8, product(912), B436],
    review: 'Arrival evidence (#436, product redact-secret#912; #860 handoff convex.md, READY for the hex body). T1 under ruling R1: the provider backend joins {deployment_name}|{encrypted_part}, writes version byte 01, a 12-byte nonce, the AES-GCM-SIV ciphertext and a 16-byte tag, and hex-encodes it in lower case; the 74–96 even length is derived from the proto fields the broker always sets. The CLI accepts prod:/dev: + a cloud name and preview:/project: + two slugs; the slug grammar is project policy (bounded, no source). The secret span is the whole key, name included, because it is the one string the CLI consumes. Excluded: CONVEX_DEPLOYMENT=dev:<name> selectors (no |), convex.cloud URLs, pre-0.16.0 bare keys, team and OAuth tokens, docs placeholders whose body fails the grammar. The current cloud deploy-key body (eyJ2…) is issuance-gated: ruling R4 fixes only its prefix, so no fixture asserts it either way. Neither pinned peer has a Convex rule.',
    fields: [
      field({ field: 'join', claim: '{name}|{encrypted}: the name, exactly one |, then the encrypted body; the whole string is the credential', basis: 'provider-code', status: 'frozen', sources: [src(ADMIN_KEY_RS, 'format_admin_key, split_admin_key on the first |'), src(RULINGS_R1_R3, 'R1')] }),
      field({ field: 'typed-lead', claim: 'optional prod: or dev: + a cloud name [a-z]+-[a-z]+-[0-9]+, or preview: / project: + <team-slug>:<project-slug>', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEY_TYPES, 'every typed key shown as <type>:<name-or-slugs>|…, truncated'), src(CLI_DEPLOYMENT, 'isDeploymentKey /^(dev|prod):.*\\|/, isProjectKey /^project:.*\\|/'), src(CLI_NAME, 'cloud name /^[a-z]+-[a-z]+-\\d+$/')] }),
      field({ field: 'untyped-name', claim: 'an untyped (admin) key leads with the instance or deployment name, bounded to [a-z0-9][a-z0-9-]{0,62}', basis: 'provider-code', status: 'provisional', sources: [src(READ_CREDENTIALS, 'default instance name convex-self-hosted'), src(HANDOFF, 'the class and bound are project policy')], note: 'The default name is provider code; the character class and 63-byte bound are the handoff\'s project policy. A name outside it is an accepted false negative, so no fixture asserts silence on one.' }),
      field({ field: 'slugs', claim: 'preview:/project: team and project slugs bounded to [a-z0-9][a-z0-9-]{0,62} each', basis: 'research-hypothesis', status: 'provisional', sources: [src(HANDOFF, 'no source states the slug grammar')] }),
      field({ field: 'body-version', claim: 'the hex body starts 01 (ADMIN_KEY_VERSION = 1)', basis: 'provider-code', status: 'frozen', sources: [src(BROKER_RS, 'ADMIN_KEY_VERSION: u8 = 1'), src(ENCRYPTOR_RS, 'version byte first')] }),
      field({ field: 'body-alphabet', claim: 'lowercase hex [0-9a-f]', basis: 'provider-code', status: 'frozen', sources: [src(ENCRYPTOR_RS, 'const_hex::encode')] }),
      field({ field: 'body-length', claim: 'even, 74 to 96 hex characters (37–48 bytes: a 29-byte envelope plus an 8–19-byte proto)', basis: 'provider-code', status: 'frozen', sources: [src(ENCRYPTOR_RS, 'version + 12-byte nonce + ciphertext + 16-byte tag'), src(BROKER_RS, 'issue_key sets issued_s and an identity; instance_name is None'), src(HANDOFF, 'derived facts, not stated ones')], note: 'Derived from the generator, not stated. Positives carry 74, 76 and 96; the twins carry 72, 98 and an odd length.' }),
      field({ field: 'cloud-body', claim: 'the current cloud deploy-key body begins eyJ2; its alphabet, padding and length are unknown', basis: 'provider-example', status: 'unresolved', sources: [src(DOCS_KEY_TYPES, 'truncated eyJ2...0= examples'), src(RULINGS_R2_R8, 'R4: a truncated example fixes the prefix only')], note: 'Issuance-gated. No fixture asserts a finding or silence on an eyJ2 body.' }),
      field({ field: 'non-secrets', claim: 'CONVEX_DEPLOYMENT=<type>:<name> selectors, https://<name>.convex.cloud / .convex.site URLs and bare deployment names are public', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEY_TYPES), src(HANDOFF, 'excluded shapes')] }),
      field({ field: 'transport', claim: 'CONVEX_DEPLOY_KEY and CONVEX_SELF_HOSTED_ADMIN_KEY environment variables; sent as Authorization: Convex <key>', basis: 'provider-documentation', status: 'frozen', sources: [src(DOCS_KEY_TYPES), src(HANDOFF, 'role and blast radius')] }),
      field({ field: 'peer-lag', claim: 'no rule in trufflehog 3.97.4 or gitleaks 8.30.1', basis: 'tool', status: 'frozen', sources: [src('https://github.com/trufflesecurity/trufflehog/tree/v3.97.4/pkg/detectors', 'no convex detector directory'), src('https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml', 'no convex rule')] }),
    ],
  },
};

/** The Beta.8 profile each target this slice owns is authored toward. */
export const profiles: Record<string, FixtureProfile> = { 'convex-deployment-key': 'documented-24' };
