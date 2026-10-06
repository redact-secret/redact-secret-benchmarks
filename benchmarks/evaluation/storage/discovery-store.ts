/**
 * The discovery results store (#787): `results-output/evaluation/` instead of one `results-output/evaluation.json` string.
 *
 * Layout: `header.json` (every field of the discovery report except the three record lists), `results-NNNN.jsonl`, `failures-NNNN.jsonl`, `review-queue-NNNN.jsonl` (bounded JSON Lines parts, a
 * record per line) and `manifest.json`, written last: the completion marker. The store is staged in a sibling directory and moved into place only after the manifest exists, so a reader
 * that finds `manifest.json` has a complete store and an interrupted write leaves no store. Nothing is sampled, truncated or reordered; counts, digests and sizes in the manifest are re-checked
 * on read. A pre-existing single-file report is still readable through the same interface (`openDiscovery`), by the explicit legacy path; it never triggers a scanner run.
 * This bounds serialization and reading; it does not make evaluation execution bounded: the runner still retains the generated inputs, the observations and the assembled results.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MAX_PART_BYTES, JsonlPartWriter, documentBytes, partRefProblem, readDocumentPart, readJsonlPart, sha256Of, type PartRef } from './parts.ts';

export const DISCOVERY_STORE_SCHEMA = 'redact-secret/evaluation-discovery-store/v1';
const LISTS = ['results', 'failures', 'reviewQueue'] as const;
type List = (typeof LISTS)[number];
const ROLE: Record<List, string> = { results: 'results', failures: 'failures', reviewQueue: 'review-queue' };
const MAX_MANIFEST_BYTES = 1024 * 1024;

export interface DiscoveryStoreManifest {
  schema: typeof DISCOVERY_STORE_SCHEMA; storageVersion: 1; maxPartBytes: number;
  header: PartRef; parts: Record<List, PartRef[]>; totals: Record<List, number>;
  /** Largest single write while writing: evidence that no unit exceeded the part limit except an oversized record. */
  maxChunkBytes: number;
}
export interface DiscoveryReader<H = Record<string, unknown>> {
  kind: 'store' | 'legacy-file';
  header(): Promise<H>;
  results<T = unknown>(): AsyncIterable<T>;
  failures<T = unknown>(): AsyncIterable<T>;
  reviewQueue<T = unknown>(): AsyncIterable<T>;
  totals: Record<List, number>;
}

/** Writes the store for an assembled discovery report. Replaces an existing store atomically enough to leave either the old or the new one complete (the old one is moved aside first). */
export async function writeDiscoveryStore(dir: string, report: Record<string, unknown> & { runId: string; results: unknown[]; failures: unknown[]; reviewQueue: unknown[] },
  { maxPartBytes = DEFAULT_MAX_PART_BYTES }: { maxPartBytes?: number } = {}): Promise<DiscoveryStoreManifest> {
  const staging = `${dir}.${report.runId}.staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    const { results, failures, reviewQueue, ...header } = report;
    const headerBytes = documentBytes(header);
    await writeFile(path.join(staging, 'header.json'), headerBytes, { mode: 0o600 });
    const parts = {} as Record<List, PartRef[]>, totals = {} as Record<List, number>;
    let maxChunkBytes = Buffer.byteLength(headerBytes);
    for (const list of LISTS) {
      const writer = new JsonlPartWriter(staging, ROLE[list], maxPartBytes);
      for (const record of report[list]) await writer.append(record);
      parts[list] = await writer.close();
      totals[list] = report[list].length;
      maxChunkBytes = Math.max(maxChunkBytes, writer.maxChunkBytes);
    }
    const manifest: DiscoveryStoreManifest = { schema: DISCOVERY_STORE_SCHEMA, storageVersion: 1, maxPartBytes,
      header: { path: 'header.json', sha256: sha256Of(headerBytes), bytes: Buffer.byteLength(headerBytes), records: 1 }, parts, totals, maxChunkBytes };
    await writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 }); // the completion marker, last
    const aside = `${dir}.${report.runId}.replaced`;
    const existing = await stat(dir).then(() => true, () => false);
    if (existing) await rename(dir, aside);
    await rename(staging, dir);
    if (existing) await rm(aside, { recursive: true, force: true });
    return manifest;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export function discoveryManifestProblem(value: unknown): string | null {
  const m = value as DiscoveryStoreManifest;
  if (m?.schema !== DISCOVERY_STORE_SCHEMA || m.storageVersion !== 1 || !Number.isSafeInteger(m.maxPartBytes)) return 'Unsupported discovery store manifest';
  const headerProblem = partRefProblem(m.header);
  if (headerProblem) return headerProblem;
  const names = new Set<string>([m.header.path]);
  for (const list of LISTS) {
    if (!Array.isArray(m.parts?.[list]) || !Number.isSafeInteger(m.totals?.[list])) return `Discovery store manifest lacks ${list}`;
    let records = 0;
    for (const ref of m.parts[list]) {
      const problem = partRefProblem(ref);
      if (problem) return problem;
      if (names.has(ref.path)) return `Part ${ref.path} is listed twice`;
      names.add(ref.path);
      if (ref.bytes > m.maxPartBytes && !(ref.oversized && ref.records === 1)) return `Part ${ref.path} exceeds the part limit and is not a single oversized record`;
      records += ref.records;
    }
    if (records !== m.totals[list]) return `Discovery store ${list} parts hold ${records} records, the manifest records ${m.totals[list]}`;
  }
  return null;
}

/** Opens a discovery report: a store directory, or (the explicit legacy path) a single JSON file read whole. */
export async function openDiscovery<H = Record<string, unknown>>(location: string): Promise<DiscoveryReader<H>> {
  const info = await stat(location);
  if (info.isFile()) {
    const whole = JSON.parse(await readFile(location, 'utf8')) as Record<string, unknown> & { results: unknown[]; failures: unknown[]; reviewQueue: unknown[] };
    const { results, failures, reviewQueue, ...header } = whole;
    const iterate = <T>(list: unknown[]) => (async function* () { yield* list as T[]; })();
    return { kind: 'legacy-file', header: async () => header as H, results: <T>() => iterate<T>(results), failures: <T>() => iterate<T>(failures), reviewQueue: <T>() => iterate<T>(reviewQueue),
      totals: { results: results.length, failures: failures.length, reviewQueue: reviewQueue.length } };
  }
  const manifestFile = path.join(location, 'manifest.json');
  const manifestStat = await stat(manifestFile).catch(() => null);
  if (!manifestStat) throw new Error(`${location} has no manifest.json: the discovery store is incomplete or was never finished`);
  if (manifestStat.size > MAX_MANIFEST_BYTES) throw new Error('Discovery store manifest is implausibly large');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as DiscoveryStoreManifest;
  const problem = discoveryManifestProblem(manifest);
  if (problem) throw new Error(problem);
  const records = <T>(list: List) => (async function* () { for (const ref of manifest.parts[list]) yield* readJsonlPart<T>(location, ref); })();
  return { kind: 'store', header: () => readDocumentPart<H>(location, manifest.header, Math.max(manifest.maxPartBytes, manifest.header.bytes)),
    results: <T>() => records<T>('results'), failures: <T>() => records<T>('failures'), reviewQueue: <T>() => records<T>('reviewQueue'), totals: manifest.totals };
}

/** Rebuilds the whole report object from a reader. Bounded only by the report size: for tests and small selections, never the large discovery path. */
export async function materializeDiscovery(reader: DiscoveryReader): Promise<Record<string, unknown>> {
  const collect = async (iterable: AsyncIterable<unknown>) => { const out: unknown[] = []; for await (const item of iterable) out.push(item); return out; };
  return { ...(await reader.header()), results: await collect(reader.results()), failures: await collect(reader.failures()), reviewQueue: await collect(reader.reviewQueue()) };
}
