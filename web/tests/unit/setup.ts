import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { overlay } from './overlay';

// Every test reads the repository through a root pinned to the legacy pipeline unless it names another root (an overlay that chooses
// the authority, or a stub of WEB_REPO_ROOT): the committed authority is what flips at the switch, and the tests of the pages, the
// services and the legacy data path must not move with it (#608). The tests of the new path choose `new` explicitly.
process.env.WEB_REPO_ROOT = overlay({});

// A cold runner renders a whole page (real corpora, real resolvers) in the first findBy: give it room
// instead of retrying the suite. A passing assertion returns at once, so this costs nothing when green.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  // Node-environment files (the services) have no DOM to clean.
  if (typeof document === 'undefined') return;
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  window.history.replaceState(null, '', '/');
});
