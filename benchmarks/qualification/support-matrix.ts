import type { Family } from '../support/taxonomy.ts';
import type { EvidenceBasis, QualificationProfile, SupportStatus } from '../support/status.ts';
import type { Tier } from '../types.ts';

/**
 * The support matrix of a qualification view (#607): the provider x credential-family projection the legacy path writes with
 * `npm run eval:matrix` (benchmarks/support/matrix.ts), derived here from the view's own per-detector families so a consumer
 * reads it without recomputing. It is a pure function of the view's `families` and the product taxonomy and contract facts: it
 * never re-derives a status. Every entry's status and reason are carried through from the detector family that decided it,
 * broadcast across every taxonomy family that detector serves, exactly as the legacy matrix does. Spec: docs/specs/qualification-adapter.md.
 */
export interface MatrixContract { providerSource?: unknown; corroboration?: { tool: string }[] }
/** The fields of one view family the matrix reads. */
export interface MatrixFamilyInput {
  family: string;
  taxonomyFamilies: { id: string }[];
  contract: { unprobeable: unknown } | null;
  status: { value: SupportStatus; reasons: string[]; qualificationProfile: QualificationProfile | null; evidenceTier: Tier | null; evidenceBasis: EvidenceBasis; methodsNotRun: string[] };
  evidence: Record<string, any>;
  fixtureProfile: unknown;
}
export type MatrixTaxonomyFamily = Pick<Family, 'id' | 'provider' | 'name' | 'detectors' | 'note' | 'sources' | 'supportStatus'>;

export interface SupportMatrixEntry {
  provider: string | null;
  family: string;
  familyName: string;
  status: SupportStatus;
  evidenceTier: Tier | null;
  evidenceBasis: EvidenceBasis;
  qualificationProfile: QualificationProfile | null;
  providerSource: unknown | null;
  corroboratingScanners: string[];
  twinCoverage: { pairs: number; failures: number; unprobeable: unknown | null } | null;
  /** A count is null when its method did not run for the family: unmeasured is not zero. */
  unresolvedCriticalItems: { metamorphic: number | null; mutation: number | null; differential: number | null } | null;
  empiricalEvidence: Record<string, unknown> | null;
  policyQualification: unknown | null;
  fixtureProfile: Record<string, number> | null;
  detectors: string[];
  reason: string | null;
  profileCoverage: unknown | null;
}
export interface SupportMatrix {
  distribution: Record<SupportStatus, number>;
  stableDistribution: Record<QualificationProfile, number>;
  families: SupportMatrixEntry[];
}

const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildViewSupportMatrix(families: MatrixFamilyInput[], taxonomyFamilies: MatrixTaxonomyFamily[], contractOf: (detector: string) => MatrixContract | undefined): SupportMatrix {
  const byTaxonomy = new Map<string, MatrixFamilyInput>();
  for (const result of families) for (const t of result.taxonomyFamilies) {
    const existing = byTaxonomy.get(t.id);
    if (existing) throw new Error(`Taxonomy family ${t.id} is claimed by more than one detector family (${existing.family} and ${result.family}).`);
    byTaxonomy.set(t.id, result);
  }
  const entries = taxonomyFamilies.map<SupportMatrixEntry>(family => {
    const result = byTaxonomy.get(family.id);
    if (family.detectors.length === 0) {
      if (result) throw new Error(`Taxonomy family ${family.id} has no detector but a scored detector family exists (${result.family}).`);
      const provenance = family.sources?.length ? `Provider source: ${family.sources.join(', ')}.` : null;
      const reason = [family.note, provenance].filter(Boolean).join(' ');
      if (!reason) throw new Error(`Taxonomy family ${family.id} has no detector and no note or sources.`);
      return {
        provider: family.provider, family: family.id, familyName: family.name, status: family.supportStatus ?? 'unsupported',
        evidenceTier: null, evidenceBasis: 'none', qualificationProfile: null, providerSource: null, corroboratingScanners: [], twinCoverage: null,
        unresolvedCriticalItems: null, empiricalEvidence: null, policyQualification: null, fixtureProfile: null, profileCoverage: null, detectors: [], reason,
      };
    }
    if (!result) throw new Error(`Taxonomy family ${family.id} has detector(s) ${family.detectors.join(', ')} but the view holds no scored family for them.`);
    const e = result.evidence, contract = contractOf(result.family);
    return {
      provider: family.provider, family: family.id, familyName: family.name, status: result.status.value,
      evidenceTier: result.status.evidenceTier, evidenceBasis: result.status.evidenceBasis, qualificationProfile: result.status.qualificationProfile,
      providerSource: contract?.providerSource ?? null,
      corroboratingScanners: [...new Set((contract?.corroboration ?? []).map(c => c.tool))].sort(byteOrder),
      twinCoverage: { pairs: e.twinPairs, failures: e.twinFailures, unprobeable: result.contract?.unprobeable ?? null },
      unresolvedCriticalItems: {
        metamorphic: result.status.methodsNotRun.includes('metamorphic') ? null : e.metamorphicCriticalFailures,
        mutation: result.status.methodsNotRun.includes('mutation') ? null : e.mutationUnresolvedCritical,
        differential: result.status.methodsNotRun.includes('differential') ? null : e.differentialUnresolvedContractDisagreements,
      },
      empiricalEvidence: {
        observations: e.observationCount, subjects: e.observationSubjects, issuanceDates: e.observationIssuanceDates,
        corroborationReferences: e.corroborationReferences, corroborationOwners: e.corroborationOwners, corroborationClasses: e.corroborationClasses,
        contradictions: e.unresolvedContradictions, boundedContradictions: e.boundedContradictions, uncertainty: e.uncertainty,
        supportedContexts: e.supportedContexts, mode: e.empiricalMode, supportsBareValues: e.supportsBareValues,
      },
      policyQualification: e.policyQualification,
      fixtureProfile: {
        positiveCases: e.positiveCases, positiveAxes: e.positiveAxes, benignCases: e.benignCases, controlAxes: e.controlAxes,
        twinPairs: e.twinPairs, totalFixtures: e.totalFixtures, contextTwinPairs: e.contextTwinPairs, confusionAxes: e.confusionAxes,
      },
      detectors: [result.family],
      reason: result.status.reasons.length ? result.status.reasons.join(' | ') : null,
      profileCoverage: result.fixtureProfile,
    };
  }).sort((a, b) => byteOrder(a.family, b.family));
  const distribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 } as Record<SupportStatus, number>;
  for (const f of entries) distribution[f.status]++;
  const stableDistribution = { documented: 0, empirical: 0, 'policy-qualified': 0 } as Record<QualificationProfile, number>;
  for (const f of entries) if (f.status === 'stable' && f.qualificationProfile) stableDistribution[f.qualificationProfile]++;
  return { distribution, stableDistribution, families: entries };
}
