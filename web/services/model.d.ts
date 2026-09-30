// The existing site's pure catalog and report validators (src/model.mjs) are plain JavaScript.
// Typed here, at the boundary, so services import them without `allowJs`.
declare module '*/src/model.mjs' {
  export function buildCatalog(categories: unknown[], corpora: Record<string, unknown>, assignments: Record<string, string[]>, detectors: { id: string }[]): unknown[];
  export function reportProblem(report: unknown, category: string, hash: string, fixtures: unknown[]): string | null;
}
