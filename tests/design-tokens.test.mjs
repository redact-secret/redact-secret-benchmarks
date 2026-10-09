import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const system = JSON.parse(await read('shared/design-tokens/tokens.json'));
const tokensCss = await read('shared/design-tokens/tokens.css');

/** Declarations of one theme block, by selector prefix. */
function block(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing block ${selector}`);
  const open = css.indexOf('{', start), close = css.indexOf('}', open);
  return Object.fromEntries([...css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}
const light = block(tokensCss, ':root, [data-theme="light"]');
const dark = block(tokensCss, ':root[data-theme="dark"]');
const osDark = block(tokensCss, ':root:not([data-theme="light"])');
const shared = block(tokensCss, ':root {');
const resolve = (theme, name) => { let value = theme[name]; for (let i = 0; i < 4 && /^var\(/.test(value); i++) value = theme[/var\(--([a-z0-9-]+)\)/.exec(value)[1]]; return value; };

test('tokens.css carries every design-system token with the system value, in both themes', () => {
  assert.equal(system.color.tokens.length, 16, '8 base + 8 status colour tokens');
  for (const token of system.color.tokens) {
    for (const [theme, css] of [['light', light], ['dark', dark], ['dark', osDark]]) {
      const expected = token.value[theme].replace(/^\{(.+)\}$/, 'var(--$1)');
      assert.equal(css[token.name], expected, `${token.name} (${theme})`);
    }
  }
  for (const token of [...system.spacing.tokens, ...system.radius.tokens]) assert.equal(shared[token.name], token.value, token.name);
  for (const group of system.type.groups) for (const style of group.styles) {
    const family = style.family || group.family;
    assert.equal(shared[`text-${style.name}`], `${style.fontWeight} ${style.fontSize}/${style.lineHeight} var(--font-${family})`, style.name);
  }
  for (const [name, stack] of Object.entries(system.type.families)) {
    const first = /^["']([^"']+)["']/.exec(stack)[1];
    assert.ok(shared[`font-${name}`].startsWith(`"${first}"`), `${name} leads with the system family`);
    assert.match(shared[`font-${name}`], /Noto (Sans|Serif) KR/, `${name} has a Hangul fallback`);
  }
});

const channel = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** Every foreground/background pair the components actually paint. */
const TEXT_PAIRS = [
  ['ink', 'surface', 'body, headings, figures'],
  ['ink-muted', 'surface', 'secondary text, reference scanner rows, Not measured'],
  ['link', 'surface', 'links, EvidenceCrumb'],
  ['on-brand', 'brand-green', 'ByteView secret bytes'],
  ['surface', 'ink', 'command blocks, selected segment, active search option'],
  ...['success', 'warning', 'danger', 'info'].flatMap(s => [
    [`status-${s}`, 'surface', `status-${s} text`],
    [`status-${s}`, `status-${s}-fill`, `StatusMark ${s}`],
    ['ink', `status-${s}-fill`, `ink on ${s} fill`],
  ]),
];
const NON_TEXT_PAIRS = [
  ['focus', 'surface', 'focus ring'],
  ['ink-muted', 'surface', 'control borders, interval range, dashed Not measured border'],
  ['ink', 'surface', 'section rule, redaction bars, interval tick and triangle'],
  ['status-danger', 'surface', 'Failed border, failing health rule'],
  ['status-warning', 'surface', 'Unstable border'],
  ['status-danger', 'status-danger-fill', 'Failed border against its fill'],
  ['status-warning', 'status-warning-fill', 'Unstable hatch against its fill'],
];

test('text contrast is at least 4.5:1 and non-text at least 3:1 in both themes', () => {
  const report = [];
  for (const [name, theme] of [['light', light], ['dark', dark]]) {
    for (const [fg, bg, where] of TEXT_PAIRS) {
      const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
      report.push(`${name} ${fg} on ${bg}: ${ratio.toFixed(2)}`);
      assert.ok(ratio >= 4.5, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (${where})`);
    }
    for (const [fg, bg, where] of NON_TEXT_PAIRS) {
      const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
      report.push(`${name} ${fg} against ${bg}: ${ratio.toFixed(2)} (non-text)`);
      assert.ok(ratio >= 3, `${name}: ${fg} against ${bg} is ${ratio.toFixed(2)}:1 (${where})`);
    }
  }
  if (process.env.CONTRAST_REPORT) console.log(report.join('\n'));
});
