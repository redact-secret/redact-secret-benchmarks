/**
 * Bounded part I/O for evaluation reports (#787, #788; contract: docs/specs/evaluation-report-storage.md).
 *
 * A report larger than one document is stored as parts: JSON Lines parts for the discovery store (one record per line) and JSON document parts for the public bundle. Every part has a byte
 * limit, a SHA-256 over its exact bytes and a record count that the manifest repeats, so a reader never trusts a part it has not checked. A single record larger than the limit is never
 * cut or dropped: it is stored alone in its own part, marked `oversized`. Writing respects backpressure; reading streams and never holds more than one part (or one oversized record).
 */
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

export const DEFAULT_MAX_PART_BYTES = 8 * 1024 * 1024;
export interface PartRef { path: string; sha256: string; bytes: number; records: number; oversized?: true }
export const sha256Of = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const SHA = /^[a-f0-9]{64}$/;
/** A manifest-relative part path: a plain relative path, no traversal, no absolute path, no empty segment. */
export const SAFE_PART_PATH = /^(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
export function partRefProblem(ref: unknown): string | null {
  const r = ref as PartRef;
  if (!r || typeof r.path !== 'string' || !SAFE_PART_PATH.test(r.path)) return 'Part path is not a plain relative path';
  if (!SHA.test(r.sha256) || !Number.isSafeInteger(r.bytes) || r.bytes < 0 || !Number.isSafeInteger(r.records) || r.records < 0) return `Part ${r.path} has an invalid digest, size or record count`;
  return null;
}

/** Appends JSON Lines records into parts of at most `maxPartBytes` under `dir`, hashing as it writes. One writer per role. */
export class JsonlPartWriter {
  private index = 0;
  private stream: WriteStream | null = null;
  private hash = createHash('sha256');
  private bytes = 0;
  private records = 0;
  private current = '';
  private oversized = false;
  /** Rejects when the open stream fails (a refused open, a full disk). Without it the error event is unhandled and a seal would wait forever. */
  private failed: Promise<never> | null = null;
  private failure: Error | null = null;
  readonly parts: PartRef[] = [];
  /** The largest single write, for the "maximum chunk size" evidence. */
  maxChunkBytes = 0;
  constructor(private readonly dir: string, private readonly role: string, private readonly maxPartBytes = DEFAULT_MAX_PART_BYTES, private readonly extension = 'jsonl') {
    if (!/^[a-z0-9-]+$/.test(role) || !Number.isSafeInteger(maxPartBytes) || maxPartBytes < 1024) throw new Error('Invalid part writer configuration');
  }
  private open() {
    this.current = `${this.role}-${String(this.index++).padStart(4, '0')}.${this.extension}`;
    this.stream = createWriteStream(path.join(this.dir, this.current), { flags: 'wx', mode: 0o600 });
    this.hash = createHash('sha256'); this.bytes = 0; this.records = 0; this.oversized = false;
    this.failed = new Promise<never>((_, reject) => this.stream!.once('error', error => { this.failure = error; reject(error); }));
    this.failed.catch(() => undefined); // observed by append/seal when they race it; never an unhandled rejection
  }
  private async seal() {
    const stream = this.stream;
    if (!stream) return;
    this.stream = null;
    if (this.failure) throw this.failure;
    stream.end();
    await Promise.race([once(stream, 'finish'), this.failed!]);
    this.parts.push({ path: this.current, sha256: this.hash.digest('hex'), bytes: this.bytes, records: this.records, ...(this.oversized ? { oversized: true as const } : {}) });
  }
  async append(record: unknown): Promise<void> {
    const line = `${JSON.stringify(record)}\n`, size = Buffer.byteLength(line);
    const alone = size > this.maxPartBytes;
    if (this.failure) throw this.failure;
    if (this.stream && (alone || this.bytes + size > this.maxPartBytes)) await this.seal();
    if (!this.stream) this.open();
    if (alone) this.oversized = true;
    this.hash.update(line); this.bytes += size; this.records += 1; this.maxChunkBytes = Math.max(this.maxChunkBytes, size);
    if (!this.stream!.write(line)) await Promise.race([once(this.stream!, 'drain'), this.failed!]); // backpressure
    if (this.failure) throw this.failure;
    if (alone) await this.seal();
  }
  async close(): Promise<PartRef[]> { await this.seal(); return this.parts; }
}

/** Streams the records of one JSON Lines part. The part's size and digest are checked as it is read; a mismatch or a record-count difference throws at the end, so consume the whole iterator. */
export async function* readJsonlPart<T = unknown>(dir: string, ref: PartRef): AsyncGenerator<T> {
  const problem = partRefProblem(ref);
  if (problem) throw new Error(problem);
  const file = path.join(dir, ref.path);
  if ((await stat(file)).size !== ref.bytes) throw new Error(`Part ${ref.path} is ${(await stat(file)).size} bytes, the manifest records ${ref.bytes}`);
  const hash = createHash('sha256'), stream = createReadStream(file);
  let seen = 0;
  stream.on('data', chunk => hash.update(chunk as Buffer));
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (!line) continue;
    seen += 1;
    yield JSON.parse(line) as T;
  }
  if (hash.digest('hex') !== ref.sha256) throw new Error(`Part ${ref.path} does not match its recorded digest`);
  if (seen !== ref.records) throw new Error(`Part ${ref.path} holds ${seen} records, the manifest records ${ref.records}`);
}

/** The bytes of a JSON document part: compact JSON and a newline. */
export const documentBytes = (document: unknown) => `${JSON.stringify(document)}\n`;

/** Reads one JSON document part, refusing a file whose size or digest is not the manifest's before parsing it. The read is bounded by the recorded size. */
export async function readDocumentPart<T = unknown>(dir: string, ref: PartRef, maxBytes: number): Promise<T> {
  const problem = partRefProblem(ref);
  if (problem) throw new Error(problem);
  if (ref.bytes > maxBytes && !ref.oversized) throw new Error(`Part ${ref.path} is ${ref.bytes} bytes, over the ${maxBytes}-byte limit, and is not marked oversized`);
  const file = path.join(dir, ref.path);
  if ((await stat(file)).size !== ref.bytes) throw new Error(`Part ${ref.path} is ${(await stat(file)).size} bytes, the manifest records ${ref.bytes}`);
  const bytes = await readFile(file);
  if (sha256Of(bytes) !== ref.sha256) throw new Error(`Part ${ref.path} does not match its recorded digest`);
  return JSON.parse(bytes.toString('utf8')) as T;
}
