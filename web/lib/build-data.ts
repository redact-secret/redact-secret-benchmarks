'use client';

/**
 * The one place the browser may fetch. Decision:
 * docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md.
 *
 * Allowed: a same-origin GET of a JSON file the build emitted under `<basePath>/data/`
 * (`lib/data-paths.ts` lists the shapes). Nothing else: no other origin, no ledger or API
 * call, no credentials, no user data. `scripts/check-no-sx.mjs` fails a `fetch` anywhere but
 * here, and fails this file if the single `fetch` is not `fetch(dataUrl(...), ...)` or if it
 * names another origin.
 *
 * Loads are cached in memory for the session (a revisit or a second view of the same file
 * is synchronous), the in-flight request is shared, and a failure is never cached, so
 * `retry` asks again. Components never import this: a page-level client wrapper does, and
 * hands the loaded data to pure blocks as props.
 */
import { useCallback, useEffect, useState } from 'react';
import { BUILD_DATA_PATH, DATA_DIR } from './data-paths';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** The URL of a build-emitted data file. Throws for any path the build does not emit. */
export function dataUrl(path: string): string {
  if (!BUILD_DATA_PATH.test(path)) throw new Error(`Not a build-emitted data path: ${path}`);
  return `${BASE_PATH}/${DATA_DIR}/${path}`;
}

/** Why a load failed, in words a page can show: no connection, the file is not there, the file is not what was built. */
export type LoadFailure = 'offline' | 'unavailable' | 'invalid';

export class BuildDataError extends Error {
  /** `status` is the HTTP status when the host answered, so a missing file (404) can be told from a network failure. */
  constructor(readonly failure: LoadFailure, message: string, readonly status?: number) {
    super(message);
    this.name = 'BuildDataError';
  }
}

const settled = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Test hook: forget every loaded file and in-flight request, as a fresh page load would. */
export function resetBuildData(): void {
  settled.clear();
  inflight.clear();
}

/** A file already loaded this session, without a request. */
export const peekBuildData = <T>(path: string): T | undefined => settled.get(path) as T | undefined;

/** Load a data file once per session. `check` is the shape guard for what the build wrote. */
export function loadBuildData<T>(path: string, check: (value: unknown) => value is T): Promise<T> {
  if (settled.has(path)) return Promise.resolve(settled.get(path) as T);
  const shared = inflight.get(path);
  if (shared) return shared as Promise<T>;
  const request = fetch(dataUrl(path), { method: 'GET', credentials: 'omit', mode: 'same-origin', referrerPolicy: 'no-referrer' })
    .then(async response => {
      if (!response.ok) throw new BuildDataError('unavailable', `${path}: HTTP ${response.status}`, response.status);
      let body: unknown;
      try { body = await response.json(); } catch { throw new BuildDataError('invalid', `${path}: not JSON`); }
      if (!check(body)) throw new BuildDataError('invalid', `${path}: unexpected shape`);
      settled.set(path, body);
      return body;
    })
    .catch((error: unknown) => {
      if (error instanceof BuildDataError) throw error;
      throw new BuildDataError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable', `${path}: request failed`);
    })
    .finally(() => { inflight.delete(path); });
  inflight.set(path, request);
  return request;
}

/** Start a load nobody is waiting on yet (a hover, an idle moment). A failure is ignored here and surfaces when the data is needed. */
export function warmBuildData<T>(path: string, check: (value: unknown) => value is T): void {
  loadBuildData(path, check).catch(() => {});
}

export interface BuildDataState<T> {
  /** `idle`: not asked for yet. `loading`: a request is out. `ready`: `data` is here. `error`: `failure` says why; `retry` asks again. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | undefined;
  failure: LoadFailure | undefined;
  retry: () => void;
}

type Idle = { cancel: () => void };
/** Run `work` when the browser is idle, or soon after on one that has no idle callback. */
function whenIdle(work: () => void): Idle {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(work, { timeout: 2500 });
    return { cancel: () => window.cancelIdleCallback(handle) };
  }
  const handle = window.setTimeout(work, 300);
  return { cancel: () => window.clearTimeout(handle) };
}

const saveData = (): boolean => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/**
 * Load a build-emitted file for a component. `path` null asks for nothing. `when: 'now'`
 * starts the request on mount; `'idle'` waits for an idle moment (and, on a data-saver
 * connection, for the page to switch to `'now'`, e.g. on first interaction). A file
 * already in the session cache is `ready` on the first render, with no request.
 */
export function useBuildData<T>(path: string | null, check: (value: unknown) => value is T, when: 'now' | 'idle' = 'now'): BuildDataState<T> {
  const [outcome, setOutcome] = useState<{ path: string; failure?: LoadFailure } | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    if (settled.has(path)) {
      // The file landed after this render read the cache (a hover warmed it) and before this effect ran: redraw with it.
      rerender(n => n + 1);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      setOutcome(null);
      setStarted(path);
      loadBuildData(path, check).then(
        () => { if (!cancelled) rerender(n => n + 1); },
        (error: unknown) => { if (!cancelled) setOutcome({ path, failure: error instanceof BuildDataError ? error.failure : 'unavailable' }); },
      );
    };
    let idle: Idle | undefined;
    if (when === 'now') run();
    else if (!saveData()) idle = whenIdle(run);
    return () => { cancelled = true; idle?.cancel(); };
    // `check` is a module-level guard; it never changes for a path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, when, attempt]);

  const retry = useCallback(() => {
    setOutcome(null);
    setAttempt(n => n + 1);
  }, []);

  const data = path ? (settled.get(path) as T | undefined) : undefined;
  const failure = path && outcome?.path === path ? outcome.failure : undefined;

  // A failure because the connection was down clears itself when the connection comes back.
  useEffect(() => {
    if (failure !== 'offline') return undefined;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failure, retry]);

  const status: BuildDataState<T>['status'] = !path ? 'idle' : data !== undefined ? 'ready' : failure ? 'error' : started === path ? 'loading' : 'idle';
  return { status, data, failure, retry };
}
