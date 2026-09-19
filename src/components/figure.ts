import { escapeHtml, formatCount, formatPercent } from './html';
import { interval, scaleMax } from './interval';
import { statusMark } from './status-mark';

/**
 * Figure: one number carrying four pieces of information.
 *   direction word (at most / at least) + the published bound, large
 *   + the observed fraction with n, bold + one line of definition.
 * A withheld rate shows the reason and the n it needs instead of a number.
 * The component formats what it is handed; it never derives a bound.
 */
export interface FigureRate { point: number; bound: number | null; n: number; direction: 'upper' | 'lower' | null }
export interface FigureWithheld { withheld: 'insufficient-evidence' | 'insufficient-coverage' | 'not-measured'; n: number; needed?: number; detail?: string }
export interface FigureInput {
  question: string;
  value: FigureRate | FigureWithheld;
  observed?: { count: number; of: number; noun: string };
  definition?: string;
  /** Set by the caller when n is small enough that the bound stays wide. */
  fewSamples?: boolean;
  /** Where the rows behind this number live. */
  href?: string;
  compact?: boolean;
  format?: (value: number) => string;
}

export const directionWord = (direction: FigureRate['direction']) => (direction === 'upper' ? 'at most' : direction === 'lower' ? 'at least' : '');
export const isWithheld = (value: FigureInput['value']): value is FigureWithheld => 'withheld' in value;

const WITHHELD_WORD: Record<FigureWithheld['withheld'], string> = { 'insufficient-evidence': 'Withheld', 'insufficient-coverage': 'Withheld', 'not-measured': 'Not measured' };
export function withheldReason(value: FigureWithheld): string {
  if (value.detail) return value.detail;
  if (value.withheld === 'not-measured') return 'No complete scanner run covers this group.';
  const noun = value.withheld === 'insufficient-coverage' ? 'authored twin coverage' : 'samples';
  return value.needed != null ? `Too few ${noun}: needs at least ${formatCount(value.needed)}, has ${formatCount(value.n)}.` : `Too few ${noun} to publish a rate (n = ${formatCount(value.n)}).`;
}

export function figure(input: FigureInput): string {
  const { question, value, observed, definition, fewSamples, href, compact } = input;
  const format = input.format ?? ((v: number) => formatPercent(v));
  const heading = compact ? '' : `<p class="q">${escapeHtml(question)}</p>`;
  let body: string;
  if (isWithheld(value)) {
    body = `<p class="held">${statusMark(value.withheld === 'not-measured' ? 'not-measured' : 'withheld', WITHHELD_WORD[value.withheld])}<span>${escapeHtml(withheldReason(value))}</span></p>`;
  } else {
    const shown = value.bound ?? value.point, word = value.bound == null ? '' : directionWord(value.direction);
    // A real space, not only a margin: a screen reader and a copied figure both read "at most 2.7%".
    const number = `${word ? `<small>${word}</small> ` : ''}${escapeHtml(format(shown))}`;
    body = `<p class="v">${href ? `<a href="${escapeHtml(href)}">${number}</a>` : number}</p>`;
    if (!compact && value.bound != null && value.direction) {
      const [lo, hi] = value.direction === 'upper' ? [value.point, value.bound] : [value.bound, value.point];
      body += interval({ lo, point: value.point, hi, max: value.direction === 'upper' ? scaleMax(hi) : 1, direction: value.direction });
    }
  }
  const counts = observed ? `<p class="obs"><b>${formatCount(observed.count)} of ${formatCount(observed.of)}</b> ${escapeHtml(observed.noun)}${fewSamples ? ` ${statusMark('withheld', 'Few samples')}` : ''}</p>` : '';
  const def = definition && !compact ? `<p class="def">${escapeHtml(definition)}</p>` : '';
  return `<div class="fig${compact ? ' compact' : ''}"${compact ? ` aria-label="${escapeHtml(question)}"` : ''}>${heading}${body}${counts}${def}</div>`;
}
