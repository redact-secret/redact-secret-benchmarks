/**
 * The MUI theme. It is limited to two jobs (docs/decisions/2026-09-30-...):
 * map design tokens onto MUI's palette, shape and typography, and set
 * component defaults. Visual styling of components is done with CSS Modules,
 * never here and never with `sx`.
 *
 * Colour schemes are emitted as CSS variables under `[data-theme="light|dark"]`,
 * the same attribute tokens.css and the existing site use, so the theme is
 * chosen before first paint by InitColorSchemeScript and never re-renders.
 */
import { createTheme } from '@mui/material/styles';
import { colorsFor } from './tokens';

export const THEME_ATTRIBUTE = 'data-theme';
/** Same key the existing site writes, so a saved choice carries across. */
export const THEME_STORAGE_KEY = 'redact-secret-benchmarks:theme';

function palette(scheme: 'light' | 'dark') {
  const c = colorsFor(scheme);
  return {
    primary: { main: c['link'], contrastText: c['surface'] },
    secondary: { main: c['ink-muted'], contrastText: c['surface'] },
    success: { main: c['status-success'] },
    warning: { main: c['status-warning'] },
    error: { main: c['status-danger'] },
    info: { main: c['status-info'] },
    text: { primary: c['ink'], secondary: c['ink-muted'] },
    background: { default: c['surface'], paper: c['surface'] },
    divider: c['line'],
  };
}

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: `[${THEME_ATTRIBUTE}="%s"]` },
  colorSchemes: { light: { palette: palette('light') }, dark: { palette: palette('dark') } },
  // Radius tokens: radius-sm is the default control radius.
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: 'var(--font-roboto)',
    h1: { fontFamily: 'var(--font-montserrat)' },
    h2: { fontFamily: 'var(--font-merriweather)' },
    h3: { fontFamily: 'var(--font-merriweather)' },
    button: { textTransform: 'none' },
  },
  components: {
    // Motion and elevation are not part of the design system.
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiPaper: { defaultProps: { elevation: 0, square: true } },
  },
});
