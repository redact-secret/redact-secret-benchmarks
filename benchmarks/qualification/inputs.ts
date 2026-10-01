import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { contracts, scoredContractIds } from '../evaluation/domains/credential/assessment.ts';
import { statusCriteria, validateStatusCriteria } from '../support/status.ts';
import { fixtureProfiles, validateFixtureProfiles } from '../support/profiles.ts';
import { empiricalEvidence } from '../support/empirical.ts';
import { policyCredentialProfile } from '../support/policy-qualified.ts';
import { taxonomy } from '../support/taxonomy.ts';
import { ADAPTER, type CombinationPolicy, type ContractFacts, type KnownGapRecord, type PolicyRevision, type PopulationRegistryEntry, type ProductInputs } from './adapter.ts';
import { canonical, sha256Hex } from './canonical.ts';

/**
 * Product-owned inputs of the adapter, read from this repository (#605). Each is data or a table another gate already
 * owns; nothing is re-derived here, and nothing here reads a RunArtifact.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const readJson = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));

export const POLICY_FILES = [
  'benchmarks/support/status-criteria.json',
  'benchmarks/support/fixture-profiles.json',
  'benchmarks/support/policy-qualified-credentials.json',
  'benchmarks/support/empirical-observations.json',
  'benchmarks/support/taxonomy.json',
  'benchmarks/support/population-policy.json',
  'benchmarks/review-ledger.json',
] as const;
export const CONTRACTS_COMPONENT = 'benchmarks/evaluation/domains/credential/assessment.ts#contracts';

/** The facts of a contract that a status can depend on. Functions (validators) are excluded; the pattern text that names them is kept. */
export function contractFacts(table: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(table).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([id, contract]) => [id,
    Object.fromEntries(Object.entries(contract).filter(([, value]) => typeof value !== 'function'))]));
}

/**
 * The product policy revision (#605; left open by #603): the stamp of the benchmark-owned inputs a view was
 * qualified with. It is the SHA-256 of the canonical JSON of the adapter identity and one digest per component, where
 * a JSON component's digest is the canonical-JSON digest of its parsed content (whitespace and key order do not move
 * it). Changing a threshold, a route, a contract tier, an empirical record, the taxonomy, a ledger decision or the
 * population policy changes the revision; a re-measurement of unchanged inputs does not.
 */
export function policyRevision(components: { path: string; digest: string }[]): PolicyRevision {
  const sortedComponents = [...components].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return { revision: `rs-policy-${ADAPTER.version}:sha256:${sha256Hex(canonical({ adapter: ADAPTER, components: sortedComponents }))}`, components: sortedComponents };
}

export async function loadPolicyRevision(): Promise<PolicyRevision> {
  const components: { path: string; digest: string }[] = await Promise.all(POLICY_FILES.map(async file => ({ path: file, digest: `sha256:${sha256Hex(canonical(await readJson(file)))}` })));
  components.push({ path: CONTRACTS_COMPONENT, digest: `sha256:${sha256Hex(canonical(contractFacts(contracts as unknown as Record<string, Record<string, unknown>>)))}` });
  return policyRevision(components);
}

export async function loadRegistry() {
  const registry = await readJson('benchmarks/official-runs.json');
  const populations: PopulationRegistryEntry[] = registry.populations;
  return { registry, populations, engine: { version: registry.engine.version as string, protocol: registry.engine.protocol as string } };
}

export async function loadProductInputs(): Promise<ProductInputs> {
  const [policy, ledger, gaps] = await Promise.all([readJson('benchmarks/support/population-policy.json'), readJson('benchmarks/review-ledger.json'), readJson('benchmarks/known-gaps.json')]);
  const knownGaps: KnownGapRecord[] = gaps.issues.map((issue: { id: string; number?: number; status: string; kind?: string; fixtures?: string[] }) =>
    ({ id: issue.id, number: issue.number, status: issue.status, kind: issue.kind, fixtures: issue.fixtures ?? [] }));
  return {
    families: [...scoredContractIds],
    contracts: contracts as unknown as Record<string, ContractFacts>,
    taxonomy,
    empirical: family => empiricalEvidence(family) as ReturnType<ProductInputs['empirical']>,
    criteria: validateStatusCriteria(statusCriteria),
    profiles: validateFixtureProfiles(fixtureProfiles),
    policyCriteria: policyCredentialProfile.criteria as ProductInputs['policyCriteria'],
    policyContracts: policyCredentialProfile.families as unknown as ProductInputs['policyContracts'],
    ledger, knownGaps, policy: policy as CombinationPolicy,
    policyRevision: await loadPolicyRevision(),
  };
}
