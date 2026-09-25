/**
 * Black-box MCP adapter boundary and operational qualification (#281).
 *
 * Pure pieces of the harness, kept here so they are unit-tested without a
 * consumer install: artifact identity (the same content digest the core's
 * `scripts/adapter-pins.py` pins), the plaintext-leak scan over every sink,
 * and the per-case verdicts. The run itself is `benchmarks/mcp-qualification.ts`;
 * the host, the server and the workload corpus it drives are plain ESM under
 * `benchmarks/mcp-qualification/consumer/`. Spec: docs/specs/mcp-qualification.md.
 *
 * Nothing here returns a matched value. A scan answers "did this sink carry
 * this synthetic value, in full or as a fragment", per case and per sink.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const REPORT_SCHEMA = 'redact-secret-benchmarks/mcp-qualification-v1';
export const OVERHEAD_SCHEMA = 'redact-secret-benchmarks/mcp-overhead-v1';
export const SERIES_SCHEMA = 'redact-secret-benchmarks/adapter-overhead-series-v1';

// ---------------------------------------------------------------------------
// Artifact identity
// ---------------------------------------------------------------------------

export interface TarEntry { readonly name: string; readonly data: Buffer }

/** Regular files of an npm-pack tarball (ustar, with pax path overrides). */
export function tarEntries(gzipped: Buffer): TarEntry[] {
  const buffer = gunzipSync(gzipped);
  const entries: TarEntry[] = [];
  let offset = 0;
  let paxPath: string | null = null;
  const field = (header: Buffer, start: number, length: number) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const size = parseInt(field(header, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156]!);
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    if (type === 'x') {
      const match = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      paxPath = match ? match[1]! : null;
    } else {
      if (type === '0' || type === '\0') {
        const prefix = field(header, 345, 155);
        const name = paxPath ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
        entries.push({ name, data: Buffer.from(body) });
      }
      paxPath = null;
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/** SHA-256 over the sorted `path NUL sha256(bytes) LF` lines: core's adapter-pins content digest. */
export function contentDigest(entries: readonly { name: string; data: Buffer }[]): string {
  const lines = entries.map(e => `${e.name}\0${createHash('sha256').update(e.data).digest('hex')}\n`).sort();
  return `sha256:${createHash('sha256').update(lines.join(''), 'utf8').digest('hex')}`;
}

export function tarballDigest(file: string): string {
  return contentDigest(tarEntries(readFileSync(file)));
}

/** The same digest over an installed package directory (tarball paths are `package/<file>`). */
export function installedDigest(dir: string): string {
  const entries: TarEntry[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); } else if (entry.isFile()) {
        entries.push({ name: `package/${path.relative(dir, full).split(path.sep).join('/')}`, data: readFileSync(full) });
      }
    }
  };
  walk(dir);
  return contentDigest(entries);
}

export function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** #141's size definitions: packed = tarball bytes, unpacked = sum of regular-file sizes. */
export function packageSize(file: string): { packedBytes: number; unpackedBytes: number; files: number } {
  const entries = tarEntries(readFileSync(file));
  return { packedBytes: statSync(file).size, unpackedBytes: entries.reduce((sum, e) => sum + e.data.length, 0), files: entries.length };
}

export interface AdapterPin {
  readonly schemaVersion: number;
  readonly repository: string;
  readonly commit: string;
  readonly packages: readonly { readonly name: string; readonly version: string; readonly contentDigest: string }[];
}

export function tarballName(name: string, version: string): string {
  return `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
}

/** Problems with the adapter tarballs against the pin; empty when every one matches. */
export function adapterPinProblems(pin: AdapterPin, directory: string): string[] {
  const problems: string[] = [];
  if (pin.schemaVersion !== 1 || pin.repository !== 'redact-secret/redact-secret-adapters') problems.push('pin is not a redact-secret-adapters pin-source v1 record');
  if (!/^[0-9a-f]{40}$/.test(pin.commit ?? '')) problems.push('pin commit is not a 40-hex commit');
  for (const pkg of pin.packages ?? []) {
    const file = path.join(directory, tarballName(pkg.name, pkg.version));
    let actual: string;
    try { actual = tarballDigest(file); } catch { problems.push(`${pkg.name}: tarball ${path.basename(file)} is missing or unreadable`); continue; }
    if (actual !== pkg.contentDigest) problems.push(`${pkg.name}: content digest ${actual} is not the pinned ${pkg.contentDigest}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Plaintext-leak scan
// ---------------------------------------------------------------------------

export const FRAGMENT_LENGTH = 12;

/** Windows of a secret long enough to identify it; low-variety windows (runs of zeros) are skipped. */
export function fragments(secret: string, length = FRAGMENT_LENGTH): string[] {
  if (secret.length <= length) return [secret];
  const out = new Set<string>();
  for (let i = 0; i + length <= secret.length; i += 1) {
    const window = secret.slice(i, i + length);
    if (new Set(window).size >= 4) out.add(window);
  }
  return [...out];
}

export interface Needle { readonly full: string; readonly fragments: readonly string[] }

export function needles(secrets: readonly string[]): Needle[] {
  return secrets.map(full => ({ full, fragments: fragments(full) }));
}

export interface Hit { readonly full: boolean; readonly fragment: boolean }

export function scanText(text: string, list: readonly Needle[]): Hit {
  let full = false;
  let fragment = false;
  for (const needle of list) {
    if (text.includes(needle.full)) { full = true; fragment = true; break; }
    if (!fragment && needle.fragments.some(f => text.includes(f))) fragment = true;
  }
  return { full, fragment };
}

/** Host sinks the contract protects: the model context, the host's log, its store, its audit trail, and error text. */
export const HOST_SINKS = ['model-context', 'host-log', 'store', 'audit', 'error-text'] as const;
export type HostSink = typeof HOST_SINKS[number];

export interface SinkScan {
  /** case id -> sink -> hit, for the host sinks. */
  readonly byCase: Record<string, Partial<Record<HostSink, Hit>>>;
  /** Server-side observations, attributed by tool name. */
  readonly wire: Record<string, Hit>;
  readonly toolInput: Record<string, Hit>;
  readonly serverStderr: Hit;
}

function readJsonl(file: string): unknown[] {
  let text: string;
  try { text = readFileSync(file, 'utf8'); } catch { return []; }
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line) as unknown);
}

function merge(a: Hit | undefined, b: Hit): Hit {
  return { full: (a?.full ?? false) || b.full, fragment: (a?.fragment ?? false) || b.fragment };
}

export function scanRecordDir(dir: string, secrets: readonly string[]): SinkScan {
  const list = needles(secrets);
  const byCase: Record<string, Partial<Record<HostSink, Hit>>> = {};
  for (const sink of HOST_SINKS) {
    for (const record of readJsonl(path.join(dir, `${sink}.jsonl`)) as { case: string; value: unknown }[]) {
      const hit = scanText(JSON.stringify(record.value), list);
      const row = (byCase[record.case] ??= {});
      row[sink] = merge(row[sink], hit);
    }
  }
  const wire: Record<string, Hit> = {};
  for (const record of readJsonl(path.join(dir, 'wire.jsonl')) as { tool: string | null; message: unknown }[]) {
    const tool = record.tool ?? '(none)';
    wire[tool] = merge(wire[tool], scanText(JSON.stringify(record.message), list));
  }
  const toolInput: Record<string, Hit> = {};
  for (const record of readJsonl(path.join(dir, 'received.jsonl')) as { tool: string; args: unknown }[]) {
    toolInput[record.tool] = merge(toolInput[record.tool], scanText(JSON.stringify(record.args), list));
  }
  let stderr = '';
  try { stderr = readFileSync(path.join(dir, 'server-stderr.txt'), 'utf8'); } catch { /* none written */ }
  return { byCase, wire, toolInput, serverStderr: scanText(stderr, list) };
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

export interface Expectation { readonly outcome: string; readonly reason?: string }

export interface HostCaseRow {
  readonly id: string;
  readonly area: string;
  readonly expect: Expectation;
  readonly observed: { readonly outcome: string; readonly reason?: string; readonly code?: string };
  readonly exclusion?: string;
  readonly policyDelivers?: boolean;
  readonly delivered?: boolean;
  readonly deliveredFixed?: 'blocked' | 'toolError' | null;
  readonly benignUnchanged?: boolean;
  readonly dispatched?: boolean;
  readonly differsFromWholeResult?: number;
  readonly producersNotClosed?: number;
  readonly producer?: { readonly chunks?: number; readonly pulled?: number; readonly closed?: number; readonly read?: number; readonly destroyed?: boolean };
  readonly serverStream?: { readonly pulled: number; readonly closed: number };
  readonly threw?: boolean;
  readonly control?: boolean;
  readonly [key: string]: unknown;
}

/** What the workload corpus declares beyond the expected outcome. */
export interface CaseDeclaration {
  readonly id: string;
  readonly fixedDelivered?: 'blocked' | 'toolError';
  readonly dispatch?: boolean;
  readonly wire?: boolean;
  readonly tool?: string;
}

export type Containment = 'contained' | 'leak' | 'known-false-negative' | 'delivered-by-policy' | 'control-detected' | 'control-missed';

export interface CaseVerdict {
  readonly id: string;
  readonly area: string;
  readonly expected: Expectation;
  readonly observed: HostCaseRow['observed'];
  readonly containment: Containment;
  /** Sinks that carried plaintext (full value or fragment), for a leak, a known false negative, or a policy delivery. */
  readonly sinks: readonly string[];
  readonly checks: readonly { readonly name: string; readonly passed: boolean }[];
  readonly conforms: boolean;
  readonly exclusion?: string;
  readonly [key: string]: unknown;
}

/** Sweep cases report their own composite outcome; it must equal the expected one exactly. */
const COMPOSITE_OUTCOMES = new Set(['ok-or-aborted', 'ok-or-blocked-at-surrogate-splits']);

export function outcomeMatches(expect: Expectation, observed: HostCaseRow['observed']): boolean {
  if (COMPOSITE_OUTCOMES.has(expect.outcome)) return observed.outcome === expect.outcome;
  if (observed.outcome !== expect.outcome) return false;
  return expect.reason === undefined || observed.reason === expect.reason;
}

export function verdict(row: HostCaseRow, declaration: CaseDeclaration | undefined, scan: SinkScan): CaseVerdict {
  const sinks: string[] = [];
  for (const [sink, hit] of Object.entries(scan.byCase[row.id] ?? {})) if (hit?.fragment) sinks.push(sink);
  if (declaration?.wire && declaration.tool && (scan.wire[declaration.tool]?.fragment ?? false)) sinks.push('server-wire');
  if (declaration?.tool && (scan.toolInput[declaration.tool]?.fragment ?? false) && (declaration.tool === 'wrapped-args' || row.area === 'arguments')) sinks.push('tool-input');
  let containment: Containment = 'contained';
  if (sinks.length > 0) containment = row.exclusion ? 'known-false-negative' : row.policyDelivers ? 'delivered-by-policy' : 'leak';

  if (row.control) {
    const everySink = HOST_SINKS.every(sink => sinks.includes(sink));
    return {
      id: row.id, area: row.area, expected: row.expect, observed: row.observed, containment: everySink ? 'control-detected' : 'control-missed',
      sinks, checks: [{ name: 'leak-scan-flags-every-host-sink', passed: everySink }], conforms: everySink,
    };
  }

  const checks: { name: string; passed: boolean }[] = [{ name: 'outcome', passed: outcomeMatches(row.expect, row.observed) }];
  if (row.threw) checks.push({ name: 'boundary-did-not-throw', passed: false });
  if (row.expect.outcome === 'aborted') checks.push({ name: 'nothing-delivered', passed: row.delivered === false });
  if (row.expect.outcome === 'blocked' && row.deliveredFixed !== undefined) checks.push({ name: 'fixed-blocked-result', passed: row.deliveredFixed === 'blocked' });
  if (row.expect.outcome === 'tool_error') checks.push({ name: 'fixed-tool-error-result', passed: row.deliveredFixed === 'toolError' });
  if (declaration?.fixedDelivered) checks.push({ name: `server-returned-fixed-${declaration.fixedDelivered}`, passed: row.deliveredFixed === declaration.fixedDelivered });
  if (declaration?.dispatch === false) checks.push({ name: 'tool-not-dispatched', passed: row.dispatched === false });
  if (row.benignUnchanged !== undefined) checks.push({ name: 'benign-delivered-unchanged', passed: row.benignUnchanged });
  if (row.differsFromWholeResult !== undefined) checks.push({ name: 'every-partition-equals-whole-result', passed: row.differsFromWholeResult === 0 });
  if (row.producersNotClosed !== undefined) checks.push({ name: 'producer-closed-on-abort', passed: row.producersNotClosed === 0 });
  const producer = row.producer;
  if (producer?.chunks !== undefined && producer.pulled !== undefined) {
    checks.push({ name: 'stopped-pulling-early', passed: producer.pulled < producer.chunks }, { name: 'producer-closed', passed: (producer.closed ?? 0) >= 1 });
  }
  if (producer?.destroyed !== undefined) checks.push({ name: 'readable-destroyed-early', passed: producer.destroyed && (producer.read ?? 0) < (producer.chunks ?? Infinity) });
  if (row.serverStream && row.id.includes('block')) checks.push({ name: 'server-producer-closed', passed: row.serverStream.closed >= 1 });
  if (row.serverStream && row.area === 'cancellation') checks.push({ name: 'server-producer-closed-on-cancel', passed: row.serverStream.closed >= 1 });

  const { id, area, expect, observed, exclusion, policyDelivers: _p, delivered: _d, deliveredFixed: _f, ...rest } = row;
  const observations = Object.fromEntries(Object.entries(rest).filter(([key]) => !['threw'].includes(key)));
  return {
    id, area, expected: expect, observed, containment, sinks, checks,
    conforms: checks.every(c => c.passed) && containment !== 'leak',
    ...(exclusion ? { exclusion } : {}),
    ...(Object.keys(observations).length > 0 ? { observations } : {}),
  };
}

export interface CellSummary {
  readonly cases: number;
  readonly controlsDetected: number;
  readonly leaks: number;
  readonly knownFalseNegatives: number;
  readonly deliveredByPolicy: number;
  readonly deviations: number;
}

export function summarizeCell(verdicts: readonly CaseVerdict[]): CellSummary {
  return {
    cases: verdicts.length,
    controlsDetected: verdicts.filter(v => v.containment === 'control-detected').length,
    leaks: verdicts.filter(v => v.containment === 'leak').length,
    knownFalseNegatives: verdicts.filter(v => v.containment === 'known-false-negative').length,
    deliveredByPolicy: verdicts.filter(v => v.containment === 'delivered-by-policy').length,
    deviations: verdicts.filter(v => v.checks.some(c => !c.passed)).length,
  };
}

/** Throws if `text` (a report about to be written) carries any synthetic value or fragment. */
export function assertNoPlaintext(text: string, secrets: readonly string[]): void {
  const hit = scanText(text, needles(secrets));
  if (hit.fragment) throw new Error('mcp-qualification: the report would carry synthetic plaintext; refusing to write it');
}

// ---------------------------------------------------------------------------
// Overhead helpers
// ---------------------------------------------------------------------------

export function nearestRank(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

export function median(values: readonly number[]): number {
  return nearestRank(values, 0.5);
}
