/**
 * The one place the web app reads design-system tokens from.
 *
 * Next and the retained Vite oracle share the vendored files in
 * shared/design-tokens/. The root design-token test guards their values;
 * tests/web-tokens.test.mjs guards their use by this app.
 */
import system from '../../shared/design-tokens/tokens.json';

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
