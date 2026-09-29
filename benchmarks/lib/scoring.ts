import type { Corpus, Fixture, Finding, Range, ScoredRow } from '../types.ts';
import { scoreRow } from './lattice.ts';

// UTF-8 byte offset of every code-point boundary. Walks charCodeAt instead of
// Buffer.byteLength per character; a lone surrogate counts 3 bytes (U+FFFD), as Buffer does.
function computeByteBoundaries(content: string) {
  const boundaries = new Set([0]);
  let offset = 0;
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i);
    if (code < 0x80) offset += 1;
    else if (code < 0x800) offset += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < content.length && (content.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { offset += 4; i++; }
    else offset += 3;
    boundaries.add(offset);
  }
  return boundaries;
}

// Generated variants re-score the same content once per scanner and method, so keep a small
// bounded cache keyed on the content itself (the Sets are never mutated).
const BOUNDARY_CACHE_LIMIT = 64;
const boundaryCache = new Map<string, Set<number>>();
function byteBoundaries(content: string) {
  let boundaries = boundaryCache.get(content);
  if (!boundaries) {
    boundaries = computeByteBoundaries(content);
    if (boundaryCache.size >= BOUNDARY_CACHE_LIMIT) boundaryCache.delete(boundaryCache.keys().next().value!);
    boundaryCache.set(content, boundaries);
  }
  return boundaries;
}

const validRange = (r: Range, bytes: number, boundaries: Set<number>) =>
  r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start && r.end <= bytes && boundaries.has(r.start) && boundaries.has(r.end);

/**
 * Corpus schema 2: every expected span carries `role` (secret | companion)
 * and may carry an authored `envelope` (wider acceptable range with a reason).
 * Controls may declare `twinOf` + `mutation` + `mutationKind`.
 */
export function validateCorpus(corpus: Corpus): Corpus {
  if (!corpus || !Array.isArray(corpus.fixtures) || !corpus.fixtures.length)
    throw new Error("Empty corpus");
  const ids = new Set(),
    paths = new Set();
  for (const f of corpus.fixtures) {
    if (!f || typeof f.id !== "string" || !/^[a-z0-9-]+$/.test(f.id) || ids.has(f.id))
      throw new Error("Invalid fixture id");
    if (
      typeof f.path !== "string" ||
      !/^[a-zA-Z0-9_./-]+$/.test(f.path) ||
      f.path.startsWith("/") ||
      f.path.split("/").some((p) => !p || p === ".." || p === ".") ||
      paths.has(f.path)
    )
      throw new Error("Unsafe or duplicate path");
    ids.add(f.id);
    paths.add(f.path);
    if (typeof f.content !== "string" || !Array.isArray(f.expected))
      throw new Error("Invalid fixture");
    const bytes = Buffer.byteLength(f.content);
    const boundaries = byteBoundaries(f.content);
    let end = 0;
    for (const r of f.expected) {
      if (!validRange(r, bytes, boundaries) || r.start < end) throw new Error("Invalid UTF-8 range");
      if (!['secret', 'companion'].includes(r.role!)) throw new Error(`Missing span role: ${f.id}`);
      if (r.envelope !== undefined) {
        const e = r.envelope;
        if (!validRange(e, bytes, boundaries) || e.start > r.start || e.end < r.end || typeof e.reason !== 'string' || !e.reason.trim()) throw new Error(`Invalid envelope: ${f.id}`);
        if (f.expected.some(o => o !== r && o.start < e.end && e.start < o.end)) throw new Error(`Envelope overlaps another span: ${f.id}`);
      }
      end = r.end;
    }
  }
  const byId = new Map(corpus.fixtures.map(o => [o.id, o]));
  for (const f of corpus.fixtures) {
    if (f.twinOf === undefined) continue;
    const positive = byId.get(f.twinOf);
    if (!positive || positive === f || !positive.expected.some(r => r.role === 'secret') || f.expected.some(r => r.role === 'secret')) throw new Error(`Invalid twin: ${f.id}`);
    if (typeof f.mutation !== 'string' || !f.mutation.trim() || typeof f.mutationKind !== 'string') throw new Error(`Twin without mutation: ${f.id}`);
  }
  return corpus;
}

/** Deduplicate and validate normalized findings, then score every fixture. No totals. */
export function score(fixtures: Fixture[], findings: Finding[]): { rows: ScoredRow[] } {
  const known = new Map(fixtures.map((f) => [f.path, f]));
  const boundaries = new Map(fixtures.map((f) => [f.path, byteBoundaries(f.content)]));
  const byteLengths = new Map(fixtures.map((f) => [f.path, Buffer.byteLength(f.content)]));
  if (!Array.isArray(findings)) throw new Error("Invalid normalized findings");
  const unique = new Map<string, Finding>();
  for (const r of findings) {
    const f = known.get(r?.path);
    if (!f || !validRange(r, byteLengths.get(r.path)!, boundaries.get(r.path)!))
      throw new Error("Invalid normalized finding");
    unique.set(`${r.path}:${r.start}:${r.end}`, r);
  }
  const actualByPath = new Map<string, Finding[]>();
  for (const r of unique.values()) {
    const group = actualByPath.get(r.path);
    if (group) group.push(r); else actualByPath.set(r.path, [r]);
  }
  const rows = fixtures.map((f) => {
    // `family`, when a scanner attributed one, rides along on `actual` so a twin's flagged
    // reading can be scoped to its own contract family (below) and so a published report row
    // stays self-verifying (docs/specs/measurement-v4.md §3) without a separate, unpublished channel.
    // `action` (#95) rides along the same way, for scoreRow's additive actionCounts.
    const actual = (actualByPath.get(f.path) ?? [])
      .map(({ start, end, family, action }) => ({ start, end, ...(family !== undefined ? { family } : {}), ...(action !== undefined ? { action } : {}) }));
    const expected = f.expected.map(({ start, end, role, envelope }) => ({ start, end, role, ...(envelope ? { envelope: { start: envelope.start, end: envelope.end } } : {}) }));
    const a = f.assessment;
    const row = {
      id: f.id,
      path: f.path,
      group: f.group,
      ...(a ? { kind: a.kind, tier: a.tier, ...(a.contract ? { contract: a.contract } : {}) } : {}),
      ...(f.twinOf ? { twinOf: f.twinOf } : {}),
      expected,
      actual,
    };
    if (a?.tier === 'T0') return row;
    return { ...row, ...scoreRow(expected, actual, f.twinOf ? a?.contract : undefined) };
  });
  return { rows };
}
