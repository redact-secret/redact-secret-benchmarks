import { basisForRoute, classifyFamilySupport, empiricalRoute, type EvidenceBasis, type FamilySupportEvidence, type QualificationProfile, type StatusCriteria, type SupportStatus } from '../support/status.ts';
import { fixtureProfileReport, profileClaim, type FixtureCells, type FixtureProfiles, type ProfileId } from '../support/profiles.ts';
import type { PolicyAction, PolicyBehaviorAggregate, PolicyGateCode, PolicyGateFailure, PolicyHoldoutReceipt } from '../support/policy-qualified.ts';
import type { Tier } from '../types.ts';
import type { Taxonomy } from '../support/taxonomy.ts';
import type { ReviewLedger } from '../engine/review-ledger.ts';
import { canonical } from './canonical.ts';
import { contextGroup, type AxisOverlay } from './axis-overlay.ts';
import {
  bindingProblems, byId, countCase, emptyCounts, OUTCOMES, readRunArtifact, UNASSIGNED,
  type CaseResult, type EvidencePin, type FamilyCounts, type Outcome, type ReadArtifact, type RunArtifact, type ScannerRun,
} from './run-artifact.ts';

/**
 * The one adapter boundary between credential-eval RunArtifacts and Redact Secret qualification (#605).
 *
 * It validates artifact identities, builds per-family views for each separately identified population, combines the
 * populations by product policy WITHOUT pooling their denominators, joins product-owned contract, taxonomy, empirical,
 * review-ledger and known-gap metadata, and applies the existing stable/provisional/pending rules
 * (`classifyFamilySupport`, unchanged). It never re-scores a case, never reads `non_semantic`, and credential-eval
 * never emits a status: every status here is computed here. The output is a pure function of its inputs (no clock,
 * host or path), so the same artifacts and the same product inputs write the same bytes.
 * Spec: docs/specs/qualification-adapter.md.
 */
export const ADAPTER = { id: 'credential-eval-run-artifact', version: 1 } as const;
export const VIEW_SCHEMA = 'redact-secret/qualification-view/v1';

export type PopulationRole = 'floors-and-gates' | 'gates' | 'policy-route';
export interface CombinationPolicy {
  schemaVersion: 1; id: string; scanner: string;
  populations: Record<string, { role: PopulationRole; rationale: string }>;
  axes: { positiveContext: 'overlay-else-group'; benignControl: 'overlay-else-taxonomy-else-group' };
  methods: { required: string[]; whenNotRun: 'block-stable'; source: 'methods-run' };
  rules: string[];
}
export interface PopulationRegistryEntry { id: string; source: string; runClass: 'public' | 'internal'; publishable: boolean; evidence: EvidencePin }
/** `methodsBytes` is the methods run of the same population (docs/specs/official-runs.md, "The methods run"): a second artifact over the same evidence, whose cases are generated variants. Only the floors population carries one. */
export interface ArtifactInput { population: string; bytes: Buffer; caseMetadata?: Record<string, CaseMetadata>; methodsBytes?: Buffer }
export interface CaseMetadata { group: string; contextAxis?: string; expectedAction?: string; policyConformance?: boolean }

export interface ContractFacts { tier: Tier; providerSource?: unknown; supportedContext?: string[]; unprobeable?: unknown; fixtureProfile?: ProfileId }
export interface EmpiricalFacts {
  observationCount: number; observationSubjects: number; observationIssuanceDates: number;
  corroborationReferences: number; corroborationOwners: number; corroborationClasses: string[];
  unresolvedContradictions: number; boundedContradictions: number; uncertainty: string | null;
  supportedContexts: string[]; empiricalMode: 'shape' | 'context-constrained' | null; supportsBareValues: boolean;
}
export interface PolicyCriteria {
  minimumPositiveCases: number; minimumPositiveAxes: number; minimumBenignCases: number; minimumBenignAxes: number; minimumTwinPairs: number;
  exactSpanMisses: number; leakedSpans: number; overbroadSpans: number; collateralBytes: number; redactFalseAlarms: number; blockFalseAlarms: number;
  unexpectedPositiveActions: number; unresolvedActionCases: number; unresolvedCriticalFailures: number; requirePublicConformance: boolean; requireProtectedHoldout: boolean;
}
export interface PolicyContract { trigger: string; candidate: string; exactSpan: string; exclusions: string[]; blindSpots: string[] }
export interface KnownGapRecord { id: string; number?: number; url?: string; status: string; kind?: string; fixtures: string[] }
export interface TaxonomyFamily { id: string; provider: string | null; name: string; detectors: string[]; supportStatus?: string }

export interface PolicyRevision { revision: string; components: { path: string; digest: string }[] }
export interface ProductInputs {
  families: string[];
  contracts: Record<string, ContractFacts | undefined>;
  taxonomy: Taxonomy;
  empirical: (family: string) => EmpiricalFacts;
  criteria: StatusCriteria;
  profiles: FixtureProfiles;
  policyCriteria: PolicyCriteria;
  policyContracts: Record<string, PolicyContract>;
  ledger: ReviewLedger;
  knownGaps: KnownGapRecord[];
  policy: CombinationPolicy;
  policyRevision: PolicyRevision;
  /** The product-owned axis overlay of the floors population (benchmarks/support/public-axis-overlay.json), bound to its snapshot by corpus digest. */
  axisOverlay?: AxisOverlay;
  holdoutReceipt?: PolicyHoldoutReceipt;
}

export interface ScannerSlice { scanner: string; counts: FamilyCounts }
export interface PopulationView {
  population: string; role: PopulationRole; runClass: 'public' | 'internal'; denominator: string;
  artifact: ArtifactIdentity;
}
export interface ArtifactIdentity {
  artifactDigest: string; semanticDigest: string; schema: string;
  engine: { name: string; version: string }; protocolVersion: string; configHash: string;
  evidence: RunArtifact['manifest']['evidence']; engineRunClass: string | undefined; publication: string | undefined;
  methods: string[]; caseCount: number;
  scanners: { id: string; version: string | null; mode: string; build: string | null; adapter: { id: string; version: string }; configurationHash: string; status: string }[];
}

const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const sorted = <T>(items: Iterable<T>, key: (item: T) => string = String as unknown as (item: T) => string) => [...items].sort((a, b) => byteOrder(key(a), key(b)));

interface Loaded { input: ArtifactInput; entry: PopulationRegistryEntry; role: PopulationRole; artifact: RunArtifact; identity: ArtifactIdentity; publishable: boolean; methods?: { artifact: RunArtifact; identity: ArtifactIdentity } }

/** The seed case a methods-run row belongs to: the evaluation case id is `<corpus case id>--<method>`. */
export const seedCaseId = (caseId: string, method: string) => (caseId.endsWith(`--${method}`) ? caseId.slice(0, -`--${method}`.length) : caseId);

/** Resolve a case to the product detector families it belongs to: its own targets, plus its family (a detector id, or a taxonomy family served by detectors). */
export function detectorsOf(c: CaseResult, detectorIds: Set<string>, taxonomyDetectors: Map<string, string[]>): string[] {
  const out = new Set<string>();
  for (const target of c.targets ?? []) if (detectorIds.has(target)) out.add(target);
  if (c.family) {
    if (detectorIds.has(c.family)) out.add(c.family);
    else for (const detector of taxonomyDetectors.get(c.family) ?? []) if (detectorIds.has(detector)) out.add(detector);
  }
  return [...out];
}

function identityOf(read: ReadArtifact): ArtifactIdentity {
  const m = read.artifact.manifest;
  return {
    artifactDigest: read.artifactDigest, semanticDigest: read.semanticDigest, schema: read.artifact.schema,
    engine: m.engine, protocolVersion: m.protocol_version, configHash: m.config_hash, evidence: m.evidence,
    engineRunClass: m.run_class, publication: m.publication, methods: sorted(m.methods.map(x => x.id)),
    caseCount: read.artifact.scanners[0]?.cases.length ?? 0,
    scanners: sorted(m.scanners, s => s.id).map(s => ({
      id: s.id, version: s.version, mode: s.mode, build: s.build ?? null, adapter: s.adapter, configurationHash: s.configuration_hash,
      status: read.artifact.scanners.find(r => r.scanner === s.id)?.status ?? 'absent',
    })),
  };
}

const productRun = (artifact: RunArtifact, scanner: string): ScannerRun => {
  const run = artifact.scanners.find(s => s.scanner === scanner);
  if (!run) throw new Error(`Artifact has no ${scanner} scanner run`);
  return run;
};

/**
 * The floor cells of one population's cases. With the product axis overlay (#636) a counted case is named by the axis the
 * product authored for it: its source-context group (positives) and its reviewed benign taxonomy (controls). A case the
 * overlay does not name keeps the snapshot's own vocabulary; an overlay `null` is a control with no reviewed axis.
 */
function fixtureCells(cases: CaseResult[], overlay?: AxisOverlay): { cells: FixtureCells; positiveCases: number; positiveAxes: number; contextTwinPairs: number; confusionAxes: number; benignAxisIds: string[]; benignCases: number } {
  const scored = cases.filter(c => c.measurement.type !== 'pending' && c.measurement.type !== 'not-measured');
  const isSecret = (c: CaseResult) => c.expected.some(e => e.role === 'secret');
  const twins = scored.filter(c => c.twin_of);
  const paired = new Set(twins.map(c => c.twin_of!));
  const positives = scored.filter(c => !c.twin_of && isSecret(c));
  const controls = scored.filter(c => !c.twin_of && !isSecret(c));
  const controlAxis = (c: CaseResult) => (overlay && Object.hasOwn(overlay.controls, c.case_id) ? overlay.controls[c.case_id] : c.taxonomy ?? c.group);
  // The legacy classifier counted two things: the fixture-profile cell by fixture group alone, and `positiveAxes` by `<category>/<group>`.
  const contextAxis = (c: CaseResult) => (overlay && Object.hasOwn(overlay.contexts, c.case_id) ? overlay.contexts[c.case_id] : c.group);
  const controlAxisIds = sorted(new Set(controls.map(controlAxis).filter((axis): axis is string => axis !== null)));
  const positiveContextAxisIds = sorted(new Set(positives.map(c => (overlay && Object.hasOwn(overlay.contexts, c.case_id) ? contextGroup(overlay.contexts[c.case_id]) : c.group))));
  const positiveCategoryAxes = new Set(positives.map(contextAxis));
  const mutationKinds = new Set(twins.map(c => c.twin_mutation_kind ?? 'unspecified'));
  const confusionAxisIds = sorted(new Set([...controlAxisIds, ...[...mutationKinds].map(kind => `twin:${kind}`)]));
  return {
    cells: {
      totalFixtures: scored.length, positiveCases: positives.filter(c => !paired.has(c.case_id)).length, benignControls: controls.length, twinPairs: twins.length,
      positiveContextAxes: positiveContextAxisIds.length, controlAxes: controlAxisIds.length, confusionAxes: confusionAxisIds.length,
      positiveContextAxisIds, controlAxisIds, confusionAxisIds,
    },
    positiveCases: positives.length, positiveAxes: positiveCategoryAxes.size,
    contextTwinPairs: twins.filter(c => c.twin_mutation_kind === 'context').length,
    confusionAxes: new Set([...controlAxisIds, ...mutationKinds]).size,
    benignAxisIds: controlAxisIds, benignCases: controls.length,
  };
}

const emptyActions = (): Record<PolicyAction, number> => ({ warn: 0, redact: 0, block: 0, allow: 0 });
const actionOf = (value: string | null | undefined): PolicyAction | null => (value && ['warn', 'redact', 'block', 'allow'].includes(value) ? value as PolicyAction : null);

/** The T3 policy-route aggregate (benchmarks/support/policy-qualified.ts `policyBehaviorAggregate`), read from one artifact's per-case measurements and the product-side case metadata. */
export function policyAggregate(family: string, cases: CaseResult[], metadata: Record<string, CaseMetadata>, input: ProductInputs, criticalFailures: number, holdout: PolicyHoldoutReceipt | undefined): PolicyBehaviorAggregate | null {
  const contract = input.policyContracts[family];
  if (!contract) return null;
  const selected = cases.filter(c => c.tier !== 'T0' && (!c.expected.some(e => e.role === 'secret') || c.tier === 'T3'));
  const outcomes = Object.fromEntries(OUTCOMES.map(o => [o, 0])) as Record<Outcome, number>;
  const positiveActions = emptyActions(), controlFalseAlarms = emptyActions();
  const positiveAxes = new Set<string>(), benignAxes = new Set<string>();
  let positiveCases = 0, benignCases = 0, twinPairs = 0, spans = 0, collateralBytes = 0, unexpectedPositiveActions = 0, unresolvedActionCases = 0, conformanceCases = 0, conformanceFailures = 0;
  for (const c of selected) {
    const meta = metadata[c.case_id];
    const actual = c.actual.filter(finding => finding.family === family);
    const conformance = meta?.policyConformance === true;
    if (conformance) conformanceCases++;
    if (c.measurement.type === 'not-measured') { if (conformance) conformanceFailures++; continue; }
    if (c.measurement.type === 'positive') {
      positiveCases++;
      positiveAxes.add(meta?.contextAxis ?? `${c.group}/${meta?.group ?? c.group}`);
      for (const outcome of c.measurement.span_outcomes) { outcomes[outcome]++; spans++; }
      collateralBytes += c.measurement.collateral_bytes;
      const actions = new Set(actual.map(f => actionOf(f.action)).filter((a): a is PolicyAction => Boolean(a)));
      for (const action of actions) positiveActions[action]++;
      const expectedAction = meta?.expectedAction;
      const wrongAction = !expectedAction || !actions.has(expectedAction as PolicyAction) || actions.size !== 1 || actual.some(f => actionOf(f.action) !== expectedAction);
      if (conformance) {
        if (!expectedAction) unresolvedActionCases++; else if (wrongAction) unexpectedPositiveActions++;
        if (c.measurement.span_outcomes.some(o => o !== 'EXACT') || wrongAction) conformanceFailures++;
      }
    } else if (c.measurement.type === 'control') {
      if (c.twin_of) twinPairs++; else { benignCases++; benignAxes.add(meta?.contextAxis ?? c.taxonomy ?? meta?.group ?? c.group); }
      for (const action of new Set(actual.map(f => actionOf(f.action)).filter((a): a is PolicyAction => Boolean(a)))) controlFalseAlarms[action]++;
      if (conformance && actual.length) conformanceFailures++;
    }
  }
  const publicConformance = conformanceCases === 0 ? 'not-run' : conformanceFailures === 0 ? 'pass' : 'fail';
  const protectedHoldout = holdout ? (holdout.report.families as Record<string, { failures: number }>)[family]?.failures === 0 ? 'pass' : 'fail' : 'not-run';
  const aggregate: Omit<PolicyBehaviorAggregate, 'failedGates'> = {
    profileId: 'credential-policy-v1', contractVersion: 1,
    contractBounded: Boolean(contract.trigger && contract.candidate && contract.exactSpan && contract.exclusions.length && contract.blindSpots.length),
    positiveCases, positiveAxes: positiveAxes.size, benignCases, benignAxes: benignAxes.size, twinPairs,
    spans, outcomes, exactSpanMisses: spans - outcomes.EXACT, leakedSpans: outcomes.PARTIAL + outcomes.MISS, overbroadSpans: outcomes.OVERBROAD, collateralBytes,
    positiveActions, controlFalseAlarms, unexpectedPositiveActions, unresolvedActionCases,
    publicConformanceCases: conformanceCases, publicConformanceFailures: conformanceFailures,
    publicConformance, protectedHoldout, candidateFrozen: Boolean(holdout),
  };
  const c = input.policyCriteria, failedGates: PolicyGateFailure[] = [];
  const floor = (code: PolicyGateCode, actual: number, required: number, comparison: 'min' | 'max' = 'min') => {
    if (comparison === 'min' ? actual < required : actual > required) failedGates.push({ code, actual, required });
  };
  if (!aggregate.contractBounded) failedGates.push({ code: 'policy-contract', actual: 'unbounded', required: 'bounded' });
  floor('positive-cases', positiveCases, c.minimumPositiveCases); floor('positive-axes', positiveAxes.size, c.minimumPositiveAxes);
  floor('benign-cases', benignCases, c.minimumBenignCases); floor('benign-axes', benignAxes.size, c.minimumBenignAxes); floor('twin-pairs', twinPairs, c.minimumTwinPairs);
  floor('exact-span', aggregate.exactSpanMisses, c.exactSpanMisses, 'max'); floor('leaked-span', aggregate.leakedSpans, c.leakedSpans, 'max');
  floor('overbroad-span', aggregate.overbroadSpans, c.overbroadSpans, 'max'); floor('collateral', collateralBytes, c.collateralBytes, 'max');
  floor('redact-false-alarm', controlFalseAlarms.redact, c.redactFalseAlarms, 'max'); floor('block-false-alarm', controlFalseAlarms.block, c.blockFalseAlarms, 'max');
  floor('positive-action', unexpectedPositiveActions, c.unexpectedPositiveActions, 'max'); floor('unresolved-action', unresolvedActionCases, c.unresolvedActionCases, 'max');
  floor('critical-failure', criticalFailures, c.unresolvedCriticalFailures, 'max');
  if (c.requirePublicConformance && publicConformance !== 'pass') failedGates.push({ code: 'public-conformance', actual: publicConformance, required: 'pass' });
  if (c.requireProtectedHoldout && (protectedHoldout !== 'pass' || !aggregate.candidateFrozen)) failedGates.push({ code: 'protected-holdout', actual: protectedHoldout, required: 'pass on frozen candidate' });
  return { ...aggregate, failedGates };
}

export function validateCombinationPolicy(policy: CombinationPolicy, registry: PopulationRegistryEntry[]): void {
  if (policy.schemaVersion !== 1 || !policy.scanner) throw new Error('Invalid qualification population policy');
  const roles = Object.values(policy.populations).map(p => p.role);
  if (roles.filter(r => r === 'floors-and-gates').length !== 1) throw new Error('The population policy needs exactly one floors-and-gates population');
  if (roles.filter(r => r === 'policy-route').length > 1) throw new Error('The population policy allows at most one policy-route population');
  for (const id of Object.keys(policy.populations)) if (!registry.some(p => p.id === id)) throw new Error(`The population policy names ${id}, which is not in the population registry`);
}

export interface BuildOptions { registry: PopulationRegistryEntry[]; engine: { version: string; protocol: string }; artifacts: ArtifactInput[]; product: ProductInputs }

/** Build the qualification view from separately identified artifacts. Throws on any artifact that does not validate or bind: one invalid artifact invalidates the decisions that cite it. */
export function buildQualificationView({ registry, engine, artifacts, product }: BuildOptions) {
  const { policy } = product;
  validateCombinationPolicy(policy, registry);
  const loaded: Loaded[] = [];
  const seen = new Set<string>();
  for (const input of artifacts) {
    if (seen.has(input.population)) throw new Error(`Two artifacts were supplied for population ${input.population}; a population is one artifact`);
    seen.add(input.population);
    const entry = registry.find(p => p.id === input.population);
    const role = policy.populations[input.population]?.role;
    if (!entry || !role) throw new Error(`Population ${input.population} is not in the registry and the population policy`);
    const read = readRunArtifact(input.bytes);
    const problems = bindingProblems(read.artifact, entry.evidence, { engineVersion: engine.version, protocol: engine.protocol });
    if (problems.length) throw new Error(`Artifact for ${input.population} is not accepted: ${problems.join('; ')}`);
    const identity = identityOf(read);
    if (role === 'floors-and-gates' && identity.methods.length) throw new Error(`The ${input.population} artifact lists methods (${identity.methods.join(', ')}); the floors come from a plain run, whose cases are the corpus cases. Supply the methods run separately (methodsBytes)`);
    let methods: Loaded['methods'];
    if (input.methodsBytes) {
      if (role !== 'floors-and-gates') throw new Error(`A methods run was supplied for ${input.population}, which is not the floors population; only the floors population carries one`);
      const run = readRunArtifact(input.methodsBytes);
      const methodsProblems = bindingProblems(run.artifact, entry.evidence, { engineVersion: engine.version, protocol: engine.protocol });
      if (methodsProblems.length) throw new Error(`Methods run for ${input.population} is not accepted: ${methodsProblems.join('; ')}`);
      if (!run.artifact.manifest.methods.length) throw new Error(`The methods run for ${input.population} lists no method in manifest.methods; it is a plain run`);
      // The same scanners must have produced both artifacts: a methods run over other builds or other scanner configurations measures something else.
      const plain = new Map(read.artifact.manifest.scanners.map(x => [x.id, x]));
      for (const x of run.artifact.manifest.scanners) {
        const other = plain.get(x.id);
        if (!other || other.version !== x.version || other.configuration_hash !== x.configuration_hash || (other.build ?? null) !== (x.build ?? null))
          throw new Error(`Methods run for ${input.population}: scanner ${x.id} differs from the plain run (version, configuration or build)`);
      }
      if (plain.size !== run.artifact.manifest.scanners.length) throw new Error(`Methods run for ${input.population} measures a different scanner set than the plain run`);
      methods = { artifact: run.artifact, identity: identityOf(run) };
    }
    loaded.push({ input, entry, role, artifact: read.artifact, identity, publishable: entry.publishable, methods });
  }
  const floorsPopulation = Object.entries(policy.populations).find(([, p]) => p.role === 'floors-and-gates')![0];
  const policyPopulation = Object.entries(policy.populations).find(([, p]) => p.role === 'policy-route')?.[0];
  for (const id of Object.keys(policy.populations)) if (!seen.has(id)) throw new Error(`No artifact for population ${id}, which the population policy requires`);
  loaded.sort((a, b) => byteOrder(a.input.population, b.input.population));
  if (product.holdoutReceipt && policyPopulation && loaded.find(l => l.input.population === policyPopulation)!.identity.scanners.find(s => s.id === policy.scanner)?.build !== 'candidate')
    throw new Error('A policy holdout receipt can only qualify an immutable candidate run');

  const floorsArtifact = loaded.find(l => l.input.population === floorsPopulation)!;
  const floorsOverlay = product.axisOverlay;
  if (floorsOverlay) {
    if (floorsOverlay.population !== floorsPopulation) throw new Error(`The axis overlay is for ${floorsOverlay.population}, the floors population is ${floorsPopulation}`);
    if (floorsOverlay.snapshot.corpusDigest !== floorsArtifact.artifact.manifest.evidence.corpus_digest)
      throw new Error(`The axis overlay is derived from corpus ${floorsOverlay.snapshot.corpusDigest}, the ${floorsPopulation} artifact ran ${floorsArtifact.artifact.manifest.evidence.corpus_digest}; regenerate it (npm run qualification:axis-overlay)`);
  }

  const scannerIds = sorted(new Set(loaded.flatMap(l => l.artifact.scanners.map(s => s.scanner))));
  const detectorIds = new Set(product.families);
  const taxonomyDetectors = new Map(product.taxonomy.families.map(f => [f.id, f.detectors]));
  const detectorTaxonomy = (detector: string) => product.taxonomy.families.filter(f => f.detectors.includes(detector));
  const ledgerSettled = (id: string) => ['resolved', 'not-assertable'].includes(product.ledger.entries[id]?.status as string);

  // Per population, per scanner: cases grouped by detector, with the unattributed remainder kept visible.
  const perPopulation = new Map<string, { run: Map<string, ScannerRun>; byDetector: Map<string, Map<string, CaseResult[]>>; counts: Map<string, Map<string, FamilyCounts>>; unattributed: Map<string, FamilyCounts> }>();
  for (const l of loaded) {
    const runs = new Map(l.artifact.scanners.map(s => [s.scanner, s]));
    const grouped = new Map<string, Map<string, CaseResult[]>>(), counts = new Map<string, Map<string, FamilyCounts>>(), unattributed = new Map<string, FamilyCounts>();
    for (const scanner of scannerIds) {
      const run = runs.get(scanner);
      if (!run) continue;
      const index = byId(run), perDetector = new Map<string, FamilyCounts>(), rest = emptyCounts();
      const own = new Map<string, CaseResult[]>();
      for (const c of run.cases) {
        const detectors = detectorsOf(c, detectorIds, taxonomyDetectors);
        if (!detectors.length) countCase(rest, c, index);
        for (const detector of detectors) {
          if (!perDetector.has(detector)) perDetector.set(detector, emptyCounts());
          countCase(perDetector.get(detector)!, c, index);
          if (!own.has(detector)) own.set(detector, []);
          own.get(detector)!.push(c);
        }
      }
      grouped.set(scanner, own); counts.set(scanner, perDetector); unattributed.set(scanner, rest);
    }
    perPopulation.set(l.input.population, { run: runs, byDetector: grouped, counts, unattributed });
  }
  const countsFor = (population: string, scanner: string, detector: string) => perPopulation.get(population)?.counts.get(scanner)?.get(detector);

  const families = product.families.slice().sort(byteOrder).map(family => {
    const contract = product.contracts[family];
    const empirical = product.empirical(family);
    const productCases = (population: string) => perPopulation.get(population)?.byDetector.get(policy.scanner)?.get(family) ?? [];

    // Floors and the cells come from the floors population alone. Nothing is pooled across populations.
    const floorsCases = productCases(floorsPopulation);
    const measured = fixtureCells(floorsCases, floorsOverlay);
    const floorsCounts = countsFor(floorsPopulation, policy.scanner, family) ?? emptyCounts();

    // Zero-tolerance gates read every gate-bearing population on its own; the classifier receives the worst one, never a sum.
    const gateRows = loaded.filter(l => l.role !== 'policy-route').map(l => {
      const c = countsFor(l.input.population, policy.scanner, family) ?? emptyCounts();
      return { population: l.input.population, twinPairs: c.twins.pairs, twinFailures: c.twins.pairs - c.twins.discriminated, benignCases: c.benign.cases, benignFalseAlarms: c.benign.flagged };
    });
    const worst = (key: 'twinFailures' | 'benignFalseAlarms') => Math.max(0, ...gateRows.map(r => r[key]));

    // Methods the run did not execute cannot be evaluated; they never read as zero failures. The methods run, when there is one, is a
    // second artifact of the floors population: its cases are generated variants, so a family's methods evidence is attributed through the
    // seed case of each assertion or review occurrence (`<case id>--<method>`) to the same floors cases that carry the floors.
    const methodsSource = floorsArtifact.methods;
    const floorsMethods = new Set(methodsSource?.identity.methods ?? []);
    const methodsNotRun = policy.methods.required.filter(method => !floorsMethods.has(method));
    const floorsIds = new Set(floorsCases.map(c => c.case_id));
    const methodsRun = methodsSource?.artifact.scanners.find(s => s.scanner === policy.scanner);
    const assertionFailures = (method: string) => (methodsRun?.assertions ?? []).filter(a => a.method === method && a.status === 'fail' && floorsIds.has(seedCaseId(a.case_id, method))).length;
    const unresolvedInQueue = (method: string) => (methodsSource?.artifact.review_queue ?? [])
      .filter(q => q.method === method && floorsIds.has(seedCaseId(q.case_id, method)) && !ledgerSettled(q.id)).length;
    const metamorphicCriticalFailures = floorsMethods.has('metamorphic') ? assertionFailures('metamorphic') : 0;
    const mutationUnresolvedCritical = floorsMethods.has('mutation') ? assertionFailures('mutation') + unresolvedInQueue('mutation') : 0;
    const differentialUnresolved = floorsMethods.has('differential') ? unresolvedInQueue('differential') : 0;
    const criticalFailures = metamorphicCriticalFailures + mutationUnresolvedCritical + differentialUnresolved;

    const tier = contract?.tier ?? null;
    const evidenceBasis: EvidenceBasis = tier === 'T1' ? 'provider-documented' : tier === 'T3' ? 'project-policy' : tier === 'T2' ? basisForRoute(empiricalRoute(empirical)) : 'none';
    const policyLoaded = policyPopulation ? loaded.find(l => l.input.population === policyPopulation) : undefined;
    const policyQualification = policyLoaded && policyPopulation
      ? policyAggregate(family, productCases(policyPopulation), policyLoaded.input.caseMetadata ?? {}, product, criticalFailures, product.holdoutReceipt)
      : null;

    const evidence: FamilySupportEvidence = {
      family, detectors: contract ? [family] : [], positiveContractTier: tier,
      hasProviderSource: tier === 'T1' && Boolean(contract?.providerSource),
      ...empirical, evidenceBasis,
      positiveCases: measured.positiveCases, positiveAxes: measured.positiveAxes, controlAxes: measured.benignAxisIds.length,
      totalFixtures: measured.cells.totalFixtures, contextTwinPairs: measured.contextTwinPairs, confusionAxes: measured.confusionAxes,
      twinPairs: floorsCounts.twins.pairs, twinFailures: worst('twinFailures'),
      benignCases: measured.benignCases, benignFalseAlarms: worst('benignFalseAlarms'),
      benignAxes: measured.benignAxisIds.length, benignAxisIds: measured.benignAxisIds,
      metamorphicCriticalFailures, mutationUnresolvedCritical, differentialUnresolvedContractDisagreements: differentialUnresolved,
      policyQualification,
      fixtureProfile: { claim: profileClaim(contract && { tier: contract.tier, providerSource: contract.providerSource, fixtureProfile: contract.fixtureProfile }, empirical.empiricalMode), cells: measured.cells,
        supportedContext: contract?.supportedContext ?? (empirical.supportedContexts.length ? empirical.supportedContexts : undefined) },
    };
    const assessed = classifyFamilySupport(evidence, product.criteria, product.profiles);
    let status: SupportStatus = assessed.status, qualificationProfile: QualificationProfile | null = assessed.qualificationProfile, reasons = [...assessed.reasons];
    if (status === 'stable' && methodsNotRun.length && policy.methods.whenNotRun === 'block-stable') {
      status = 'provisional'; qualificationProfile = null;
      reasons.push(`methods.notRun: ${methodsNotRun.join(', ')} did not run for ${floorsPopulation} (${methodsSource ? `its methods run lists ${[...floorsMethods].join(', ')}` : 'no methods run is supplied'}), so their stable gates are unmeasured; unmeasured is not zero failures`);
    }
    const { fixtureProfile, ...scored } = evidence;
    return {
      family,
      taxonomyFamilies: detectorTaxonomy(family).map(f => ({ id: f.id, provider: f.provider, name: f.name })),
      contract: contract ? { tier: contract.tier, providerSource: Boolean(contract.providerSource), unprobeable: contract.unprobeable ?? null, supportedContext: contract.supportedContext ?? [] } : null,
      status: { value: status, reasons, qualificationProfile, evidenceTier: tier, evidenceBasis, methodsNotRun },
      evidence: scored,
      fixtureProfile: fixtureProfileReport(fixtureProfile!.claim, fixtureProfile!.cells, product.profiles),
      gates: gateRows,
      populations: loaded.map(l => ({
        population: l.input.population, role: l.role,
        scanners: scannerIds.filter(id => perPopulation.get(l.input.population)!.run.has(id)).map(id => ({ scanner: id, counts: countsFor(l.input.population, id, family) ?? emptyCounts() })),
      })),
    };
  });

  // Known-gap joins: a record's fixtures are matched to cases by id, in every population that carries that id.
  const knownGaps = product.knownGaps.map(gap => ({
    id: gap.id, status: gap.status, kind: gap.kind ?? null, number: gap.number ?? null,
    fixtures: gap.fixtures.map(fixture => ({
      fixture,
      matches: loaded.flatMap(l => {
        const c = perPopulation.get(l.input.population)!.run.get(policy.scanner)?.cases.find(x => x.case_id === fixture);
        return c ? [{ population: l.input.population, measurement: c.measurement.type, outcomes: c.measurement.type === 'positive' ? c.measurement.span_outcomes : null, flagged: c.measurement.type === 'control' ? c.measurement.flagged : null }] : [];
      }),
    })),
  }));

  const distribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 } as Record<SupportStatus, number>;
  for (const f of families) distribution[f.status.value]++;
  const stableDistribution = { documented: 0, empirical: 0, 'policy-qualified': 0 };
  for (const f of families) if (f.status.value === 'stable' && f.status.qualificationProfile) stableDistribution[f.status.qualificationProfile]++;

  const publication = loaded.every(l => l.identity.publication === 'public' && (l.methods?.identity.publication ?? 'public') === 'public' && l.publishable) ? 'public' : 'internal';
  return {
    schema: VIEW_SCHEMA,
    adapter: ADAPTER,
    publication,
    policy: {
      id: policy.id, revision: product.policyRevision.revision, components: product.policyRevision.components, scanner: policy.scanner,
      populations: Object.fromEntries(Object.entries(policy.populations).map(([id, p]) => [id, p.role])), methodsRequired: policy.methods.required,
      criteria: product.criteria, fixtureProfilesVersion: product.profiles.profilesVersion, rules: policy.rules,
      ...(floorsOverlay ? { axisOverlay: { id: floorsOverlay.id, population: floorsOverlay.population, corpusDigest: floorsOverlay.snapshot.corpusDigest, contexts: Object.keys(floorsOverlay.contexts).length, controls: Object.keys(floorsOverlay.controls).length } } : {}),
    },
    populations: loaded.map<PopulationView>(l => ({
      population: l.input.population, role: l.role, denominator: l.input.population,
      runClass: l.identity.publication === 'public' && l.publishable ? 'public' : 'internal', artifact: l.identity,
      ...(l.methods ? { methodsArtifact: l.methods.identity } : {}),
    })).map(view => ({
      ...view,
      unattributed: scannerIds.filter(id => perPopulation.get(view.population)!.unattributed.has(id)).map(id => ({ scanner: id, counts: perPopulation.get(view.population)!.unattributed.get(id)! })),
      aggregates: scannerIds.filter(id => perPopulation.get(view.population)!.run.has(id)).map(id => {
        const run = perPopulation.get(view.population)!.run.get(id)!;
        return { scanner: id, status: run.status, groups: run.aggregates.groups, byTarget: run.aggregates.by_target ?? {} };
      }),
    })),
    scanners: scannerIds,
    distribution, stableDistribution,
    families,
    undetected: product.taxonomy.families.filter(f => f.detectors.length === 0).map(f => ({ id: f.id, provider: f.provider, name: f.name, supportStatus: f.supportStatus ?? null })).sort((a, b) => byteOrder(a.id, b.id)),
    knownGaps,
    unmappedFamilies: sorted(new Set(loaded.flatMap(l => perPopulation.get(l.input.population)!.run.get(policy.scanner)?.cases.filter(c => !detectorsOf(c, detectorIds, taxonomyDetectors).length && c.family && c.family !== UNASSIGNED).map(c => `${l.input.population}:${c.family}`) ?? []))),
  };
}

export type QualificationView = ReturnType<typeof buildQualificationView>;

/** Deterministic serialization: keys in byte order, no clock, no host. */
export const serializeView = (view: QualificationView) => `${canonical(view)}\n`;
