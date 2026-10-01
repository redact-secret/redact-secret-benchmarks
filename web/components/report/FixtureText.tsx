import { Fragment } from 'react';
import type { ReactNode } from 'react';
import styles from './FixtureText.module.css';

/**
 * Characters a reader cannot see are drawn as symbols, so a tab, a carriage return, a byte order mark or
 * a zero-width space in a fixture is visible and nothing hides in the bytes. Shared by the file views and
 * the lane view, which must draw the same glyphs to stay aligned. Every entry names itself for a pointer.
 */
const NAMED: Record<string, [string, string]> = {
  '\t': ['→', 'tab, U+0009'],
  '\r': ['␍', 'carriage return, U+000D'],
  '\u007f': ['␡', 'delete, U+007F'],
  '\u00a0': ['⍽', 'no-break space, U+00A0'],
  '\u00ad': ['SHY', 'soft hyphen, U+00AD'],
  '\u200b': ['ZWSP', 'zero-width space, U+200B'],
  '\u200c': ['ZWNJ', 'zero-width non-joiner, U+200C'],
  '\u200d': ['ZWJ', 'zero-width joiner, U+200D'],
  '\u200e': ['LRM', 'left-to-right mark, U+200E'],
  '\u200f': ['RLM', 'right-to-left mark, U+200F'],
  '\u2028': ['LS', 'line separator, U+2028'],
  '\u2029': ['PS', 'paragraph separator, U+2029'],
  '\u202a': ['LRE', 'left-to-right embedding, U+202A'],
  '\u202b': ['RLE', 'right-to-left embedding, U+202B'],
  '\u202c': ['PDF', 'pop directional formatting, U+202C'],
  '\u202d': ['LRO', 'left-to-right override, U+202D'],
  '\u202e': ['RLO', 'right-to-left override, U+202E'],
  '\u2060': ['WJ', 'word joiner, U+2060'],
  '\u2066': ['LRI', 'left-to-right isolate, U+2066'],
  '\u2067': ['RLI', 'right-to-left isolate, U+2067'],
  '\u2068': ['FSI', 'first strong isolate, U+2068'],
  '\u2069': ['PDI', 'pop directional isolate, U+2069'],
  '\ufeff': ['BOM', 'byte order mark, U+FEFF'],
};

const hex = (code: number): string => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

/** The symbol and name a character is drawn as, or undefined when it is drawn as itself. A space is handled by the caller. */
export function symbolOf(char: string): [string, string] | undefined {
  const named = NAMED[char];
  if (named) return named;
  const code = char.codePointAt(0)!;
  if (code < 0x20 && char !== '\n') return [String.fromCharCode(0x2400 + code), `control character ${hex(code)}`];
  if (code >= 0x80 && code <= 0x9f) return [hex(code), `control character ${hex(code)}`];
  return undefined;
}

/**
 * Characters that are not normally visible and are not an ordinary space, tab or line break: the ones a reader is told about.
 * Kept equal to `INVISIBLE` in `resolvers/fixtures.ts`, which counts them for the notice under a file.
 */
export const isHidden = (char: string): boolean => {
  if (char === '\t' || char === '\r' || char === '\n') return false;
  return symbolOf(char) !== undefined;
};

export interface FixtureTextProps {
  text: string;
  /** Name each symbol for a pointer. Off in the lane view, which mirrors the text and is hidden from pointers. */
  withTitle: boolean;
  /** `all` draws every space as a middle dot (the lane view); `trailing` only the run of spaces at the end of a line; `none` leaves spaces alone. */
  spaces?: 'all' | 'trailing' | 'none';
  /** For `trailing`: the index in `text` where the line's trailing run of spaces starts; spaces from there on are drawn. */
  trailingFrom?: number;
}

/** The text with whitespace and characters a reader cannot see drawn as symbols. Pure render. */
export function FixtureText({ text, withTitle, spaces = 'all', trailingFrom }: FixtureTextProps): ReactNode {
  const parts: ReactNode[] = [];
  let run = '';
  let key = 0;
  let index = 0;
  const flush = () => { if (run) { parts.push(run); run = ''; } };
  for (const char of text) {
    const showSpace = char === ' ' && (spaces === 'all' || (spaces === 'trailing' && trailingFrom !== undefined && index >= trailingFrom));
    const symbol = showSpace ? ['·', 'space'] as [string, string] : symbolOf(char);
    if (!symbol) { run += char; index += char.length; continue; }
    flush();
    const wide = symbol[0].length > 1 && symbol[0] !== '·';
    parts.push(withTitle
      ? <span key={key++} className={wide ? styles.code : styles.ws} title={symbol[1]}>{symbol[0]}</span>
      : <Fragment key={key++}>{symbol[0]}</Fragment>);
    index += char.length;
  }
  flush();
  return <>{parts}</>;
}
