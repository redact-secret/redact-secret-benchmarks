import data from './taxonomy.json';

/** Provider x credential-family taxonomy (issue #502). See docs/specs/taxonomy.md. */
export interface Provider { id: string; name: string }
export interface Family {
  id: string; provider: string | null; name: string; description: string;
  detectors: string[]; sources?: string[]; note?: string;
}
export interface Taxonomy { schemaVersion: 1; sourceNote: string; providers: Provider[]; families: Family[] }

export const taxonomy = data as Taxonomy;

/** Every family a detector serves. Empty for an id absent from the taxonomy. */
export function familiesForDetector(detectorId: string): Family[] {
  return taxonomy.families.filter(f => f.detectors.includes(detectorId));
}

/** Families with no detector: representable-but-undetected, the A8 `unsupported` candidates. */
export function undetectedFamilies(): Family[] {
  return taxonomy.families.filter(f => f.detectors.length === 0);
}

export function familyById(id: string): Family | undefined {
  return taxonomy.families.find(f => f.id === id);
}

export function familiesForProvider(providerId: string): Family[] {
  return taxonomy.families.filter(f => f.provider === providerId);
}
