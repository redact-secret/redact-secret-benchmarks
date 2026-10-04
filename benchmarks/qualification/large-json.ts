import { createHash } from 'node:crypto';
import { canonical, parseKeepingNumbers } from './canonical.ts';

/**
 * Reading a RunArtifact larger than a JavaScript string can hold (about 512 MiB). credential-eval alpha.3 writes a methods artifact of
 * more than 700 MB (every scanner's findings for 35,322 generated variants), so `Buffer.toString()` and `JSON.parse(text)` throw
 * "Cannot create a string longer than 0x1fffffe8 characters". Two functions work on the bytes instead:
 *
 *  - `parseBuffer` parses the document straight from the bytes (numbers become plain numbers), so schema validation still sees the
 *    whole artifact;
 *  - `canonicalDigest` hashes the engine's canonical JSON of the document (object keys sorted by UTF-8 byte order, every number kept as its
 *    source text) in pieces, without ever building the whole canonical string, with `non_semantic` replaced by `{}`.
 *
 * Both are exact: for a document that fits in a string they give the same value as `JSON.parse` and `canonical(parseKeepingNumbers(text))`.
 */

const QUOTE = 0x22, BACKSLASH = 0x5c, OPEN_OBJECT = 0x7b, CLOSE_OBJECT = 0x7d, OPEN_ARRAY = 0x5b, CLOSE_ARRAY = 0x5d, COMMA = 0x2c, COLON = 0x3a;
const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

class Cursor {
  p = 0;
  constructor(readonly b: Buffer) {}
  ws() { const b = this.b; while (this.p < b.length) { const c = b[this.p]; if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) this.p++; else break; } }
  expect(c: number) { this.ws(); if (this.b[this.p] !== c) throw new SyntaxError(`expected ${String.fromCharCode(c)} at byte ${this.p}`); this.p++; }
  /** Advance past a string; returns its decoded text. */
  string(): string {
    this.ws();
    if (this.b[this.p] !== QUOTE) throw new SyntaxError(`expected a string at byte ${this.p}`);
    const start = ++this.p; let escaped = false;
    for (;;) {
      const i = this.b.indexOf(QUOTE, this.p);
      if (i < 0) throw new SyntaxError('unterminated string');
      let back = 0; for (let j = i - 1; j >= this.p && this.b[j] === BACKSLASH; j--) back++;
      this.p = i + 1;
      if (back % 2 === 0) { const raw = this.b.toString('utf8', start, i); escaped = raw.includes('\\'); return escaped ? JSON.parse(`"${raw}"`) as string : raw; }
    }
  }
  /** Advance past any value without building it; returns its [start, end) byte range. */
  skip(): [number, number] {
    this.ws();
    const start = this.p, b = this.b, c = b[start];
    if (c === QUOTE) { this.string(); return [start, this.p]; }
    if (c === OPEN_OBJECT || c === OPEN_ARRAY) {
      let depth = 0;
      while (this.p < b.length) {
        const d = b[this.p];
        if (d === QUOTE) { this.string(); continue; }
        this.p++;
        if (d === OPEN_OBJECT || d === OPEN_ARRAY) depth++;
        else if (d === CLOSE_OBJECT || d === CLOSE_ARRAY) { depth--; if (depth === 0) return [start, this.p]; }
      }
      throw new SyntaxError('unterminated container');
    }
    while (this.p < b.length && ![COMMA, CLOSE_OBJECT, CLOSE_ARRAY, 0x20, 0x0a, 0x0d, 0x09].includes(b[this.p])) this.p++;
    return [start, this.p];
  }
  value(): unknown {
    this.ws();
    const c = this.b[this.p];
    if (c === OPEN_OBJECT) {
      this.p++; const out: Record<string, unknown> = {}; this.ws();
      if (this.b[this.p] === CLOSE_OBJECT) { this.p++; return out; }
      for (;;) { const key = this.string(); this.expect(COLON); out[key] = this.value(); this.ws(); const d = this.b[this.p++]; if (d === CLOSE_OBJECT) return out; if (d !== COMMA) throw new SyntaxError(`expected , or } at byte ${this.p - 1}`); }
    }
    if (c === OPEN_ARRAY) {
      this.p++; const out: unknown[] = []; this.ws();
      if (this.b[this.p] === CLOSE_ARRAY) { this.p++; return out; }
      for (;;) { out.push(this.value()); this.ws(); const d = this.b[this.p++]; if (d === CLOSE_ARRAY) return out; if (d !== COMMA) throw new SyntaxError(`expected , or ] at byte ${this.p - 1}`); }
    }
    if (c === QUOTE) return this.string();
    const [s, e] = this.skip(); const word = this.b.toString('latin1', s, e);
    if (word === 'true') return true; if (word === 'false') return false; if (word === 'null') return null;
    const n = Number(word); if (!Number.isFinite(n)) throw new SyntaxError(`bad value ${word.slice(0, 20)} at byte ${s}`);
    return n;
  }
}

/** `JSON.parse` over bytes, with no string the size of the document. Numbers are plain numbers. */
export function parseBuffer(bytes: Buffer): unknown {
  const cursor = new Cursor(bytes); const v = cursor.value(); cursor.ws();
  if (cursor.p !== bytes.length) throw new SyntaxError(`unexpected data at byte ${cursor.p}`);
  return v;
}

const PIECE = 32 * 1024 * 1024;

/** sha256 of the canonical JSON of the document with its top-level `non_semantic` cleared to `{}`; hex digits, no prefix. */
export function canonicalDigest(bytes: Buffer, piece = PIECE): string {
  const hash = createHash('sha256');
  const write = (start: number, end: number, top: boolean) => {
    const c = bytes[start];
    if (end - start <= piece || (c !== OPEN_OBJECT && c !== OPEN_ARRAY)) {
      const text = bytes.toString('utf8', start, end);
      if (top) { const raw = parseKeepingNumbers(text) as Record<string, unknown>; raw.non_semantic = {}; hash.update(canonical(raw)); } else hash.update(canonical(parseKeepingNumbers(text)));
      return;
    }
    const cursor = new Cursor(bytes); cursor.p = start + 1; cursor.ws();
    if (c === OPEN_ARRAY) {
      hash.update('[');
      let first = true;
      if (bytes[cursor.p] !== CLOSE_ARRAY) for (;;) {
        const [s, e] = cursor.skip(); if (!first) hash.update(','); first = false; write(s, e, false);
        cursor.ws(); if (bytes[cursor.p++] === CLOSE_ARRAY) break;
      }
      hash.update(']'); return;
    }
    const members: { key: string; s: number; e: number }[] = [];
    if (bytes[cursor.p] !== CLOSE_OBJECT) for (;;) {
      const key = cursor.string(); cursor.expect(COLON); const [s, e] = cursor.skip(); members.push({ key, s, e });
      cursor.ws(); if (bytes[cursor.p++] === CLOSE_OBJECT) break;
    }
    if (top && !members.some(m => m.key === 'non_semantic')) members.push({ key: 'non_semantic', s: -1, e: -1 });
    members.sort((a, b) => byteOrder(a.key, b.key));
    hash.update('{');
    members.forEach((m, i) => {
      if (i) hash.update(',');
      hash.update(`${JSON.stringify(m.key)}:`);
      if (top && m.key === 'non_semantic') hash.update('{}'); else write(m.s, m.e, false);
    });
    hash.update('}');
  };
  const root = new Cursor(bytes); const [s, e] = root.skip();
  write(s, e, true);
  return hash.digest('hex');
}
