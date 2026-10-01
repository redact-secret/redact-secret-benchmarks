/**
 * `lib/build-data.ts`: the one place the browser fetches. Each test gets a fresh module, so the
 * session cache and the in-flight table start empty. Requests are a stubbed `fetch`; no network.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type Lib = typeof import('../../lib/build-data');
const isNumbers = (value: unknown): value is { n: number[] } => typeof value === 'object' && value !== null && Array.isArray((value as { n?: unknown }).n);
const PATH = 'rows/level/T1/rows.json';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let lib: Lib;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  lib = await import('../../lib/build-data');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('dataUrl', () => {
  test('puts a build-emitted path under the base path and the data directory', () => {
    expect(lib.dataUrl(PATH)).toBe('/next/data/rows/level/T1/rows.json');
    expect(lib.dataUrl('fixtures/example-suite/records.json')).toBe('/next/data/fixtures/example-suite/records.json');
    expect(lib.dataUrl('comparison/accuracy/differences.json')).toBe('/next/data/comparison/accuracy/differences.json');
  });

  test.each(['https://evil.example/x.json', '../secrets.json', 'rows/level/T1/rows.json?x=1', 'rows/other/T1/rows.json', '/rows/level/T1/rows.json', ''])('refuses %j', path => {
    expect(() => lib.dataUrl(path)).toThrow('Not a build-emitted data path');
  });
});

describe('loadBuildData', () => {
  test('sends one same-origin GET with no credentials, and caches the answer for the session', async () => {
    fetchMock.mockResolvedValue(ok({ n: [1] }));
    await expect(lib.loadBuildData(PATH, isNumbers)).resolves.toEqual({ n: [1] });
    expect(fetchMock).toHaveBeenCalledWith('/next/data/rows/level/T1/rows.json', { method: 'GET', credentials: 'omit', mode: 'same-origin', referrerPolicy: 'no-referrer' });
    expect(lib.peekBuildData(PATH)).toEqual({ n: [1] });
    await lib.loadBuildData(PATH, isNumbers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('two callers while a request is out share it', async () => {
    let release!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => { release = resolve; }));
    const first = lib.loadBuildData(PATH, isNumbers);
    const second = lib.loadBuildData(PATH, isNumbers);
    release(ok({ n: [] }));
    await expect(Promise.all([first, second])).resolves.toEqual([{ n: [] }, { n: [] }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('an HTTP error is "unavailable" and is not cached, so the next call asks again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await expect(lib.loadBuildData(PATH, isNumbers)).rejects.toMatchObject({ name: 'BuildDataError', failure: 'unavailable', message: `${PATH}: HTTP 404` });
    expect(lib.peekBuildData(PATH)).toBeUndefined();
    fetchMock.mockResolvedValueOnce(ok({ n: [2] }));
    await expect(lib.loadBuildData(PATH, isNumbers)).resolves.toEqual({ n: [2] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('a body that is not JSON is "invalid"', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(lib.loadBuildData(PATH, isNumbers)).rejects.toMatchObject({ failure: 'invalid', message: `${PATH}: not JSON` });
  });

  test('a body of another shape (a file from another build) is "invalid" and never cached', async () => {
    fetchMock.mockResolvedValue(ok({ other: true }));
    await expect(lib.loadBuildData(PATH, isNumbers)).rejects.toMatchObject({ failure: 'invalid', message: `${PATH}: unexpected shape` });
    expect(lib.peekBuildData(PATH)).toBeUndefined();
  });

  test('a network failure while the browser says it is offline is "offline"', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(lib.loadBuildData(PATH, isNumbers)).rejects.toMatchObject({ failure: 'offline' });
  });

  test('a network failure while the browser says it is online is "unavailable"', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(lib.loadBuildData(PATH, isNumbers)).rejects.toMatchObject({ failure: 'unavailable', message: `${PATH}: request failed` });
  });

  test('warmBuildData starts a load and swallows its failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(() => lib.warmBuildData(PATH, isNumbers)).not.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockResolvedValue(ok({ n: [3] }));
    lib.warmBuildData(PATH, isNumbers);
    await waitFor(() => expect(lib.peekBuildData(PATH)).toEqual({ n: [3] }));
  });
});

describe('useBuildData', () => {
  test('a null path asks for nothing', () => {
    const { result } = renderHook(() => lib.useBuildData(null, isNumbers));
    expect(result.current).toMatchObject({ status: 'idle', data: undefined, failure: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('"now" goes loading, then ready with the data', async () => {
    let release!: (response: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => { release = resolve; }));
    const { result } = renderHook(() => lib.useBuildData(PATH, isNumbers));
    await waitFor(() => expect(result.current.status).toBe('loading'));
    await act(async () => { release(ok({ n: [7] })); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ n: [7] });
  });

  test('a file already in the session cache is ready on the first render, with no request', async () => {
    fetchMock.mockResolvedValue(ok({ n: [1] }));
    await lib.loadBuildData(PATH, isNumbers);
    fetchMock.mockClear();
    const { result } = renderHook(() => lib.useBuildData(PATH, isNumbers));
    expect(result.current.status).toBe('ready');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a failure is an error with its reason, and retry asks again', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const { result } = renderHook(() => lib.useBuildData(PATH, isNumbers));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.failure).toBe('unavailable');
    fetchMock.mockResolvedValueOnce(ok({ n: [9] }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual({ n: [9] });
  });

  test('an offline failure retries by itself when the connection comes back', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => lib.useBuildData(PATH, isNumbers));
    await waitFor(() => expect(result.current.failure).toBe('offline'));
    fetchMock.mockResolvedValueOnce(ok({ n: [4] }));
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  test('"idle" waits for an idle callback, then loads', async () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (work: () => void) => callbacks.push(work));
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    fetchMock.mockResolvedValue(ok({ n: [5] }));
    const { result, unmount } = renderHook(() => lib.useBuildData(PATH, isNumbers, 'idle'));
    expect(result.current.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => callbacks[0]());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    unmount();
  });

  test('cancels a pending idle callback on unmount', () => {
    const cancel = vi.fn();
    vi.stubGlobal('requestIdleCallback', () => 42);
    vi.stubGlobal('cancelIdleCallback', cancel);
    const { unmount } = renderHook(() => lib.useBuildData(PATH, isNumbers, 'idle'));
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('without requestIdleCallback it falls back to a short timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    fetchMock.mockResolvedValue(ok({ n: [6] }));
    const { result, unmount } = renderHook(() => lib.useBuildData(PATH, isNumbers, 'idle'));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(result.current.status).toBeDefined();
  });

  test('without an idle callback, unmounting clears the timer so nothing loads', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const { unmount } = renderHook(() => lib.useBuildData(PATH, isNumbers, 'idle'));
    unmount();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('on a data-saver connection "idle" never loads until the page asks for "now"', async () => {
    vi.stubGlobal('requestIdleCallback', (work: () => void) => { work(); return 1; });
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    fetchMock.mockResolvedValue(ok({ n: [8] }));
    const { result, rerender } = renderHook(({ when }: { when: 'now' | 'idle' }) => lib.useBuildData(PATH, isNumbers, when), { initialProps: { when: 'idle' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    rerender({ when: 'now' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    Reflect.deleteProperty(navigator, 'connection');
  });

  test('a failed load does not set state after unmount', async () => {
    let fail!: (reason: unknown) => void;
    fetchMock.mockReturnValue(new Promise<Response>((_, reject) => { fail = reject; }));
    const { unmount } = renderHook(() => lib.useBuildData(PATH, isNumbers));
    unmount();
    await act(async () => { fail(new TypeError('x')); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
