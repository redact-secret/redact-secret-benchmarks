import type { ProviderSource, SupportMatrixEntry } from './matrix.ts';
import type { SupportMatrixFile } from '../../src/support-model.ts';

/**
 * Support-matrix drift (issue #511, A10). Compares a freshly generated
 * candidate matrix against a previously saved baseline matrix, family by
 * family, and reports only what a product release gate needs: a family that
 * left `stable`, a family that reached it (with the evidence that earned it),
 * a family the baseline has no status for at all, and a family whose status
 * held steady while the provider evidence under it moved. It never decides
 * whether any of that blocks a release — see the boundary rule in AGENTS.md.
 */

interface FamilyIdentity { provider: string | null; family: string; familyName: string }

export interface RegressedFamily extends FamilyIdentity {
  baselineStatus: SupportMatrixEntry['status'];
  candidateStatus: SupportMatrixEntry['status'];
  reason: string;
}

export interface ImprovedFamily extends FamilyIdentity {
  baselineStatus: SupportMatrixEntry['status'];
  candidateStatus: 'stable';
  evidence: {
    evidenceTier: SupportMatrixEntry['evidenceTier'];
    providerSource: ProviderSource | null;
    corroboratingScanners: string[];
    twinCoverage: SupportMatrixEntry['twinCoverage'];
    unresolvedCriticalItems: SupportMatrixEntry['unresolvedCriticalItems'];
    detectors: string[];
  };
}

/** Present in the candidate with no baseline entry to compare against — never "status: null". */
export interface UnclassifiedFamily extends FamilyIdentity {
  status: SupportMatrixEntry['status'];
}

export interface StaleProvenanceFamily extends FamilyIdentity {
  baselineStatus: SupportMatrixEntry['status'];
  candidateStatus: SupportMatrixEntry['status'];
  baselineProviderSource: ProviderSource | null;
  candidateProviderSource: ProviderSource | null;
}

export interface SupportMatrixDrift {
  summary: { regressions: number; improvements: number; newAndUnclassified: number; staleProviderProvenance: number };
  regressions: RegressedFamily[];
  improvements: ImprovedFamily[];
  newAndUnclassified: UnclassifiedFamily[];
  staleProviderProvenance: StaleProvenanceFamily[];
}

const sameProviderSource = (a: ProviderSource | null, b: ProviderSource | null): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Walks every family the candidate carries (by construction, every current
 * taxonomy family — `buildSupportMatrix` never omits one). A family absent
 * from the baseline is reported once, as unclassified, never guessed into a
 * regression or improvement. A family the baseline no longer has a status
 * for because a taxonomy family was retired is out of scope: it cannot be
 * reached by iterating the candidate.
 */
export function buildSupportMatrixDrift(baseline: SupportMatrixFile, candidate: SupportMatrixFile): SupportMatrixDrift {
  const baselineByFamily = new Map(baseline.families.map(entry => [entry.family, entry]));
  const regressions: RegressedFamily[] = [];
  const improvements: ImprovedFamily[] = [];
  const newAndUnclassified: UnclassifiedFamily[] = [];
  const staleProviderProvenance: StaleProvenanceFamily[] = [];

  for (const candidateEntry of candidate.families) {
    const identity: FamilyIdentity = { provider: candidateEntry.provider, family: candidateEntry.family, familyName: candidateEntry.familyName };
    const baselineEntry = baselineByFamily.get(candidateEntry.family);

    if (!baselineEntry) {
      newAndUnclassified.push({ ...identity, status: candidateEntry.status });
      continue;
    }
    if (baselineEntry.status === 'stable' && candidateEntry.status !== 'stable') {
      if (!candidateEntry.reason) throw new Error(`${candidateEntry.family} left stable with no reason recorded`);
      regressions.push({ ...identity, baselineStatus: baselineEntry.status, candidateStatus: candidateEntry.status, reason: candidateEntry.reason });
      continue;
    }
    if (candidateEntry.status === 'stable' && baselineEntry.status !== 'stable') {
      improvements.push({
        ...identity, baselineStatus: baselineEntry.status, candidateStatus: 'stable',
        evidence: {
          evidenceTier: candidateEntry.evidenceTier, providerSource: candidateEntry.providerSource,
          corroboratingScanners: candidateEntry.corroboratingScanners, twinCoverage: candidateEntry.twinCoverage,
          unresolvedCriticalItems: candidateEntry.unresolvedCriticalItems, detectors: candidateEntry.detectors,
        },
      });
      continue;
    }
    // Neither entering nor leaving `stable` (including no status change at all): the status
    // transition itself is not gate-worthy, but the evidence behind it moving quietly is.
    if (!sameProviderSource(baselineEntry.providerSource, candidateEntry.providerSource)) {
      staleProviderProvenance.push({
        ...identity, baselineStatus: baselineEntry.status, candidateStatus: candidateEntry.status,
        baselineProviderSource: baselineEntry.providerSource, candidateProviderSource: candidateEntry.providerSource,
      });
    }
  }

  return {
    summary: {
      regressions: regressions.length, improvements: improvements.length,
      newAndUnclassified: newAndUnclassified.length, staleProviderProvenance: staleProviderProvenance.length,
    },
    regressions, improvements, newAndUnclassified, staleProviderProvenance,
  };
}
