/**
 * The three pieces of `next/navigation` the app uses, backed by `window.location` so a test sets
 * the address with `history.replaceState` and renders. Import this file before the module under
 * test: `import './next-mocks'`.
 */
import { vi } from 'vitest';

export const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404';

vi.mock('next/navigation', () => ({
  useServerInsertedHTML: () => {},
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  notFound: () => {
    throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND });
  },
}));

/** Set the address bar the way a visit or a shared link would. */
export function visit(url: string): void {
  window.history.replaceState(null, '', url);
}
