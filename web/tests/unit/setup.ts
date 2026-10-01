import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

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
