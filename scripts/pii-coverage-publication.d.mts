export interface CoverageIdentity {
  snapshotId: string; snapshotCommitment: string; productCommitment: string | null;
  mappingRevision: number; mappingCommitment: string; protocol: string; population: string;
  visibility: string; role: string; bindingCommitment: string | null;
}
export interface CoverageRow {
  kindKey: string; label: string; domains: string[]; jurisdictions: string[]; state: string; reasons: string[];
  evidence: { availability: string; authoredCases: number; acceptedCases: number; importedCases: number | null; fixtures: number; variants: number | null; occurrences: number | null };
  capability: { state: string; source: string | null; productCommitment: string | null };
  mapping: { state: string; losses: string[]; requiredAxes: string[]; representableAxes: string[] };
  observation: { status: string; source: string | null; identity: CoverageIdentity | null; axes: { axis: string; eligible: number; measured: number; satisfied: number; missed: number; unresolved: number; withheld: number }[] };
  applicability: { state: string; source: string | null };
}
export interface CoverageInventory {
  rows: { kindKey: string; source: { repository: string; commit: string }; research: { openQuestions: string[] }; emptyReasons: string[]; mapping: { families: string[]; reason: string } }[];
  source: { release: { repository: string; commit: string }; snapshot: { id: string; contentDigest: string; manifestSha256: string } };
  totals: Record<string, number | null>; losses: Record<string, number>; limitations: string[];
}
export interface CoverageJoined {
  matrix: { schemaVersion: number; identity: CoverageIdentity; rows: CoverageRow[] };
  summary: { discoveredKinds: number; states: Record<string, number>; capability: Record<string, number>; mapping: Record<string, number>; acceptedMeasurableKinds: number; domainSlices: Record<string, number>; jurisdictionSlices: Record<string, number>; losses: Record<string, number> };
  binding: Record<string, unknown> | null;
  outcomes: { kindKey: string; outcomes: { caseId: string; variantId: string; family: string; outcome: { typeIdentity: string; range: string; sensitivityContext: string; action: { state: string } } }[] }[];
  familyMetrics: { state: string; reason: string };
  capabilityDeclarations: { state: string; reason: string | null };
}
export interface CoverageDelta {
  mode: string; previous: { identity: CoverageIdentity }; next: { identity: CoverageIdentity };
  totals: { kinds: { previous: number; next: number; delta: number }; counts: Record<string, { previous: number | null; next: number | null; delta: number | null }> };
  attribution: { productRegressionComparison: { reason: string } };
  rows: { previousKindKey: string | null; nextKindKey: string | null; classification: string; domains: { added: string[]; removed: string[] }; jurisdictions: { added: string[]; removed: string[] }; counts: Record<string, { previous: number | null; next: number | null; delta: number | null }>; mapping: { state: { previous: string | null; next: string | null } }; capability: { previous: string | null; next: string | null }; measurement: { previous: string | null; next: string | null } }[];
}
export interface PiiCoveragePublication {
  schema: string; sources: { path: string; sha256: string }[]; supportClaims: false; qualified: false;
  coverage: { inventories: Record<'active' | 'proposed', CoverageInventory>; matrices: Record<'active' | 'proposed', Record<'baseline' | 'candidate', CoverageJoined>> };
  deltas: Record<'baseline' | 'candidate', CoverageDelta>;
}
export const PII_COVERAGE_VIEW: string;
export function piiCoveragePublication(root: string): Promise<PiiCoveragePublication>;
export function writePiiCoveragePublication(root: string): Promise<PiiCoveragePublication>;
export function piiCoveragePublicationProblems(root: string): Promise<string[]>;
export function validatePiiCoverageMembership(coverage: PiiCoveragePublication['coverage']): PiiCoveragePublication['coverage'];
