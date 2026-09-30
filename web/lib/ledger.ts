/**
 * Build-time data loading. Server components call these while `next build`
 * renders the static export; nothing here ships to the browser and nothing in
 * `web/` fetches ledger data at runtime (scripts/check-no-sx.mjs enforces the
 * second half). The values are read from the ledger and report outputs the
 * existing pipeline already writes, never recomputed: per the boundary rule the
 * site displays what was recorded and asserts nothing about the product.
 *
 * Committed inputs are read with `readRequired` (a missing file fails the
 * build). Generated outputs that only exist after `npm run bench` and friends
 * (`public/results/*.json`) are read with `readOptional`, so CI can build the
 * export without measuring anything; a page shows "Not measured" for those.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');

async function readRequired<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8')) as T;
}

export async function readOptional<T>(relative: string): Promise<T | undefined> {
  try {
    return await readRequired<T>(relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Which package the numbers came from. Stable counts must always carry this. */
export type Mode = 'published' | 'candidate';

export interface LedgerSnapshot {
  mode: Mode;
  package: string;
  version: string;
  revision: string;
  providers: number;
  families: number;
  /** Families that name at least one detector; a count of records, not a claim about coverage quality. */
  familiesWithDetector: number;
}

interface PinManifest { pins: { redactSecretVersion: string; releaseSourceRevision: string } }
interface Taxonomy { providers: { id: string }[]; families: { id: string; detectors: string[] }[] }

/** The published-mode snapshot: the lockfile release, not a candidate build. */
export async function loadLedgerSnapshot(): Promise<LedgerSnapshot> {
  const [pins, taxonomy] = await Promise.all([
    readRequired<PinManifest>('benchmarks/pin-manifest.json'),
    readRequired<Taxonomy>('benchmarks/support/taxonomy.json'),
  ]);
  return {
    mode: 'published',
    package: '@redact-secret/core',
    version: pins.pins.redactSecretVersion,
    revision: pins.pins.releaseSourceRevision,
    providers: taxonomy.providers.length,
    families: taxonomy.families.length,
    familiesWithDetector: taxonomy.families.filter(f => f.detectors.length > 0).length,
  };
}
