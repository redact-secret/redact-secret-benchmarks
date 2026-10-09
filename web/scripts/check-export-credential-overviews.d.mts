export interface CredentialCoverageExportSource {
  taxonomy: { families: { id: string }[] };
  fixtures: { familyIds?: string[] }[];
  scope: { boundTo: { release: string; mode: string }; outOfScope: { text: string }[] };
  scoredCount: number | null;
  authority: string;
  product?: { version: string | null; mode: string };
  view?: { families: { family: string; taxonomyFamilies: { id: string }[]; status: { value: string; qualificationProfile: string | null } }[] };
}

export function credentialCoverageExportProblems(html: string, source: CredentialCoverageExportSource): string[];
export function credentialMethodologyExportProblems(html: string, authority: string): string[];
