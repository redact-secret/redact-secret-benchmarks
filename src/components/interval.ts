import { formatPercent } from './html';

/**
 * Interval: a `line` axis, an `ink-muted` range, a vertical tick at the
 * published bound and a triangle at the observed value. No circles.
 * It draws the numbers it is given and computes none of them.
 */
export interface IntervalInput { lo: number; point: number; hi: number; max: number; direction: 'upper' | 'lower' }

const SCALES = [0.05, 0.1, 0.25, 0.5, 1];
/** Smallest round axis that holds the value, so a 2.7% bound is not drawn on a 100% axis. */
export const scaleMax = (value: number) => SCALES.find(max => value <= max) ?? 1;

export function interval({ lo, point, hi, max, direction }: IntervalInput): string {
  const at = (value: number) => `${(Math.max(0, Math.min(1, value / max)) * 100).toFixed(2)}%`;
  const bound = direction === 'upper' ? hi : lo;
  const label = `Observed ${formatPercent(point)}. Published bound: ${direction === 'upper' ? 'at most' : 'at least'} ${formatPercent(bound)}. Axis 0% to ${formatPercent(max, 0)}.`;
  return `<div class="iv" role="img" aria-label="${label}"><div class="axis"></div><div class="rng" style="left:${at(lo)};width:calc(${at(hi)} - ${at(lo)})"></div><div class="tick" style="left:${at(bound)}"></div><div class="tri" style="left:${at(point)}"></div></div><div class="iv-s" aria-hidden="true"><span>0%</span><span>${formatPercent(max, 0)}</span></div>`;
}
