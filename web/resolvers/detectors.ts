/**
 * The detector list and one detector's page (#559): how many fixtures exercise each
 * detector against the minimum sample size, and, for one detector, what the run
 * accounted for each group of its fixtures with the other scanners' figure for the
 * same cell. Pure.
 *
 * Detector assignments overlap (a fixture can exercise several detectors), so counts
 * are never summed across detectors. The figures are the run summary's own
 * (`summary.byDetector`, accounted once at bench time): bounds and rates are read and
 * formatted here, never derived. A withheld figure shows its reason verbatim; a
 * missing one is "Not measured".
 */
import type { Catalog, CatalogFixture } from '../services/catalog';
import type { DetectorContract } from '../services/contracts';
import type { MeasuredRun } from '../services/run';
import type { DetectorGroupRowData, DetectorRowData, StatusLabel } from '../components/report/types';
import { KIND_TITLE, TIER_TITLE } from './families';
import { int, percent } from './format';

interface Rate { point: number; bound: number | null; n: number; direction: 'upper' | 'lower' | null }
type Published = Rate | string | null | undefined;
interface RedactGroup { files: number; spans: number; leakedSpans: number; leakedSpanRate: Published; outcomes: Record<'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS', number>; twins: { pairs: number; discriminated: number; rate: Published } }
interface ControlGroup { files: number; flaggedFiles: number; falseAlarmRate: Published }
const isRate = (value: Published): value is Rate => !!value && typeof value === 'object';
const isRedact = (g: unknown): g is RedactGroup => !!g && typeof g === 'object' && 'spans' in g;
const isControl = (g: unknown): g is ControlGroup => !!g && typeof g === 'object' && 'flaggedFiles' in g;

/** "at most 7.2%", or the reason a rate is withheld, verbatim. */
export function boundText(rate: Published): string {
  if (isRate(rate)) {
    const shown = rate.bound ?? rate.point;
    return `${rate.direction === 'upper' ? 'at most ' : rate.direction === 'lower' ? 'at least ' : ''}${percent(shown)}`;
  }
  return typeof rate === 'string' ? rate : 'Not measured';
}

export const detectorHref = (id: string): string => `/report/detectors/${id}/`;

const pending = (key: string): boolean => key === 'pending/T0';
const groupTitle = (key: string): string => (pending(key) ? 'Pending review' : `${KIND_TITLE[key.split('/')[0]] ?? key.split('/')[0]} · ${TIER_TITLE[key.split('/')[1]] ?? key.split('/')[1]}`);

const status = (s: StatusLabel['status'], label: string): StatusLabel => ({ status: s, label });

/** Detectors by fixture count, largest first, with the minimum sample size beside each. */
export function resolveDetectorList(catalog: Catalog, minimum: number): DetectorRowData[] {
  const counted = catalog.detectors.map(d => ({ d, n: catalog.fixturesByDetector.get(d.id)?.length ?? 0 }))
    .sort((a, b) => b.n - a.n || a.d.title.localeCompare(b.d.title));
  const max = Math.max(minimum, ...counted.map(c => c.n));
  return counted.map(({ d, n }) => ({
    id: d.id, title: d.title, href: detectorHref(d.id), fixtures: int(n), value: n, max, minimum,
    ...(n < minimum ? { flag: status('withheld', 'Below minimum') } : n === minimum ? { flag: status('withheld', 'At minimum') } : {}),
  }));
}

export interface DetectorDetail {
  id: string;
  title: string;
  fixtureCount: number;
  belowMinimum: StatusLabel | undefined;
  suites: { id: string; title: string; href: string }[];
  tier: string | undefined;
  tierTitle: string | undefined;
  sources: { href: string; label: string; note?: string }[];
  review: string | undefined;
  unprobeable: { reason: string; observedAt: string } | undefined;
  /** One row per group of the detector's fixtures; empty without a usable run. */
  groups: DetectorGroupRowData[];
  fixtures: CatalogFixture[];
}

const cell = (groups: Record<string, unknown> | undefined, key: string): unknown => groups?.[key];

export function resolveDetector(catalog: Catalog, id: string, run: MeasuredRun | undefined, contract: DetectorContract | undefined, minimum: number): DetectorDetail | undefined {
  const detector = catalog.detectors.find(d => d.id === id);
  if (!detector) return undefined;
  const fixtures = catalog.fixturesByDetector.get(id) ?? [];
  const suiteIds = [...new Set(fixtures.map(f => f.category))];
  const byScanner = (run?.summary.byDetector as Record<string, Record<string, Record<string, unknown>>> | undefined)?.[id];
  const mine = byScanner?.['redact-secret'];
  const others = (run?.scanners ?? []).filter(s => s.id !== 'redact-secret');

  const groups: DetectorGroupRowData[] = !mine ? [] : Object.keys(mine)
    .sort((a, b) => (pending(a) ? 1 : pending(b) ? -1 : a.localeCompare(b)))
    .map((key): DetectorGroupRowData => {
      const g = mine[key];
      const title = groupTitle(key);
      const files = isRedact(g) || isControl(g) ? int(g.files) : int((g as { files?: number }).files ?? 0);
      if (pending(key)) return { group: title, fixtures: files, headline: { label: 'Unscored', value: 'Not scored', note: 'Inspect only: never scored until evidence exists' }, others: [] };
      const peers = others.map(s => {
        const value = cell(byScanner?.[s.id], key);
        return { scanner: s.name, value: isRedact(value) ? boundText(value.leakedSpanRate) : isControl(value) ? boundText(value.falseAlarmRate) : 'Not measured' };
      });
      if (isControl(g)) {
        return {
          group: title, fixtures: files,
          headline: { label: 'False alarms', value: boundText(g.falseAlarmRate), note: `${int(g.flaggedFiles)} of ${int(g.files)} controls flagged` },
          outcomes: {
            segments: [{ kind: 'fill', weight: g.files - g.flaggedFiles }, { kind: 'outline', weight: g.flaggedFiles }],
            label: `${int(g.files - g.flaggedFiles)} quiet, ${int(g.flaggedFiles)} flagged`,
            text: `${int(g.files - g.flaggedFiles)} quiet · ${int(g.flaggedFiles)} flagged`,
          },
          others: peers,
        };
      }
      if (isRedact(g)) {
        const o = g.outcomes;
        const redacted = o.EXACT + o.COVERED;
        return {
          group: title, fixtures: files,
          headline: { label: 'Secret spans left readable', value: boundText(g.leakedSpanRate), note: `${int(g.leakedSpans)} of ${int(g.spans)} spans` },
          ...(g.twins.pairs > 0 ? { secondary: { label: 'Near-twins told apart', value: boundText(g.twins.rate), note: `${int(g.twins.discriminated)} of ${int(g.twins.pairs)} pairs` } } : {}),
          outcomes: {
            segments: [{ kind: 'fill', weight: redacted }, { kind: 'wide', weight: o.OVERBROAD }, { kind: 'hatch', weight: o.PARTIAL }, { kind: 'outline', weight: o.MISS }],
            label: `${int(redacted)} redacted, ${int(o.OVERBROAD)} too much, ${int(o.PARTIAL)} partly exposed, ${int(o.MISS)} missed`,
            text: `${int(redacted)} redacted · ${int(o.OVERBROAD)} too much · ${int(o.PARTIAL)} partly exposed · ${int(o.MISS)} missed`,
          },
          others: peers,
        };
      }
      return { group: title, fixtures: files, headline: { label: 'Figure', value: 'Not measured' }, others: [] };
    });

  return {
    id, title: detector.title, fixtureCount: fixtures.length,
    belowMinimum: fixtures.length < minimum ? status('withheld', 'Below minimum') : fixtures.length === minimum ? status('withheld', 'At minimum') : undefined,
    suites: suiteIds.map(s => ({ id: s, title: catalog.suites.find(x => x.id === s)?.title ?? s, href: `/report/corpus/${s}/` })),
    tier: contract?.tier, tierTitle: contract?.tier ? TIER_TITLE[contract.tier] : undefined,
    sources: contract?.sources ?? [], review: contract?.review ?? contract?.companion, unprobeable: contract?.unprobeable,
    groups, fixtures,
  };
}
