/** Canonical metadata and sitemap must name real static pages, never old aliases. */
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../out/', import.meta.url));
const origin = 'https://benchmarks.redactsecret.dev';
const pages = ['/coverage/credential/', '/coverage/pii/', '/evaluation/credential/', '/evaluation/pii/', '/evaluation/pii/results/'];
const xml = await readFile(`${out}sitemap.xml`, 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(urls).size, urls.length, 'sitemap URLs must be unique');
for (const page of pages) {
  const html = await readFile(`${out}${page.slice(1)}index.html`, 'utf8');
  assert.ok(html.includes(`<link rel="canonical" href="${origin}${page}"`), `${page} canonical metadata`);
  assert.ok(urls.includes(`${origin}${page}`), `${page} sitemap entry`);
}
for (const value of urls) {
  const url = new URL(value);
  assert.equal(url.origin, origin);
  assert.equal(url.search + url.hash, '');
  assert.ok(!/^\/report\/fixtures(?:\/|$)|^\/evaluation\/scanner(?:\/|$)/.test(url.pathname), 'compatibility aliases are not canonical');
  await access(`${out}${url.pathname.slice(1)}index.html`);
}
console.log(`canonical export: ${pages.length} focused entrances and ${urls.length} real sitemap pages`);
