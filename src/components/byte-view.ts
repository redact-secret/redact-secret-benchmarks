import { escapeHtml } from './html';

/**
 * ByteView: exact fixture bytes, one source line at a time.
 *   secret span  = `brand-green` highlight (the only meaning green has in data)
 *   envelope     = `ink` underline
 * Whitespace and line endings are drawn as symbols so a trailing space, a tab
 * or a CRLF is visible. Offsets are UTF-8 bytes, [start, end).
 */
export interface ByteRange { start: number; end: number }
export interface ByteSpan extends ByteRange { role?: 'secret' | 'companion' }
export interface ByteLine { index: number; start: number; end: number }
export interface ByteViewInput { content: string; spans: ByteSpan[]; envelopes?: ByteRange[]; line?: ByteLine }

const SYMBOLS: Record<string, [string, string]> = {
  ' ': ['·', 'space'], '\t': ['→', 'tab'], '\r': ['␍', 'carriage return'], '\n': ['␊', 'line feed'], '﻿': ['BOM', 'byte order mark U+FEFF'],
};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });

/** Source lines as byte ranges; a line keeps its own terminator. */
export function byteLines(content: string): ByteLine[] {
  const bytes = encoder.encode(content), lines: ByteLine[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0x0a) { lines.push({ index: lines.length, start, end: i + 1 }); start = i + 1; }
  if (start < bytes.length || !lines.length) lines.push({ index: lines.length, start, end: bytes.length });
  return lines;
}

/** The text as displayed. RedactionLane mirrors this exact string, which is what keeps bars aligned under any glyph width. */
export function displayText(text: string, markup = true): string {
  let out = '';
  for (const char of text) {
    const symbol = SYMBOLS[char];
    out += symbol ? (markup ? `<span class="ws" title="${symbol[1]}">${symbol[0]}</span>` : symbol[0]) : escapeHtml(char);
  }
  return out;
}

export interface Segment<T> { start: number; end: number; text: string; marks: T[] }
/** Cut [from, to) at every range boundary and report which ranges cover each piece. */
export function segment<T extends ByteRange>(content: string, from: number, to: number, ranges: T[]): Segment<T>[] {
  const bytes = encoder.encode(content);
  const cuts = [...new Set([from, to, ...ranges.flatMap(r => [r.start, r.end]).filter(offset => offset > from && offset < to)])].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1];
    return { start, end, text: decoder.decode(bytes.slice(start, end)), marks: ranges.filter(r => r.start < end && r.end > start) };
  });
}

function renderLine(content: string, line: ByteLine, spans: ByteSpan[], envelopes: ByteRange[]): string {
  const marks = [...spans.map(s => ({ ...s, type: s.role === 'companion' ? 'cmp' : 'sec' })), ...envelopes.map(r => ({ ...r, type: 'env' }))];
  const html = segment(content, line.start, line.end, marks).map(piece => {
    const classes = [...new Set(piece.marks.map(m => m.type))];
    let text = displayText(piece.text);
    // Nest the secret inside the envelope so the underline runs unbroken beneath the highlight.
    for (const type of ['cmp', 'sec', 'env']) if (classes.includes(type)) text = `<span class="${type}">${text}</span>`;
    return text;
  }).join('');
  return `<span class="bytes">${html || '<span class="ws" title="empty">∅</span>'}</span>`;
}

export function byteView({ content, spans, envelopes = [], line }: ByteViewInput): string {
  return (line ? [line] : byteLines(content)).map(l => renderLine(content, l, spans, envelopes)).join('\n');
}

export const describeSpans = (spans: ByteRange[]) => spans.map(s => `${s.start}–${s.end}`).join(', ') || 'none';
