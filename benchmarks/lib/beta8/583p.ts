import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, REGISTRY_PIN, B583, product, at, src } from './583-sources.ts';

// Issue #583, slice p: the second-wave detectors that are in the product registry at the re-pin (REGISTRY_PIN, product main
// after redact-secret PR #1214 and #1227) but whose benchmark contract and corpus are not authored yet. Every one of them
// is recorded here as "detector present in the registry, benchmark contract/corpus pending (#583)" and nothing more:
//
//   - tier T3 with no pattern: the benchmark asserts no format property, so no stable claim and no T1 can come from it;
//   - `unprobeable`: no twin is authored, because there is no contract grammar to mutate until the slice lands;
//   - the registry-wide detector-coverage minimum (fixtures/generated/detector-coverage.mjs) measures each detector's own
//     behaviour as policy, which is what `tests/detector-coverage.test.mjs` requires of every registered detector.
//
// Each contract names the handoff that will source it. A slice that authors one replaces its entry here (it moves to that
// slice's `registryContracts`), so the id is never declared twice (benchmarks/lib/beta8/index.ts throws on a duplicate).
export const issue = '583p';

const PENDING = 'detector present in the registry, benchmark contract/corpus pending (#583)';
const pending = (id: string, file: string, issueNumber: number, note: string): FormatContract => ({
  tier: 'T3',
  // No bare-value grammar is asserted until the slice lands: positives score as policy (never T1, never a format claim).
  contextGated: true,
  references: [handoff(file, REGISTRY_PIN), product(issueNumber), B583],
  review: `${PENDING}. The product registers ${id} at ${REGISTRY_PIN.slice(0, 7)} (redact-secret#${issueNumber}, unreleased: no published artifact contains it). This contract asserts no format: the benchmark has not authored the handoff ${file} into a contract, a corpus or an arrival-evidence set, so nothing here is a support claim and the family reads no higher than the registry-wide coverage minimum allows. ${note}`,
  candidateSource: provider(handoff(file, REGISTRY_PIN), `#1014 handoff ${file} on product main at ${REGISTRY_PIN.slice(0, 7)}; the contract is not authored yet`, 'no benchmark grammar yet: the handoff is the source a later slice authors from', at),
  unprobeable: { reason: `${PENDING}: there is no benchmark grammar to mutate until the slice authors it, so no twin is asserted`, observedAt: '2026-10-05' },
  fields: [
    field({ field: 'status', claim: PENDING, basis: 'research-hypothesis', status: 'unresolved', sources: [src(handoff(file, REGISTRY_PIN)), src(`https://github.com/redact-secret/redact-secret/issues/${issueNumber}`)], note }),
  ],
});

export const arrivalFamilies: ArrivalFamily[] = [];
export const contracts: Record<string, FormatContract> = {};
export const profiles: Record<string, FixtureProfile> = {};

/** The detector-id contracts for the registry detectors whose slice is pending. */
export const registryContracts: Record<string, FormatContract> = {
  'xata-api-key': pending('xata-api-key', 'xata.md', 1102, 'Handoff: xau_/xao_ + a bit-packed base62 body with a CRC32 (not standard base62); finding types xata_user_api_key and xata_organization_api_key.'),
  'sourcegraph-token': pending('sourcegraph-token', 'sourcegraph.md', 1103, 'Handoff: the sgp_ personal access token; finding type sourcegraph_access_token.'),
  'unkey-root-key': pending('unkey-root-key', 'unkey.md', 1104, 'Handoff: version 1 root keys (unkey_ + 8 + unkeyv1 + 42, a CRC-32C checksum) and the dashboard 3Z form; finding type unkey_root_key.'),
  'buildkite-token': pending('buildkite-token', 'buildkite.md', 1105, 'Handoff: per-role prefixes (bkua_, bkaa_, bkaj_, bkar_, bkct_, bkpt_, bkpat_, bkps_, bkjat_) and a JWT-body case the existing peer rule does not know; seven finding types.'),
  'pydantic-logfire-token': pending('pydantic-logfire-token', 'pydantic-logfire.md', 1106, 'Handoff: pylf_v<n>_<region>_ + an optional organization UUID + a body whose floor is a policy (ruling Q7); finding type pydantic_logfire_token.'),
  'mapbox-token': pending('mapbox-token', 'mapbox.md', 1108, 'Handoff: the sk. secret token (three dot-separated base64url parts), conditional on ruling Q7, with a no-double-report case against jwt; finding type mapbox_secret_access_token.'),
  'fly-token': pending('fly-token', 'fly.md', 1109, 'Handoff: fm1r_/fm1a_/fm2_ macaroon members and the comma-joined bundle span, conditional on ruling Q7; finding type fly_access_token.'),
};
