import { escapeHtml } from './html';

/**
 * StatusMark: a status token, its fill, and always a word. Colour is never the
 * only cue: Failed adds a border, Unstable adds a hatch. "Not measured" is not
 * a status at all, so it takes no status colour: dashed `ink-muted`.
 */
export type StatusKind = 'pass' | 'fail' | 'review' | 'not-measured' | 'unstable' | 'withheld' | 'info';

const CLASS: Record<StatusKind, string> = {
  pass: 'st-pass', fail: 'st-fail', review: 'st-review', 'not-measured': 'st-nm', unstable: 'st-unstable', withheld: 'st-held', info: 'st-info',
};
export const DEFAULT_WORD: Record<StatusKind, string> = {
  pass: 'Passed', fail: 'Failed', review: 'Needs review', 'not-measured': 'Not measured', unstable: 'Unstable', withheld: 'Withheld', info: 'New',
};

export function statusMark(kind: StatusKind, word: string = DEFAULT_WORD[kind]): string {
  if (!word.trim()) throw new Error('StatusMark needs a word: nothing may be readable by colour alone');
  return `<span class="st ${CLASS[kind]}" data-status="${kind}">${escapeHtml(word)}</span>`;
}
