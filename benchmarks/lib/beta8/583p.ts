import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import { provider, field } from '../contract-sources.ts';
import { handoff, REGISTRY_PIN, B583, product, at, src } from './583-sources.ts';

// Issue #583, slice p: the second-wave detectors that are in the product registry at the re-pin (REGISTRY_PIN, product main
// after redact-secret PR #1214 and #1227) but whose benchmark contract and corpus are not authored yet. Slices 583b to 583h authored
// the seven that were here, so `registryContracts` is empty now; a registered detector without a slice is recorded here again. Every one of them
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
};
