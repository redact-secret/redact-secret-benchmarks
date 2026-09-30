'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useColorScheme } from '@mui/material/styles';
import styles from './ThemeToggle.module.css';

type Mode = 'light' | 'dark' | 'system';
const OPTIONS: { value: Mode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Light, dark or follow the OS. MUI supplies the accessible group semantics and
 * keyboard handling; every visual is a class from ThemeToggle.module.css. The
 * saved mode is only known after mount, so nothing is marked selected until then
 * and the labels never change between server and client.
 */
export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  return (
    <ToggleButtonGroup
      className={styles.group}
      size="small"
      exclusive
      value={mode ?? null}
      aria-label="Color theme"
      onChange={(_, next: Mode | null) => { if (next) setMode(next); }}
    >
      {OPTIONS.map(o => (
        <ToggleButton key={o.value} className={styles.option} value={o.value}>{o.label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
