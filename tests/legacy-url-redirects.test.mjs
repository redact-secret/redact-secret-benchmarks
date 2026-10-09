import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseRoute } from '../benchmarks/shared/report-model.mjs';
import { SECTIONS } from '../web/lib/routes.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const table = JSON.parse(readFileSync(path.join(root, 'benchmarks/legacy-url-redirects.json'), 'utf8'));

/** The routes of the Next export: the static entries of the navigation, the landing page, and every dynamic route found under web/app. */
function exportRoutes() {
  const statics = new Set(['/', ...SECTIONS.flatMap(s => s.entries.map(e => e.href))]);
  const dynamic = [];
  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) { if (entry.name !== 'data') walk(path.join(dir, entry.name), [...segments, entry.name]); continue; }
      if (entry.name !== 'page.tsx') continue;
      const route = `/${segments.join('/')}${segments.length ? '/' : ''}`;
      if (segments.some(s => s.startsWith('['))) dynamic.push(route); else statics.add(route);
    }
  };
  walk(path.join(root, 'web/app'), []);
  return { statics, dynamic: dynamic.map(r => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`)) };
}
const routes = exportRoutes();
const isRoute = pathname => routes.statics.has(pathname) || routes.dynamic.some(re => re.test(pathname));

/** The reference implementation of the table that the edge function must reproduce. Returns the target or null. */
function resolve(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const prefix = new RegExp(table.retiredPrefix.match).exec(clean);
  const subject = prefix ? (prefix.groups.rest ?? '/') : clean;
  const stripped = subject.replace(/\/+$/, '') || '/';
  if (table.kept.some(k => k.path === stripped)) return stripped;
  for (const rule of table.rules) {
    const match = new RegExp(rule.match).exec(stripped);
    if (match) return rule.to.replace(/\{(\w+)\}/g, (_, name) => match.groups[name]);
  }
  return null;
}

test('the table is well formed: unique ids, anchored patterns that compile, every {name} of a target is a group of its pattern', () => {
  assert.equal(table.schema, 'redact-secret/legacy-url-redirects/v1');
  assert.equal(table.status, 301);
  const ids = table.rules.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const rule of [...table.rules, table.retiredPrefix]) {
    assert.match(rule.match, /^\^.*\$$/, `${rule.id ?? 'retiredPrefix'} is anchored`);
    const re = new RegExp(rule.match);
    const groups = new Set([...rule.match.matchAll(/\(\?<(\w+)>/g)].map(m => m[1]));
    for (const [, name] of rule.to.matchAll(/\{(\w+)\}/g)) assert.ok(groups.has(name), `${rule.id ?? 'retiredPrefix'}: {${name}} is not a group`);
    assert.ok(re instanceof RegExp);
    if (rule.decision !== undefined) assert.ok(rule.decision.length > 10, `${rule.id ?? 'retiredPrefix'} records its decision`);
  }
});

test('canonical coverage pages are kept before the legacy detector-id rule', () => {
  for (const domain of ['credential', 'pii']) {
    assert.equal(resolve(`/coverage/${domain}`), `/coverage/${domain}`);
    assert.equal(resolve(`/coverage/${domain}/`), `/coverage/${domain}`);
    assert.equal(resolve(`/next/coverage/${domain}/`), `/coverage/${domain}`);
  }
  assert.equal(resolve('/coverage/example-detector'), '/report/detectors/example-detector/');
  assert.equal(resolve('/coverage'), '/report/families/');
});

test('every target is a route of the Next export', () => {
  assert.ok(routes.statics.has('/report/') && routes.statics.has('/evaluation/qualification/'), 'the route list was read');
  for (const rule of table.rules) {
    const target = rule.to.split('?')[0].replace(/\{\w+\}/g, 'x');
    assert.ok(isRoute(target), `${rule.id}: ${rule.to} is not a route of the export`);
    assert.ok(target.endsWith('/'), `${rule.id}: ${rule.to} must be a directory page`);
  }
  for (const kept of table.kept) assert.ok(isRoute(kept.path.endsWith('/') ? kept.path : `${kept.path}/`) || kept.path === '/', `${kept.path} is kept and must exist`);
});

test('every path the legacy router serves is answered, and a legacy redirect ends where the table sends it (two recorded exceptions)', () => {
  const served = [
    '/report', '/coverage', '/support', '/support/providers', '/evaluation/credentials', '/evaluation/pii', '/performance', '/how-to-read',
    '/coverage/detectors/x', '/coverage/some-provider:some-family', '/scenarios/x', '/suites/x', '/fixture/some-suite--some-fixture',
    '/workbench', '/workbench/changes', '/workbench/qualification', '/workbench/review/x', '/workbench/method/twin', '/workbench/method/holdout',
  ];
  const redirected = [
    '/benchmark', '/benchmark/x', '/coverage/x', '/coverage-gaps', '/methodology', '/pending', '/evaluation', '/evaluation/reviews', '/evaluation/failures',
    '/evaluation/operators', '/evaluation/method/twin', '/evaluation/detector/x',
  ];
  // Deliberate: the legacy router chose a detector or a suite from its suite list, and sent /evaluation to /evaluation/credentials; the new site has an
  // evaluation hub and the edge function has no suite list.
  const DIVERGES = new Set(['/benchmark/x', '/evaluation']);
  for (const p of served) {
    assert.notEqual(parseRoute(p).kind, 'missing', `${p} is a legacy route`);
    const target = resolve(p);
    assert.ok(target, `${p} has no answer`);
    assert.ok(isRoute(target.split('?')[0]) || target === '/', `${p} -> ${target} is not a route`);
  }
  for (const p of redirected) {
    const legacy = parseRoute(p);
    assert.equal(legacy.kind, 'redirect', `${p} is a legacy redirect`);
    const target = resolve(p);
    assert.ok(target && isRoute(target.split('?')[0]), `${p} -> ${target}`);
    if (!DIVERGES.has(p)) assert.equal(target, resolve(legacy.to), `${p} must end where its legacy redirect (${legacy.to}) ends`);
  }
});

test('an unknown method id and an unknown path are not answered', () => {
  assert.equal(parseRoute('/workbench/method/nope').kind, 'missing');
  assert.equal(resolve('/workbench/method/nope'), null);
  assert.equal(resolve('/evaluation/method/nope'), null);
  assert.equal(resolve('/no-such-page'), null);
});

test('the fixture rule splits at the first double hyphen and keeps the rest as the fixture id', () => {
  assert.equal(resolve('/fixture/common-formats--aws-key--v2'), '/report/corpus/common-formats/?fixture=aws-key--v2');
  assert.equal(resolve('/coverage/github:fine-grained-pat'), '/report/families/github--fine-grained-pat/');
});

test('the former fixture directory and suite addresses map to Credential Corpus', () => {
  assert.equal(resolve('/report/fixtures/'), '/report/corpus/');
  assert.equal(resolve('/report/fixtures/common-formats/'), '/report/corpus/common-formats/');
  assert.equal(resolve('/report/fixtures/not/a/suite'), null);
  assert.equal(resolve('/evaluation/scanner/'), '/comparison/scanner/');
});

test('the retired /next/ prefix is stripped and the rest is answered once', () => {
  assert.equal(resolve('/next'), '/');
  assert.equal(resolve('/next/'), '/');
  assert.equal(resolve('/next/report/'), '/report/');
  assert.equal(resolve('/next/coverage'), '/report/families/');
  assert.equal(resolve('/nextish'), null);
});

test('/ is the landing page and is not redirected', () => {
  assert.ok(table.kept.some(k => k.path === '/'));
  assert.equal(resolve('/'), '/');
  assert.equal(table.rules.some(r => new RegExp(r.match).test('/')), false);
});
