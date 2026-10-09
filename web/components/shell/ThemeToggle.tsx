'use client';

import { useColorScheme } from '@mui/material/styles';
import styles from './ThemeToggle.module.css';

const NEXT = { light: 'dark', dark: 'light' } as const;
const LABEL = { light: 'Light', dark: 'Dark' };

/** One keyboard stop switches between light and dark; MUI persists the choice. */
export function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const current = mode === 'dark' || (mode === 'system' && systemMode === 'dark') ? 'dark' : 'light';
  const label = `Color theme: ${LABEL[current]}. Switch to ${LABEL[NEXT[current]]}`;
  return (
    <button type="button" className={styles.option} aria-label={label} title={label} data-mode={current} disabled={!mode} onClick={() => setMode(NEXT[current])}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {current === 'light' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />}
      </svg>
    </button>
  );
}
