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
import { AXIS_OVERLAY_FILE, axisOverlayProblems, type AxisOverlay } from './axis-overlay.ts';
import { TWIN_SCOPE_FILE, twinScopeMapProblems, type TwinScopeMap } from './twin-scope.ts';
import { LEDGER_REKEY_FILE, ledgerRekeyProblems, type LedgerRekey } from './ledger-rekey.ts';
import { readDerivedInputs } from './derived-inputs.ts';

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
  'benchmarks/support/public-axis-overlay.json',
  'benchmarks/support/public-twin-scope-map.json',
  'benchmarks/review-ledger.json',
  'benchmarks/support/public-review-ledger-map.json',
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

/** Parsed contents that stand in for a committed policy file (the snapshot-derived inputs of a candidate view, #699). */
export type PolicyOverrides = Partial<Record<(typeof POLICY_FILES)[number], unknown>>;

export async function loadPolicyRevision(overrides: PolicyOverrides = {}): Promise<PolicyRevision> {
  const components: { path: string; digest: string }[] = await Promise.all(POLICY_FILES.map(async file => ({ path: file, digest: `sha256:${sha256Hex(canonical(file in overrides ? overrides[file] : await readJson(file)))}` })));
  components.push({ path: CONTRACTS_COMPONENT, digest: `sha256:${sha256Hex(canonical(contractFacts(contracts as unknown as Record<string, Record<string, unknown>>)))}` });
  return policyRevision(components);
}

export async function loadRegistry() {
  const registry = await readJson('benchmarks/official-runs.json');
  const populations: PopulationRegistryEntry[] = registry.populations;
  return { registry, populations, engine: { version: registry.engine.version as string, protocol: registry.engine.protocol as string } };
}

/**
 * `derivedInputsDir` (#699): the axis overlay, the twin-scope map and the review-ledger re-key of a candidate snapshot, derived into a directory by
 * `npm run qualification:derive-inputs`. When given they replace the committed copies completely (none of the committed three is read, so an
 * accepted population's overlay can never leak into a candidate view) and the policy revision is computed over them. The directory must hold a valid
 * receipt and all three files; the adapter still refuses any of them that is bound to another corpus than the artifact.
 */
export async function loadProductInputs({ derivedInputsDir }: { derivedInputsDir?: string } = {}): Promise<ProductInputs> {
  const ledgerForDerived = derivedInputsDir ? await readJson('benchmarks/review-ledger.json') : undefined;
  const derived = derivedInputsDir ? await readDerivedInputs(derivedInputsDir, { ledger: ledgerForDerived }) : undefined;
  const [policy, ledger, gaps, axisOverlay, ledgerRekey, twinScope] = await Promise.all([readJson('benchmarks/support/population-policy.json'), readJson('benchmarks/review-ledger.json'), readJson('benchmarks/known-gaps.json'),
    derived ? derived.axisOverlay : readJson(AXIS_OVERLAY_FILE), derived ? derived.ledgerRekey : readJson(LEDGER_REKEY_FILE), derived ? derived.twinScope : readJson(TWIN_SCOPE_FILE)]);
  const twinScopeProblems = twinScopeMapProblems(twinScope);
  if (twinScopeProblems.length) throw new Error(`${TWIN_SCOPE_FILE} is invalid: ${twinScopeProblems.join('; ')}`);
  const overlayProblems = axisOverlayProblems(axisOverlay);
  if (overlayProblems.length) throw new Error(`${AXIS_OVERLAY_FILE} is invalid: ${overlayProblems.join('; ')}`);
  const rekeyProblems = ledgerRekeyProblems(ledgerRekey, ledger);
  if (rekeyProblems.length) throw new Error(`${LEDGER_REKEY_FILE} is invalid: ${rekeyProblems.join('; ')}`);
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
    ledger, ledgerRekey: ledgerRekey as LedgerRekey, knownGaps, policy: policy as CombinationPolicy, axisOverlay: axisOverlay as AxisOverlay, twinScope: twinScope as TwinScopeMap,
    policyRevision: await loadPolicyRevision(derived ? { [AXIS_OVERLAY_FILE]: axisOverlay, [TWIN_SCOPE_FILE]: twinScope, [LEDGER_REKEY_FILE]: ledgerRekey } : {}),
  };
}
