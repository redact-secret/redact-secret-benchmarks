import type { PiiCoveragePublication, CoverageJoined, CoverageInventory } from '../../scripts/pii-coverage-publication.mjs';
import type { PiiCoverageMatrixData } from '../components/evaluation/domain';
import { int } from './format';

const value = (count: number | null) => count === null ? 'unavailable' : int(count);
const text = (object: unknown) => JSON.stringify(object);
const slug = (kind: string) => encodeURIComponent(kind).replace(/%/g, '-');

function panel(role: 'active' | 'proposed', side: 'baseline' | 'candidate', inventory: CoverageInventory, joined: CoverageJoined): PiiCoverageMatrixData['panels'][number] {
  const id = `coverage-${role}-${side}`, rows = joined.matrix.rows;
  const rowId = (kind: string) => `${id}-${slug(kind)}`;
  const summary = joined.summary;
  const source = inventory.source;
  const sourceRoot = `https://github.com/${source.release.repository}/blob/${source.release.commit}`;
  const summaries = [
    { id: 'discovered', label: 'Discovered kinds (full evidence denominator)', value: int(summary.discoveredKinds), rowIds: rows.map(row => rowId(row.kindKey)) },
    ...Object.entries(summary.states).map(([state, count]) => ({ id: `state-${state}`, label: state, value: int(count), rowIds: rows.filter(row => row.state === state).map(row => rowId(row.kindKey)) })),
    ...Object.entries(summary.capability).map(([state, count]) => ({ id: `capability-${state}`, label: `Capability ${state} (kinds)`, value: int(count), rowIds: rows.filter(row => row.capability.state === state).map(row => rowId(row.kindKey)) })),
    ...Object.entries(summary.mapping).map(([state, count]) => ({ id: `mapping-${state}`, label: `Evaluator ${state} (kinds)`, value: int(count), rowIds: rows.filter(row => row.mapping.state === state).map(row => rowId(row.kindKey)) })),
    { id: 'accepted-measurable', label: 'Kinds with accepted cases and representable axes', value: int(summary.acceptedMeasurableKinds), rowIds: rows.filter(row => row.evidence.acceptedCases > 0 && ['faithful', 'partial'].includes(row.mapping.state) && row.mapping.representableAxes.length > 0).map(row => rowId(row.kindKey)) },
  ];
  return { id, snapshot: source.snapshot.id,
    title: `${role === 'active' ? 'Active snapshot' : 'Proposed snapshot (inactive, unmeasured)'} · ${side === 'baseline' ? 'published baseline' : 'candidate build'}`,
    identity: text({ snapshot: source, measurement: joined.matrix.identity, binding: joined.binding }),
    note: `Source totals, unique source grains: ${Object.entries(inventory.totals).map(([grain, count]) => `${grain} ${value(count)}`).join('; ')}. Imported cases and source cases are separate grains. ${role === 'proposed' ? 'Proposal only; pins, authority and owner acceptance are unchanged. No active observation is reused.' : 'Family metric projections remain unavailable where the recorded protocol does not carry them.'}`,
    summaries,
    slices: [
      `PII/PHI kind memberships: ${text(summary.domainSlices)}. Jurisdiction kind memberships: ${text(summary.jurisdictionSlices)}.`,
      `Source-bound import losses (overlapping affected-record counts): ${text(inventory.losses)}.`,
      `Source contract limitations: ${inventory.limitations.join('; ')}.`,
    ],
    rows: rows.map(row => {
      const kind = inventory.rows.find(kind => kind.kindKey === row.kindKey)!;
      const observations = joined.outcomes.find(outcome => outcome.kindKey === row.kindKey)?.outcomes ?? [];
      const axisText = row.observation.axes.map(axis => `${axis.axis}: eligible ${int(axis.eligible)}; measured ${int(axis.measured)}; satisfied ${int(axis.satisfied)}; missed ${int(axis.missed)}; unresolved ${int(axis.unresolved)}; withheld ${int(axis.withheld)}`).join(' | ');
      return { id: rowId(row.kindKey), kind: row.kindKey, label: row.label, state: row.state,
        domain: `${row.domains.join(' / ')}; jurisdictions ${row.jurisdictions.join(', ') || 'not recorded'}`,
        counts: Object.entries(row.evidence).map(([grain, count]) => `${grain}: ${typeof count === 'string' ? count : value(count)}`).join('; '),
        capability: `${row.capability.state}; ${row.capability.source ?? joined.capabilityDeclarations.reason ?? 'no bound declaration'}; product binding ${row.capability.productCommitment ?? 'unavailable'}`,
        mapping: `${row.mapping.state}; evaluator families ${kind.mapping.families.join(', ') || 'unmapped'}; required axes ${row.mapping.requiredAxes.join(', ') || 'not recorded'}; representable axes ${row.mapping.representableAxes.join(', ') || 'unavailable'}; losses ${row.mapping.losses.join(', ') || 'no per-kind loss count available'}; ${kind.mapping.reason}`,
        observation: `${row.observation.status}; ${axisText || joined.familyMetrics.reason}. ${observations.length ? `${int(observations.length)} bound variant records remain inspectable in the existing paired measurement above and in the coverage source view; no family rate is inferred.` : 'No compatible kind observation is available.'}`,
        reasons: `${row.reasons.join('; ')}. Source empty reasons: ${kind.emptyReasons.join('; ') || 'none'}. Source research open questions: ${text(kind.research.openQuestions)}. Bound case/variant IDs and authored axes: ${text(observations)}.`,
        sources: [
          { label: 'Immutable source taxonomy', href: `${sourceRoot}/snapshots/${source.snapshot.id}/taxonomy/privacy-kinds.json` },
          { label: 'Immutable snapshot manifest', href: `${sourceRoot}/snapshots/${source.snapshot.id}/manifest.json` },
          { label: 'Bound coverage source and variant records', href: '/results/pii-coverage-view-v1.json' },
        ],
      };
    }),
  };
}

export function resolvePiiCoverageView(publication: PiiCoveragePublication): PiiCoverageMatrixData {
  const coverage = publication.coverage;
  const delta = publication.deltas.baseline;
  return { panels: (['active', 'proposed'] as const).flatMap(role => (['baseline', 'candidate'] as const).map(side => panel(role, side, coverage.inventories[role], coverage.matrices[role][side]))),
    delta: { title: 'Active vs proposed snapshot denominator, inactive and unmeasured',
      identity: `${text(delta.previous.identity)} → ${text(delta.next.identity)}`,
      notes: [`Unique kinds ${int(delta.totals.kinds.previous)} → ${int(delta.totals.kinds.next)}; delta ${int(delta.totals.kinds.delta)}.`,
        `Product regression comparison unavailable: ${delta.attribution.productRegressionComparison.reason}. Evidence scope, evaluator mapping and product identities are tracked separately; a changed denominator does not establish a product regression.`,
        'Source retrievability is digest-bound. Full reproduction is unavailable until the original snapshot archive can be retrieved and verified. This rendering never activates the proposal or supplies owner acceptance.'],
      changes: delta.rows.map(row => ({ id: row.nextKindKey ?? row.previousKindKey!, text: `${row.classification}: ${row.previousKindKey ?? 'absent'} → ${row.nextKindKey ?? 'absent'}; domains ${text(row.domains)}; jurisdictions ${text(row.jurisdictions)}; counts ${text(row.counts)}; mapping ${text(row.mapping.state)}; capability ${text(row.capability)}; observation ${text(row.measurement)}.` })),
    },
  };
}
