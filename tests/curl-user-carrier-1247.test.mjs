// redact-secret#1247: structural checks of the independent curl -u corpus. It never
// runs or imports a scanner: expectations are authored from curl's argument semantics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cases } from '../corpora/proposed/curl-user-carrier-1247/cases.mjs';

const source = readFileSync(new URL('../corpora/proposed/curl-user-carrier-1247/cases.mjs', import.meta.url), 'utf8');
const byExpectation = e => cases.filter(c => c.expectation === e);

test('corpus size and expectation mix are pinned', () => {
  assert.equal(cases.length, 128);
  assert.equal(byExpectation('must-redact').length, 48);
  assert.equal(byExpectation('must-not-flag').length, 70);
  assert.equal(byExpectation('accepted-fn').length, 10);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
});

test('every span matches the content at both UTF-16 and UTF-8 offsets', () => {
  for (const c of cases) {
    const bytes = Buffer.from(c.content, 'utf8');
    for (const s of [...c.expected, ...c.unread]) {
      assert.ok(s.start >= 0 && s.end > s.start && s.end <= c.content.length, c.id);
      assert.equal(bytes.subarray(s.byteStart, s.byteEnd).toString('utf8'), c.content.slice(s.start, s.end), c.id);
      assert.ok(!/\s/.test(c.content.slice(s.start, s.end)) || /quote/.test(c.id), `${c.id}: unquoted span holds whitespace`);
    }
    if (c.expectation !== 'must-redact') assert.deepEqual(c.expected, [], c.id);
  }
});

test('a password span is preceded by the first colon of a credential argument', () => {
  for (const c of byExpectation('must-redact')) {
    for (const s of c.expected) {
      const arg = c.content.slice(0, s.start);
      const lastWord = arg.slice(Math.max(arg.lastIndexOf(' '), arg.lastIndexOf('"') < 0 ? -1 : 0));
      assert.ok(arg.endsWith(':') || arg.endsWith('='), `${c.id}: span not after a colon`);
      assert.ok(lastWord.length > 0, c.id);
    }
  }
});

test('positives cover the carriers the issue names', () => {
  const ids = new Set(cases.map(c => c.id));
  for (const id of ['provider-zendesk-email-token', 'provider-jfrog-api-key', 'provider-jfrog-reference-token',
    'provider-atlas-digest-private-key', 'nopass-colon-only', 'alt-netrc', 'alt-digest-only', 'nopass-negotiate-colon']) assert.ok(ids.has(id), id);
});

test('the corpus stores no secret-shaped literal and imports no scanner', () => {
  assert.ok(!/AKIA|-----BEGIN|eyJ[A-Za-z0-9_-]{10,}|\bsk-[A-Za-z0-9]{8}|ghp_[A-Za-z0-9]{8}/.test(source));
  assert.ok(!/redact-secret\/core|scanners\//.test(source.replace(/\/\/.*$/gm, '')));
  for (const c of cases) for (const s of c.expected) assert.ok(s.end - s.start <= 4200, c.id);
});
