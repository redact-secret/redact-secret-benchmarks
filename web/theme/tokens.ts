/**
 * The one place the web app reads design-system tokens from.
 *
 * Until cutover the vendored copy lives in the existing site's `src/`
 * (guarded by tests/design-tokens.test.mjs there). At cutover the old UI is
 * removed and this import moves with the file; nothing else in `web/` imports
 * tokens.json, so that is a one-line change. #544 adds the token drift test for
 * `web/`.
 */
import system from '../../src/tokens.json';

type Theme = 'light' | 'dark';
interface ColorToken { name: string; value: Record<Theme, string> }

const colorTokens = system.color.tokens as ColorToken[];

/** Resolve `{other-token}` references within one theme. */
export function colorsFor(theme: Theme): Record<string, string> {
  const raw = Object.fromEntries(colorTokens.map(t => [t.name, t.value[theme]]));
  const resolve = (value: string, depth = 0): string => {
    const ref = /^\{(.+)\}$/.exec(value);
    if (!ref) return value;
    if (depth > 4 || !(ref[1] in raw)) throw new Error(`Unresolvable token reference ${value}`);
    return resolve(raw[ref[1]], depth + 1);
  };
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, resolve(value)]));
}
