import type { EvaluationCase } from '../engine/types.ts';
import data from './fixture-profiles.json';
import { disputedProperty } from '../lib/assessment.ts';

/**
 * Fixture profiles (issue #206, part of #114 and #177). Machine-readable,
 * versioned criteria for how much fixture evidence a family carries, measured
 * per evidence cell so a large total can never hide an empty one. Cells and
 * axes are counted from the corpus alone: no scanner runs, so the result is
 * deterministic and checkable offline. See docs/specs/support-status.md.
 */
export type ProfileId = 'arrival-provisional' | 'stable-documented' | 'stable-empirical' | 'context-constrained-empirical';
export type CellId = 'totalFixtures' | 'positiveCases' | 'benignControls' | 'twinPairs' | 'positiveContextAxes' | 'controlAxes' | 'confusionAxes';
export const CELL_IDS: readonly CellId[] = ['totalFixtures', 'positiveCases', 'benignControls', 'twinPairs', 'positiveContextAxes', 'controlAxes', 'confusionAxes'];

export interface FixtureGates { enforced: boolean; pending: string[]; rationale: string }
export interface FixtureProfile {
  title: string;
  qualification: 'documented' | 'empirical' | null;
  enforcement: 'reported' | 'enforced';
  enforcementRationale: string;
  extends?: ProfileId;
  requiresEvidenceTier?: 'T1' | 'T2';
  requiresProviderSource?: boolean;
  bareValueSupport?: false;
  requiresSupportedContext?: true;
  cells: Partial<Record<CellId, number>>;
  cellNotes?: Partial<Record<CellId, string>>;
  gates?: FixtureGates;
  rationale: string;
}
export interface FixtureProfiles {
  schemaVersion: 1;
  profilesVersion: number;
  unit: string;
  axes: { positiveContext: string; control: string; confusion: string };
  profiles: Record<ProfileId, FixtureProfile>;
}
export const fixtureProfiles = data as unknown as FixtureProfiles;
export const PROFILE_IDS = Object.keys(fixtureProfiles.profiles) as ProfileId[];

export function validateFixtureProfiles(value: unknown): FixtureProfiles {
  const v = value as FixtureProfiles;
  if (!v || v.schemaVersion !== 1 || !Number.isInteger(v.profilesVersion) || v.profilesVersion < 1) throw new Error('Invalid fixture profiles: schemaVersion/profilesVersion');
  for (const id of ['arrival-provisional', 'stable-documented', 'stable-empirical', 'context-constrained-empirical'] as const) {
    const p = v.profiles?.[id];
    if (!p || !p.rationale || !p.enforcementRationale || !['reported', 'enforced'].includes(p.enforcement)) throw new Error(`Invalid fixture profiles: ${id}`);
    for (const [cell, count] of Object.entries(p.cells ?? {}))
      if (!CELL_IDS.includes(cell as CellId) || !Number.isInteger(count) || count < 1) throw new Error(`Invalid fixture profiles: ${id}.${cell}`);
    for (const cell of ['totalFixtures', 'positiveCases', 'benignControls', 'twinPairs'] as const)
      if (!p.cells[cell]) throw new Error(`Invalid fixture profiles: ${id} leaves ${cell} unrequired, so its cell could be empty`);
    if (p.qualification === 'empirical' && (p.requiresEvidenceTier !== 'T2' || !p.gates?.pending.length))
      throw new Error(`Invalid fixture profiles: ${id} is empirical, so it must require T2 evidence and name its pending gates`);
  }
  return v;
}

/** The measured evidence cells of one family: what the corpus holds, never what a scanner did with it. */
export interface FixtureCells {
  totalFixtures: number;
  positiveCases: number;
  benignControls: number;
  twinPairs: number;
  positiveContextAxes: number;
  controlAxes: number;
  confusionAxes: number;
  positiveContextAxisIds: string[];
  controlAxisIds: string[];
  confusionAxisIds: string[];
}

/** `cases` may cover any number of families; only the differential case per fixture that targets `family` counts, so no fixture is counted twice. */
export function measureFixtureCells(family: string, cases: EvaluationCase[]): FixtureCells {
  // A fixture re-scoped off a provider-undecided property (lib/assessment.ts `disputedProperty`) is T0 history: it fills no cell.
  const own = cases.filter(c => c.method === 'differential' && c.targets.includes(family) && !disputedProperty(c.source.category, c.source.fixtureId));
  const key = (c: EvaluationCase, id: string) => `${c.source.category}--${id}`;
  const isSecret = (c: EvaluationCase) => c.seed.expected.some(r => (r.role ?? 'secret') === 'secret');
  const twins = own.filter(c => c.seed.twinOf);
  const paired = new Set(twins.map(c => key(c, c.seed.twinOf!)));
  const positives = own.filter(c => !c.seed.twinOf && isSecret(c));
  const controls = own.filter(c => !c.seed.twinOf && !isSecret(c));
  const controlAxisIds = [...new Set(cases.filter(c => c.method === 'benign' && c.targets.includes(family) && c.taxonomy && c.taxonomy !== 'pending').map(c => c.taxonomy!))].sort();
  const positiveContextAxisIds = [...new Set(positives.map(c => c.seed.group))].sort();
  const confusionAxisIds = [...new Set([...controlAxisIds, ...twins.map(c => `twin:${c.seed.mutationKind ?? 'unspecified'}`)])].sort();
  return {
    totalFixtures: own.length,
    positiveCases: positives.filter(c => !paired.has(key(c, c.seed.id))).length,
    benignControls: controls.length,
    twinPairs: twins.length,
    positiveContextAxes: positiveContextAxisIds.length,
    controlAxes: controlAxisIds.length,
    confusionAxes: confusionAxisIds.length,
    positiveContextAxisIds, controlAxisIds, confusionAxisIds,
  };
}

export interface CellDebt { cell: CellId; actual: number; required: number; shortfall: number }
export interface ProfileAssessment {
  profile: ProfileId;
  /** True only when every cell meets its floor; says nothing about tier, provider source or the still-pending gates. */
  cellsMet: boolean;
  debt: CellDebt[];
}

export function assessProfile(cells: FixtureCells, id: ProfileId, profiles: FixtureProfiles = fixtureProfiles): ProfileAssessment {
  const debt: CellDebt[] = [];
  for (const cell of CELL_IDS) {
    const required = profiles.profiles[id].cells[cell];
    if (required !== undefined && cells[cell] < required) debt.push({ cell, actual: cells[cell], required, shortfall: required - cells[cell] });
  }
  return { profile: id, cellsMet: !debt.length, debt };
}

/**
 * What a family's contract asks to be measured against; `explicit` is a claim in
 * the contract. Otherwise the claim is implicit: every T1 provider-documented
 * family claims `stable-documented`, and a T2 family with an empirical record
 * claims the empirical profile its mode names (#177 as amended 2026-09-24), so
 * the 40/48-fixture cells bind whichever route qualifies it.
 */
export interface ProfileClaim { profile: ProfileId | null; explicit: boolean }
export function profileClaim(contract: { tier: string; providerSource?: unknown; fixtureProfile?: ProfileId } | undefined, empiricalMode: 'shape' | 'context-constrained' | null = null): ProfileClaim {
  if (contract?.fixtureProfile) return { profile: contract.fixtureProfile, explicit: true };
  if (contract?.tier === 'T1' && contract.providerSource) return { profile: 'stable-documented', explicit: false };
  if (contract?.tier === 'T2' && empiricalMode) return { profile: empiricalMode === 'context-constrained' ? 'context-constrained-empirical' : 'stable-empirical', explicit: false };
  return { profile: null, explicit: false };
}

/** The evidence one family's fixture-profile check runs on, carried inside `FamilySupportEvidence`. */
export interface FixtureProfileEvidence {
  claim: ProfileClaim;
  cells: FixtureCells;
  supportedContext?: string[];
}

const label = (cell: CellId) => ({ totalFixtures: 'total fixtures', positiveCases: 'positive/context cases', benignControls: 'non-twin benign controls', twinPairs: 'twin pairs', positiveContextAxes: 'positive-context axes', controlAxes: 'control axes', confusionAxes: 'confusion axes' })[cell];

/**
 * Every reason this family's claimed profile is not met, or `[]` when it is met
 * or is only reported. Fails closed: an explicit claim, or any profile whose
 * own enforcement is `enforced`, is refused with the debt named; a missing
 * measurement is a failure, never a pass.
 */
export function profileFailures(
  evidence: { positiveContractTier: string | null; hasProviderSource: boolean; fixtureProfile?: FixtureProfileEvidence },
  profiles: FixtureProfiles = fixtureProfiles,
): string[] {
  const claim = evidence.fixtureProfile?.claim ?? (evidence.hasProviderSource ? { profile: 'stable-documented' as const, explicit: false } : { profile: null, explicit: false });
  if (!claim.profile) return [];
  const profile = profiles.profiles[claim.profile];
  const binding = claim.explicit || profile.enforcement === 'enforced';
  if (!binding) return [];
  const prefix = `fixtureProfile ${claim.profile}`;
  const reasons: string[] = [];
  if (!evidence.fixtureProfile) return [`${prefix}: fixture cells were not measured — a claimed profile fails closed`];
  const { cells } = evidence.fixtureProfile;
  for (const d of assessProfile(cells, claim.profile, profiles).debt)
    reasons.push(`${prefix}: ${d.actual} ${label(d.cell)} < ${d.required} (${d.shortfall} short)`);
  if (profile.requiresEvidenceTier && evidence.positiveContractTier !== profile.requiresEvidenceTier)
    reasons.push(`${prefix}: requires ${profile.requiresEvidenceTier} evidence, the contract is ${evidence.positiveContractTier ?? 'none'}; evidence tier is provenance and is never relabelled to fit a profile`);
  if (profile.requiresProviderSource && !evidence.hasProviderSource) reasons.push(`${prefix}: requires a T1 provider-documented source`);
  if (profile.requiresSupportedContext && !evidence.fixtureProfile.supportedContext?.length) reasons.push(`${prefix}: the contract names no supported context, and this profile makes no bare-value support claim`);
  if (profile.gates && !profile.gates.enforced) reasons.push(`${prefix}: ${profile.gates.pending.join(' and ')} are not enforced yet — ${profile.gates.rationale}`);
  return reasons;
}

/** Debt against the family's target profile: the claimed one, else the arrival structure. */
export function targetProfile(claim: ProfileClaim): ProfileId { return claim.profile ?? 'arrival-provisional'; }

export interface FixtureProfileReport {
  profilesVersion: number;
  claimed: ProfileId | null;
  explicit: boolean;
  target: ProfileId;
  /** Profiles whose cells are all met; not a qualification, which also needs the tier and the gates. */
  cellsMet: ProfileId[];
  cells: FixtureCells;
  /** Every floor for the target profile, published so readers never reconstruct criteria in the browser. */
  requiredCells: Partial<Record<CellId, number>>;
  /** Required axis dimensions for which this family has no tested axis id at all. */
  requiredButEmptyAxisIds: ('positiveContextAxes' | 'controlAxes' | 'confusionAxes')[];
  debt: CellDebt[];
}

export function fixtureProfileReport(claim: ProfileClaim, cells: FixtureCells, profiles: FixtureProfiles = fixtureProfiles): FixtureProfileReport {
  const target = targetProfile(claim);
  const requiredCells = { ...profiles.profiles[target].cells };
  const axisIds = {
    positiveContextAxes: cells.positiveContextAxisIds,
    controlAxes: cells.controlAxisIds,
    confusionAxes: cells.confusionAxisIds,
  } as const;
  return {
    profilesVersion: profiles.profilesVersion, claimed: claim.profile, explicit: claim.explicit, target,
    cellsMet: (Object.keys(profiles.profiles) as ProfileId[]).filter(id => assessProfile(cells, id, profiles).cellsMet),
    cells, requiredCells,
    requiredButEmptyAxisIds: (Object.keys(axisIds) as (keyof typeof axisIds)[]).filter(id => requiredCells[id] !== undefined && axisIds[id].length === 0),
    debt: assessProfile(cells, target, profiles).debt,
  };
}
