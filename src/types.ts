export interface Row {
  id: string;
  path: string;
  group: string;
  expected: { start: number; end: number }[];
  actual: { start: number; end: number }[];
  contained: number;
  broader: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}
export interface Scanner {
  id: string;
  name: string;
  mode: string;
  version: string | null;
  status: "complete" | "unavailable" | "error";
  message?: string;
  durationMs?: number;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  contained?: number;
  broader?: number;
  tp?: number;
  fp?: number;
  fn?: number;
  tn?: number;
  rows?: Row[];
}
export interface Report {
  schemaVersion: number;
  category: string;
  generatedAt: string;
  reviewStatus: string;
  scope?: string;
  references?: string[];
  milestoneReview?: {
    milestone: number;
    targetRelease: string;
    reviewedAt: string;
    sourceRevision: string;
    validation: string;
    outOfScopeIssues: { issue: number; reason: string }[];
    unverifiedSurfaces: string[];
  };
  corpusHash: string;
  lockHash: string;
  revision: string;
  dirty: boolean | null;
  runtime: { node: string; platform: string; arch: string };
  fixtureCount: number;
  expectedCount: number;
  matching: string;
  scanners: Scanner[];
}
export const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
