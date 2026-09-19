import { escapeHtml } from './html';
import { byteLines, displayText, segment, type ByteLine, type ByteRange } from './byte-view';

/**
 * RedactionLane: what one scanner actually covered, drawn under the bytes.
 * The five lattice outcomes differ by shape, not colour:
 *   EXACT / COVERED / OVERBROAD  solid bar over the finding (its length tells them apart)
 *   PARTIAL                      hatched bar: the finding touches the secret but does not contain it
 *   MISS                         dashed empty frame where the secret is
 * The lane repeats the line's displayed text invisibly, so a bar sits under
 * exactly the glyphs it covers.
 */
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
export type LaneShape = 'fill' | 'hatch' | 'outline';
export interface LaneMark extends ByteRange { shape: LaneShape }
export interface RedactionLaneInput { content: string; marks: LaneMark[]; line?: ByteLine; label: string }

export const OUTCOME_NAME: Record<Outcome, string> = {
  EXACT: 'Redacted exactly', COVERED: 'Redacted within allowed range', OVERBROAD: 'Redacted too much', PARTIAL: 'Partly exposed', MISS: 'Missed',
};
export const OUTCOME_SHAPE: Record<Outcome, LaneShape> = { EXACT: 'fill', COVERED: 'fill', OVERBROAD: 'fill', PARTIAL: 'hatch', MISS: 'outline' };

const overlaps = (a: ByteRange, b: ByteRange) => a.start < b.end && b.start < a.end;

/** Findings become bars; a missed secret becomes an empty frame. Outcomes are read from the report, never rescored. */
export function laneMarks(secrets: ByteRange[], outcomes: Outcome[] | undefined, findings: ByteRange[]): LaneMark[] {
  const partial = secrets.filter((_, i) => outcomes?.[i] === 'PARTIAL');
  return [
    ...findings.map(f => ({ start: f.start, end: f.end, shape: (partial.some(s => overlaps(s, f)) ? 'hatch' : 'fill') as LaneShape })),
    ...secrets.filter((_, i) => outcomes?.[i] === 'MISS').map(s => ({ start: s.start, end: s.end, shape: 'outline' as LaneShape })),
  ];
}

const PRIORITY: LaneShape[] = ['fill', 'hatch', 'outline'];

export function redactionLane({ content, marks, line, label }: RedactionLaneInput): string {
  const lines = line ? [line] : byteLines(content);
  return lines.map(l => {
    const html = segment(content, l.start, l.end, marks).map(piece => {
      const shape = PRIORITY.find(s => piece.marks.some(m => m.shape === s));
      const text = displayText(piece.text, false);
      return shape ? `<i class="${shape}">${text}</i>` : text;
    }).join('');
    return `<span class="lane" role="img" aria-label="${escapeHtml(label)}">${html}</span>`;
  }).join('\n');
}
