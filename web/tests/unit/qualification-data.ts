/**
 * A synthetic qualification view for the service, resolver and block tests. Its populations, families and counts are made up;
 * only the identities the service checks against the checkout (the pinned evidence, the engine version, the digests of the
 * policy files) are read from the repository at run time and copied in, so the test never asserts a ledger value.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonical, sha256Digest } from '../../../benchmarks/qualification/canonical';
import type { FamilyView, PopulationSlice, QualificationView, ScannerCounts } from '../../services/qualification';
import { REAL_ROOT } from './overlay';

const real = (file: string) => JSON.parse(readFileSync(path.join(REAL_ROOT, file), 'utf8'));
const OUTCOMES = { EXACT: 0, COVERED: 0, OVERBROAD: 0, PARTIAL: 0, MISS: 0 };
const positive = (over: Partial<ScannerCounts['positives']['must-redact']> = {}) => ({ cases: 0, spans: 0, outcomes: { ...OUTCOMES }, leakedSpans: 0, leakedBytes: 0, collateralBytes: 0, ...over });

export const counts = (over: Partial<ScannerCounts> = {}): ScannerCounts => ({
  cases: 0, pending: 0, notMeasured: 0,
  positives: { 'must-redact': positive(), policy: positive() },
  benign: { cases: 0, flagged: 0, findings: 0 },
  twins: { pairs: 0, discriminated: 0, flagged: 0, coDetected: 0 },
  ...over,
});

/** A slice with one scanner per id; `over` shapes the counts of the first. */
export const slice = (population: string, role: string, scanners: string[], over: Partial<ScannerCounts> = {}): PopulationSlice => ({
  population, role, scanners: scanners.map((scanner, i) => ({ scanner, counts: counts(i === 0 ? over : {}) })),
});

export interface SyntheticOptions {
  statuses?: Record<string, 'stable' | 'provisional' | 'pending' | 'unsupported'>;
  methodsNotRun?: string[];
  scannerBuild?: 'released' | 'candidate';
}

export function syntheticView(options: SyntheticOptions = {}): QualificationView {
  const registry = real('benchmarks/official-runs.json');
  const scanners = ['alpha-lib', 'redact-secret'];
  const roles: Record<string, string> = Object.fromEntries(registry.populations.map((p: { id: string }, i: number) => [p.id, ['floors-and-gates', 'gates', 'policy-route'][i % 3]]));
  const family = (id: string, status: FamilyView['status']['value'], extra: Partial<FamilyView> = {}): FamilyView => ({
    family: id,
    taxonomyFamilies: [{ id: `${id}:key`, name: 'Key', provider: `${id}-provider` }],
    contract: { tier: 'T1', providerSource: true, supportedContext: [], unprobeable: null },
    status: { value: status, reasons: status === 'stable' ? [] : ['methods.notRun: a method did not run — held below stable'], qualificationProfile: status === 'stable' ? 'documented' : null, evidenceTier: 'T1', evidenceBasis: 'provider-documented', methodsNotRun: status === 'stable' ? [] : (options.methodsNotRun ?? ['mutation']) },
    evidence: { totalFixtures: 12, positiveCases: 6, positiveAxes: 3, benignCases: 4, benignAxes: 2, twinPairs: 2, metamorphicCriticalFailures: 0, mutationUnresolvedCritical: 0, differentialUnresolvedContractDisagreements: 0 },
    fixtureProfile: { claimed: 'documented', cellsMet: ['documented'], debt: [] },
    gates: Object.keys(roles).filter(p => roles[p] !== 'policy-route').map(population => ({ population, twinPairs: 2, twinFailures: 0, benignCases: 4, benignFalseAlarms: 0 })),
    populations: Object.keys(roles).map(population => slice(population, roles[population], scanners, population === Object.keys(roles)[0]
      ? { cases: 12, positives: { 'must-redact': positive({ cases: 6, spans: 6, outcomes: { ...OUTCOMES, EXACT: 5, MISS: 1 }, leakedSpans: 1, leakedBytes: 10 }), policy: positive() }, benign: { cases: 4, flagged: 1, findings: 1 }, twins: { pairs: 2, discriminated: 2, flagged: 0, coDetected: 0 }, pending: 1 }
      : {})),
    ...extra,
  });
  const families = [family('family-a', options.statuses?.['family-a'] ?? 'stable'), family('family-b', options.statuses?.['family-b'] ?? 'provisional'), family('family-c', options.statuses?.['family-c'] ?? 'pending', { populations: [], gates: [] })];
  const distribution: Record<string, number> = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  for (const f of families) distribution[f.status.value]++;
  const components = ['benchmarks/support/status-criteria.json', 'benchmarks/support/population-policy.json'].map(file => ({ path: file, digest: sha256Digest(canonical(real(file))) }));
  return {
    schema: 'redact-secret/qualification-view/v1',
    adapter: { id: 'credential-eval-run-artifact', version: 1 },
    publication: 'public',
    policy: { revision: `rs-policy-1:sha256:${'0'.repeat(64)}`, components, methodsRequired: ['metamorphic', 'mutation', 'differential'], populations: roles },
    populations: registry.populations.map((p: any) => ({
      population: p.id, role: roles[p.id], denominator: p.id, runClass: 'public',
      artifact: {
        artifactDigest: `sha256:${'a'.repeat(64)}`, semanticDigest: `sha256:${'b'.repeat(64)}`, configHash: `sha256:${'c'.repeat(64)}`, protocolVersion: registry.engine.protocol,
        engine: { name: 'synthetic-engine', version: registry.engine.version }, methods: [], caseCount: 12,
        evidence: { source: p.evidence.source, revision: p.evidence.revision, evidence_schema: p.evidence.evidenceSchema, corpus_digest: p.evidence.corpusDigest, release: { tag: p.evidence.release.tag, manifest_digest: p.evidence.release.manifestDigest } },
        scanners: scanners.map(id => ({ id, version: '1.0.0', mode: 'Synthetic mode', build: options.scannerBuild ?? 'released', configurationHash: `sha256:${'d'.repeat(64)}`, status: 'complete' })),
      },
    })),
    scanners,
    distribution,
    stableDistribution: { documented: distribution.stable, empirical: 0, 'policy-qualified': 0 },
    families,
    undetected: [{ id: 'orphan:key', name: 'Key', provider: 'orphan', supportStatus: null }],
    knownGaps: [{ id: 'gap-1', number: 7, status: 'open', kind: 'false-positive', fixtures: [{ fixture: 'suite--one', matches: [{ population: Object.keys(roles)[1], flagged: false, measurement: 'control', outcomes: null }] }, { fixture: 'suite--two', matches: [] }] }],
    unmappedFamilies: [],
  };
}
