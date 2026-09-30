import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkHeader, findHeaderViolations, CANONICAL } from '../web/scripts/check-header.mjs';

const web = new URL('../web/', import.meta.url);
const good = {
  logos: Object.fromEntries(await Promise.all(Object.keys(CANONICAL).map(async n => [n, await readFile(new URL(`public/${n}`, web))]))),
  tsx: await readFile(new URL('components/shell/SiteHeader.tsx', web), 'utf8'),
  css: await readFile(new URL('components/shell/SiteHeader.module.css', web), 'utf8'),
};
const rules = input => findHeaderViolations({ ...good, ...input }).map(p => p.rule);

test('the header as committed passes every rule', async () => {
  assert.deepEqual(await checkHeader(web.pathname), []);
});

test('a changed logo file is not the canonical asset', () => {
  const edited = Buffer.from(good.logos['logo-light.svg'].toString('utf8').replace('#AAD816', '#00ff00'));
  assert.deepEqual(rules({ logos: { ...good.logos, 'logo-light.svg': edited } }), ['canonical-asset']);
  assert.deepEqual(rules({ logos: { 'logo-dark.svg': good.logos['logo-dark.svg'] } }), ['canonical-asset']);
});

test('the header must render both files and draw nothing itself', () => {
  assert.deepEqual(rules({ tsx: good.tsx.replace('/logo-dark.svg', '/logo-dark.png') }), ['header-logo', 'header-logo']);
  assert.ok(rules({ tsx: `${good.tsx}\nconst m = <svg><path d="M0 0" /></svg>;` }).includes('header-logo'));
});

test('header CSS takes tokens only and never stretches the logo', () => {
  assert.ok(rules({ css: good.css.replace('var(--brand-green)', '#AAD816') }).includes('header-tokens'));
  assert.ok(rules({ css: good.css.replace('var(--space-6)', '24px') }).includes('header-tokens'));
  assert.ok(rules({ css: good.css.replace('width: var(--logo-w);', 'width: 64px;') }).includes('header-tokens'));
  assert.ok(rules({ css: good.css.replace('height: auto;', 'height: var(--header-h);') }).includes('header-tokens'));
  assert.ok(rules({ css: good.css.replace('.link {', '.link {\n    color: red !important;') }).includes('header-tokens'));
});
