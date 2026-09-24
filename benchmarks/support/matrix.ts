import type { Tier } from '../types.ts';
import type { SupportStatus } from './status.ts';
import { taxonomy, type Family } from './taxonomy.ts';
import { contracts } from '../lib/assessment.ts';

/**
 * Support matrix (issue #509, A8). Projects A3's per-detector evidence
 * (`results-output/support-status.json`, #504) onto the provider x
 * credential-family taxonomy (#502) — A8's display unit, per docs/specs/taxonomy.md.
 * Never re-derives a status: every entry's `status`/`reason` is carried
 * through verbatim from A3's classification, broadcast across every taxonomy
 * family the deciding detector serves. See docs/specs/support-matrix.md.
 */

/** Only the fields of one `support-status.json` family result this module reads. */
export interface SupportStatusFamilyResult {
  family: string;
  status: SupportStatus;
  reasons: string[];
  taxonomyFamilies: string[];
  evidence: {
    twinPairs: number;
    twinFailures: number;
    metamorphicCriticalFailures: number;
    mutationUnresolvedCritical: number;
    differentialUnresolvedContractDisagreements: number;
  };
  unprobeable: { reason: string; observedAt: string } | null;
}

export interface SupportStatusReport {
  schemaVersion: 1;
  generatedAt: string;
  runId: string;
  revision: string;
  dirty: boolean | null;
  criteriaSchemaVersion: 1;
  /** Set only on a candidate run (eval:classify --candidate-*): the redact-secret build measured instead of the published package. */
  product?: SupportProduct | null;
  families: SupportStatusFamilyResult[];
}

export interface SupportProduct { sourceCommit: string; packageName: string; declaredVersion: string; artifacts: { role: string; sha256: string }[] }

export interface ProviderSource { url: string; observedAt: string; formatVersion: string; covers: string }

export interface SupportMatrixEntry {
  provider: string | null;
  family: string;
  familyName: string;
  status: SupportStatus;
  /** Null only when no detector exists for the family — there is no contract to carry a tier. */
  evidenceTier: Tier | null;
  /** T1 only; never present on a lower tier (enforced upstream by `validateContracts`). */
  providerSource: ProviderSource | null;
  corroboratingScanners: string[];
  twinCoverage: { pairs: number; failures: number; unprobeable: { reason: string; observedAt: string } | null } | null;
  unresolvedCriticalItems: { metamorphic: number; mutation: number; differential: number } | null;
  /** Registered detector(s) whose evidence decided this entry; empty when no detector exists. */
  detectors: string[];
  /** Required (non-null) whenever `status` is `pending` or `unsupported`. */
  reason: string | null;
}

export interface SupportMatrix {
  distribution: Record<SupportStatus, number>;
  families: SupportMatrixEntry[];
}

function undetectedEntry(family: Family): SupportMatrixEntry {
  const provenance = family.sources?.length ? `Provider source: ${family.sources.join(', ')}.` : null;
  const reason = [family.note, provenance].filter(Boolean).join(' ');
  if (!reason) throw new Error(`Taxonomy family ${family.id} has no detector and no note or sources — refusing to default it to a friendly status.`);
  return {
    provider: family.provider, family: family.id, familyName: family.name, status: 'unsupported',
    evidenceTier: null, providerSource: null, corroboratingScanners: [], twinCoverage: null,
    unresolvedCriticalItems: null, detectors: [], reason,
  };
}

function detectedEntry(family: Family, result: SupportStatusFamilyResult): SupportMatrixEntry {
  const contract = contracts[result.family];
  if (!contract) throw new Error(`No format contract registered for detector "${result.family}", claimed by taxonomy family ${family.id}.`);
  if ((result.status === 'pending' || result.status === 'unsupported') && !result.reasons.length)
    throw new Error(`${family.id}: status "${result.status}" carries no reason.`);
  return {
    provider: family.provider, family: family.id, familyName: family.name, status: result.status,
    evidenceTier: contract.tier, providerSource: contract.providerSource ?? null,
    corroboratingScanners: [...new Set((contract.corroboration ?? []).map(c => c.tool))].sort(),
    twinCoverage: { pairs: result.evidence.twinPairs, failures: result.evidence.twinFailures, unprobeable: contract.unprobeable ?? null },
    unresolvedCriticalItems: {
      metamorphic: result.evidence.metamorphicCriticalFailures,
      mutation: result.evidence.mutationUnresolvedCritical,
      differential: result.evidence.differentialUnresolvedContractDisagreements,
    },
    detectors: [result.family],
    reason: result.reasons.length ? result.reasons.join(' | ') : null,
  };
}

/**
 * Every taxonomy family gets exactly one entry. A family this cannot classify
 * — a detector-bearing family missing from `statusReport`, one claimed by two
 * different detector results, or a zero-detector family with no recorded
 * reason — throws rather than defaulting to a friendly status (#509).
 */
export function buildSupportMatrix(statusReport: SupportStatusReport): SupportMatrix {
  const byTaxonomyFamily = new Map<string, SupportStatusFamilyResult>();
  for (const result of statusReport.families) {
    for (const familyId of result.taxonomyFamilies) {
      const existing = byTaxonomyFamily.get(familyId);
      if (existing) throw new Error(`Taxonomy family ${familyId} is claimed by more than one detector result (${existing.family} and ${result.family}).`);
      byTaxonomyFamily.set(familyId, result);
    }
  }
  const families = taxonomy.families.map(family => {
    const result = byTaxonomyFamily.get(family.id) ?? null;
    if (family.detectors.length === 0) {
      if (result) throw new Error(`Taxonomy family ${family.id} has no detector but an evidence-derived result exists (${result.family}).`);
      return undetectedEntry(family);
    }
    if (!result) throw new Error(`Taxonomy family ${family.id} has detector(s) ${family.detectors.join(', ')} but no evidence-derived result was found — is results-output/support-status.json stale relative to the taxonomy?`);
    return detectedEntry(family, result);
  }).sort((a, b) => a.family.localeCompare(b.family));
  const distribution = families.reduce((d, f) => { d[f.status] = (d[f.status] ?? 0) + 1; return d; },
    { stable: 0, provisional: 0, pending: 0, unsupported: 0 } as Record<SupportStatus, number>);
  return { distribution, families };
}
