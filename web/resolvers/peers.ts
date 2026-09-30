/**
 * Which inputs a peer scanner's own rules target, and what it left readable on
 * them and everywhere else (#558). Pure: fixtures, the peer's rows and the set of
 * families its rules target in, counts out.
 *
 * An input is a fixture at the level whose expectation is a secret span: a
 * `must-redact` fixture at T1 or T2, a `policy` fixture at T3 (the same groups the
 * run summary accounts, `must-redact/T1`, `must-redact/T2`, `policy/T3`). It is
 * *targeted* when any family it is related to is a family one of the peer's rules
 * targets (`scanners/peer-rule-families.json`); a fixture related to several
 * families is targeted if any one is. *Left readable* is the run's own definition:
 * a span whose outcome is `PARTIAL` or `MISS`. Spans are counted as the rows
 * recorded them; nothing is re-scored.
 *
 * The two slices must add up to the summary's own figure for the peer at that
 * level (`spans`, `leakedSpans`). When they do not, or when any input has no row,
 * the slices are `null` and the page says "Not measured": a number the summary
 * cannot confirm is never shown.
 *
 * Boundary rule: this says where a scanner's rules point and what was recorded there.
 * It never says which scanner is better.
 */
import type { CatalogFixture } from '../services/catalog';
import type { RowResult } from '../services/run';
import type { Level } from './report';

export interface Slice { inputs: number; spans: number; leaked: number }
export interface Slices { targeted: Slice; elsewhere: Slice }

const empty = (): Slice => ({ inputs: 0, spans: 0, leaked: 0 });

/** The fixtures whose spans a level's accounting counts: secrets at T1/T2, policy spans at T3. */
export const inputsAt = (fixtures: CatalogFixture[], level: Level): CatalogFixture[] =>
  fixtures.filter(f => f.tier === level && (level === 'T3' ? f.kind === 'policy' : f.kind === 'must-redact'));

const leakedIn = (row: RowResult): number => row.spanOutcomes?.filter(o => o === 'PARTIAL' || o === 'MISS').length ?? 0;

export const isTargeted = (fixture: CatalogFixture, families: Set<string>): boolean => fixture.familyIds.some(id => families.has(id));

/**
 * Split one scanner's inputs at a level into those its rules target and the rest.
 * `null` when the scanner has no row for some input.
 */
export function sliceInputs(inputs: CatalogFixture[], rows: Map<string, RowResult> | undefined, families: Set<string>): Slices | null {
  if (!rows || rows.size === 0) return null;
  const slices: Slices = { targeted: empty(), elsewhere: empty() };
  for (const fixture of inputs) {
    const row = rows.get(fixture.slug);
    if (!row?.spanOutcomes) return null;
    const slice = isTargeted(fixture, families) ? slices.targeted : slices.elsewhere;
    slice.inputs++;
    slice.spans += row.spanOutcomes.length;
    slice.leaked += leakedIn(row);
  }
  return slices;
}

/** True when the slices are the summary's own totals for the group: the check that lets the page show them. */
export const agreesWithSummary = (slices: Slices, group: { spans: number; leakedSpans: number; files: number }): boolean =>
  slices.targeted.spans + slices.elsewhere.spans === group.spans
  && slices.targeted.leaked + slices.elsewhere.leaked === group.leakedSpans
  && slices.targeted.inputs + slices.elsewhere.inputs === group.files;
