import { figure, statusMark, escapeHtml as e, formatPercent, type FigureInput, type FigureRate, type FigureWithheld } from '../components';
import type { ControlGroup, Group, Published, RedactGroup } from '../types';

/**
 * Published group values -> Figure inputs. Everything here is a lookup or a
 * comparison of numbers the report already states; no rate, bound or interval
 * is derived on this side of the JSON.
 */
export interface Floors { minDenominator: number; intervalZ?: number; measurableShareFloor: Record<string, number>; twinCoverageFloor: Record<string, number> }
/** Below this n a published bound stays wide enough that the figure says so beside its counts. Display rule only. */
export const FEW_SAMPLES_BELOW = 30;
const floorOf = (floor: Record<string, number>, kind: string) => floor[kind] ?? floor.default;
const isRate = (value: unknown): value is FigureRate => Boolean(value) && typeof value === 'object';
export const isRedact = (group: Group | undefined): group is RedactGroup => Boolean(group && 'spans' in group);
export const isControl = (group: Group | undefined): group is ControlGroup => Boolean(group && 'flaggedFiles' in group);
export const NOT_MEASURED: FigureWithheld = { withheld: 'not-measured', n: 0 };
export const confidence = (floors: Floors) => (floors.intervalZ === 1.96 ? '95% pessimistic bound' : `Pessimistic bound at z = ${floors.intervalZ ?? '—'}`);

function withheld(published: Published | 'insufficient-coverage', n: number, kind: string, group: RedactGroup | undefined, floors: Floors): FigureWithheld {
  if (published === 'insufficient-coverage') {
    const coverage = group?.twins.coverage;
    return { withheld: 'insufficient-coverage', n, detail: `Too few secrets have an authored near-twin: coverage ${isRate(coverage) ? coverage.point.toFixed(3) : '—'} is below the floor ${floorOf(floors.twinCoverageFloor, kind)}.` };
  }
  if (n < floors.minDenominator) return { withheld: 'insufficient-evidence', n, needed: floors.minDenominator };
  const share = group?.measurableShare;
  return { withheld: 'insufficient-evidence', n, detail: `Too much of this group is still pending review: measurable share ${isRate(share) ? share.point.toFixed(3) : '—'} is below the floor ${floorOf(floors.measurableShareFloor, kind)}.` };
}

export type Metric = 'leak' | 'alarm' | 'twins';
/** The Figure value and observed counts for one headline metric of one published group. */
export function metric(group: Group | undefined, which: Metric, key: string, floors: Floors): Pick<FigureInput, 'value' | 'observed' | 'fewSamples'> {
  const kind = key.split('/')[0];
  if (which === 'alarm') {
    if (!isControl(group)) return { value: NOT_MEASURED };
    const value = isRate(group.falseAlarmRate) ? group.falseAlarmRate : withheld(group.falseAlarmRate, group.files, kind, undefined, floors);
    return { value, observed: { count: group.flaggedFiles, of: group.files, noun: 'controls flagged' }, fewSamples: isRate(value) && group.files < FEW_SAMPLES_BELOW };
  }
  if (!isRedact(group)) return { value: NOT_MEASURED };
  if (which === 'leak') {
    const value = isRate(group.leakedSpanRate) ? group.leakedSpanRate : withheld(group.leakedSpanRate, group.spans, kind, group, floors);
    return { value, observed: { count: group.leakedSpans, of: group.spans, noun: 'secret spans leaked' }, fewSamples: isRate(value) && group.spans < FEW_SAMPLES_BELOW };
  }
  const { twins } = group;
  if (twins.rate == null) return { value: { withheld: 'not-measured', n: 0, detail: 'No near-twin pairs are authored in this group.' } };
  const value = isRate(twins.rate) ? twins.rate : withheld(twins.rate, twins.pairs, kind, group, floors);
  return { value, observed: { count: twins.discriminated, of: twins.pairs, noun: 'pairs discriminated' }, fewSamples: isRate(value) && twins.pairs < FEW_SAMPLES_BELOW };
}

/** One table cell: the bound with its direction, or the reason there is none. For the muted reference-scanner tables. */
export function boundCell(group: Group | undefined, which: Metric, key: string, floors: Floors): string {
  const { value } = metric(group, which, key, floors);
  if ('withheld' in value) return value.withheld === 'not-measured' ? statusMark('not-measured') : `<span title="${e(figureReason(value))}">${statusMark('withheld', 'Withheld')}</span>`;
  return value.bound == null ? e(formatPercent(value.point)) : e(formatPercent(value.bound));
}
const figureReason = (value: FigureWithheld) => value.detail ?? (value.needed != null ? `needs at least ${value.needed}, has ${value.n}` : `n = ${value.n}`);
export const compactFigure = (question: string, group: Group | undefined, which: Metric, key: string, floors: Floors) => figure({ question, compact: true, ...metric(group, which, key, floors) });
