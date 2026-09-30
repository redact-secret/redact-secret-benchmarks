// The existing site's pure catalog and report validators (src/model.mjs) are plain JavaScript.
// Typed here, at the boundary, so services import them without `allowJs`.
declare module '*/src/model.mjs' {
  export function buildCatalog(categories: unknown[], corpora: Record<string, unknown>, assignments: Record<string, string[]>, detectors: { id: string }[]): unknown[];
  export function reportProblem(report: unknown, category: string, hash: string, fixtures: unknown[]): string | null;
}

// The peer adapters' family mapping (scanners/families.mjs), imported by benchmarks/lib/assessment.ts,
// which services/contracts.ts reads for each detector's format evidence.
declare module '*/scanners/families.mjs' {
  export const familyMappingVersion: number;
  export const arrivalFindingTypes: Readonly<Record<string, Readonly<Record<string, string>>>>;
  export const scoredArrivalFamilies: readonly string[];
  export function findingFamily(scanner: string, label: string, findingType?: string): { family?: string };
}
