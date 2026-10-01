/**
 * Shared plumbing for the services: where the repository is, how a file is read
 * and how a load is memoised. Server-only: it uses `node:fs`, so a client
 * component that imports it fails the build.
 *
 * `REPO_ROOT` is the parent of `web/`, the working directory of `next build`.
 * The unit tests (web/tests/unit) run from web/, so this default is the repository root;
 * a test that needs another tree sets `WEB_REPO_ROOT` (tests/unit/overlay.ts).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const REPO_ROOT = process.env.WEB_REPO_ROOT ?? path.resolve(process.cwd(), '..');

export async function readJson<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relative), 'utf8')) as T;
}

/** The parsed file, or `undefined` when it does not exist. Any other failure (unreadable, invalid JSON) throws. */
export async function readJsonIfPresent<T>(relative: string): Promise<T | undefined> {
  try {
    return await readJson<T>(relative);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

const held = new Map<string, Promise<unknown>>();

/**
 * Run `load` once per build (per process) for `key`. Pages that render in
 * parallel share one read. A failed load is not kept, so a retry reads again.
 */
export function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = held.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = load().catch(error => {
      held.delete(key);
      throw error;
    });
    held.set(key, promise);
  }
  return promise;
}

/** Test hook: forget every memoised load. */
export function resetServices(): void {
  held.clear();
}
