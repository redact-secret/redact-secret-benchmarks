import type { PiiEvidenceComparison } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
export interface EvidencePublicationSource { path: string; sha256: string }
export interface EvidencePublicationView { schema: 'pii-evidence-publication-view/v1'; sources: EvidencePublicationSource[]; comparison: PiiEvidenceComparison }
export interface EvidencePublicationIndex {
  schema: 'pii-evidence-publication-index/v1'; state: PiiEvidenceComparison['state']; publicOnly: true; supportClaims: false; qualified: false;
  populationScope: 'pii-evidence-derived-only'; pooledWithBenchmarkPopulations: false;
  view: { path: string; sha256: string }; sources: EvidencePublicationSource[];
}
export const PII_EVIDENCE_DIRECTORY: string;
export const PII_EVIDENCE_INDEX: string;
export const PII_EVIDENCE_VIEW: string;
export function piiEvidencePublication(root: string): Promise<{ index: EvidencePublicationIndex; view: EvidencePublicationView; viewText: string }>;
export function writePiiEvidencePublication(root: string): ReturnType<typeof piiEvidencePublication>;
export function piiEvidencePublicationProblems(root: string): Promise<string[]>;
