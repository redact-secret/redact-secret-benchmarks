import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SQUARE_ROLES, KNOWN_PREFIXES, REVOCATION_REMINDER, measureSquareStructure, parseSquareIssuanceArgs, pendingRecords,
  runSquareIssuanceCheck, upsertRecord, SquareIssuanceError,
} from '../benchmarks/support/square-issuance.ts';
import { validateEmpiricalObservations } from '../benchmarks/support/empirical.ts';

// Every value here is synthetic filler built at run time from repeated characters: no realistic Square key literal exists
// in this file, and nothing in it is, or was derived from, a real credential.
const filler = (n, alphabet) => Array.from({ length: n }, (_, i) => alphabet[(i * 7 + 3) % alphabet.length]).join('');
const URLSAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const meta = role => ({ role, observedAt: '2026-10-05', issuedAt: '2026-10-05', issuanceRoute: 'Square Developer Console (maintainer-issued)', subjectId: 'subject-test', revokedAfterObservation: true });

const sample = {
  'access-token': 'EAAA' + filler(60, URLSAFE),
  'sandbox-access-token': 'EAAA' + filler(60, URLSAFE),
  'refresh-token': 'EQAA' + filler(60, URLSAFE),
  'oauth-secret-production': 'sq0csp-' + filler(44, URLSAFE),
  'oauth-secret-sandbox': 'sandbox-sq0csb-' + filler(43, URLSAFE),
};

/** No 8-character slice of the value appears in `text`: neither the value nor a fragment leaked. */
const bodyOf = value => value.slice((KNOWN_PREFIXES.find(p => value.startsWith(p)) ?? '').length);
const leaks = (text, value) => { const body = bodyOf(value); for (let i = 0; i + 8 <= body.length; i += 1) if (text.includes(body.slice(i, i + 8))) return true; return false; };

const capture = async (args, value) => {
  let out = '', err = '';
  const code = await runSquareIssuanceCheck(args, { readSecret: async () => value, stdout: { write: s => { out += s; return true; } }, stderr: { write: s => { err += s; return true; } } });
  return { code, out, err };
};
const args = (role, extra = []) => [`--role=${role}`, '--issued-at=2026-10-05', '--revoked-after-observation=true', ...extra];

test('every role records structure only and never the value', async () => {
  for (const [role, value] of Object.entries(sample)) {
    const { code, out, err } = await capture(args(role), value);
    assert.equal(code, 0, role);
    assert.equal(leaks(out + err, value), false, `${role}: the value or a fragment of it reached stdout or stderr`);
    const record = JSON.parse(out);
    assert.equal(record.rawValueRetained, false);
    assert.equal(record.observation.rawValueRetained, false);
    assert.equal(record.observation.structure.totalLength, value.length);
    assert.equal(record.structure.totalLength, value.length);
    assert.equal(record.revocationReminder, REVOCATION_REMINDER);
    assert.match(err, /Revoke or rotate/);
    assert.ok(KNOWN_PREFIXES.includes(record.structure.prefixClass), role);
  }
});

test('the observation is an empirical observation the repository validates', () => {
  for (const [role, value] of Object.entries(sample)) {
    const { observation } = measureSquareStructure(value, meta(role));
    assert.doesNotThrow(() => validateEmpiricalObservations({
      schemaVersion: 1,
      families: [{ family: SQUARE_ROLES[role].family, mode: 'shape', supportsBareValues: false, uncertainty: 'capture-validation', supportedContexts: ['capture-validation'], observations: [observation], corroboration: [], contradictions: [] }],
    }), role);
  }
});

test('the claimed shapes match at their claimed widths and the conflicting widths are reported as unclaimed', () => {
  const claimed = (value, role) => measureSquareStructure(value, meta(role)).claimedShapes.filter(s => s.matches).map(s => s.shape.split(':')[0] + ':' + s.shape.split(': ')[1].split(' ')[0]);
  assert.equal(measureSquareStructure(sample['access-token'], meta('access-token')).claimedShapes.filter(s => s.matches).length, 1);
  assert.equal(claimed(sample['oauth-secret-production'], 'oauth-secret-production').length, 1);
  // 43 and 44 both claim for sq0csp-; 42 and 45 do not and read as unclaimed.
  for (const n of [43, 44]) assert.equal(measureSquareStructure('sq0csp-' + filler(n, URLSAFE), meta('oauth-secret-production')).claimedShapes.some(s => s.matches), true, `sq0csp- ${n}`);
  for (const n of [42, 45]) {
    const r = measureSquareStructure('sq0csp-' + filler(n, URLSAFE), meta('oauth-secret-production'));
    assert.equal(r.claimedShapes.some(s => s.matches), false, `sq0csp- ${n}`);
    assert.equal(r.unclaimedShapes.some(s => s.matches && /sq0csp- outside/.test(s.shape)), true, `sq0csp- ${n}`);
  }
  // EAAA 60 is claimed; EAAA 59 (63 in all) is not, and EAAl + 59 / EQAA + 60 name the provider's other examples.
  assert.equal(measureSquareStructure('EAAA' + filler(59, URLSAFE), meta('access-token')).claimedShapes.some(s => s.matches), false);
  assert.equal(measureSquareStructure('EAAl' + filler(59, URLSAFE), meta('access-token')).unclaimedShapes.some(s => s.matches && /EAAl/.test(s.shape)), true);
  assert.equal(measureSquareStructure(sample['refresh-token'], meta('refresh-token')).unclaimedShapes.some(s => s.matches && /EQAA/.test(s.shape)), true);
  assert.equal(measureSquareStructure('sandbox-sq0csb-' + filler(44, URLSAFE), meta('oauth-secret-sandbox')).claimedShapes.some(s => s.matches), false);
});

test('special characters and alphabet classes are recorded, and an unknown prefix records no prefix text', () => {
  const r = measureSquareStructure('EAAA' + filler(58, URLSAFE) + '+=', meta('access-token'));
  assert.deepEqual(r.structure.specialCharacters.filter(c => ['plus', 'equals'].includes(c)).sort(), ['equals', 'plus']);
  assert.equal(r.claimedShapes.some(s => s.matches), false, 'a + or = body is outside the claimed alphabet');
  const unknown = measureSquareStructure('zz9' + filler(40, URLSAFE), meta('access-token'));
  assert.equal(unknown.structure.prefixClass, 'other');
  assert.equal(unknown.observation.structure.prefix, null);
  assert.equal(unknown.structure.bodyLength, null);
});

test('the value is read from stdin only: a bare word, an unknown flag and a value-carrying flag are refused without being echoed', async () => {
  const secret = sample['access-token'];
  for (const bad of [[secret], [`--value=${secret}`], [`--token=${secret}`], ['--role=access-token', '--issued-at=2026-10-05', secret]]) {
    const { code, out, err } = await capture(bad, secret);
    assert.equal(code, 1);
    assert.equal(out, '');
    assert.equal(leaks(err, secret), false);
    assert.match(err, /invalid-arguments-the-value-is-read-from-stdin-only|unknown-role/);
  }
  assert.throws(() => parseSquareIssuanceArgs([]), SquareIssuanceError);
  assert.throws(() => parseSquareIssuanceArgs(['--role=nope', '--issued-at=2026-10-05']), /unknown-role/);
});

test('an invalid credential or date fails with a code only', async () => {
  for (const [value, extra] of [['has space', []], ['', []], ['EAAA' + filler(60, URLSAFE), ['--observed-at=not-a-date']]]) {
    const { code, out, err } = await capture(args('access-token', extra), value);
    assert.equal(code, 1);
    assert.equal(out, '');
    assert.match(err, /check failed: [a-z-]+\./);
    if (value.length > 8) assert.equal(leaks(err, value), false);
  }
});

test('the committed records are pending for every role, hold no value and match the role list', async () => {
  const records = JSON.parse(await readFile(new URL('../benchmarks/support/issuance-records/square.json', import.meta.url), 'utf8'));
  assert.deepEqual(records, pendingRecords());
  assert.equal(records.rawValueRetained, false);
  assert.deepEqual(records.roles.map(r => r.role), Object.keys(SQUARE_ROLES));
  for (const role of records.roles) { assert.equal(role.status, 'pending issuance by the maintainer'); assert.equal(role.result, null); }
  assert.doesNotMatch(JSON.stringify(records), /EAAA[A-Za-z0-9_-]{20}|sq0csp-[A-Za-z0-9_-]{20}|sq0csb-[A-Za-z0-9_-]{20}/);
});

test('--record replaces only the role slot and keeps rawValueRetained false', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'square-issuance-'));
  try {
    const file = path.join(dir, 'square.json');
    await writeFile(file, `${JSON.stringify(pendingRecords(), null, 2)}\n`);
    const value = sample['oauth-secret-production'];
    const { code } = await capture(args('oauth-secret-production', [`--record=${file}`]), value);
    assert.equal(code, 0);
    const text = await readFile(file, 'utf8');
    assert.equal(leaks(text, value), false);
    const records = JSON.parse(text);
    const slot = records.roles.find(r => r.role === 'oauth-secret-production');
    assert.equal(slot.status, 'observed');
    assert.equal(slot.observation.rawValueRetained, false);
    assert.equal(records.roles.filter(r => r.status === 'pending issuance by the maintainer').length, 4);
    await upsertRecord(file, measureSquareStructure(value, meta('oauth-secret-production')));
    assert.equal(JSON.parse(await readFile(file, 'utf8')).roles.length, 5);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the kit never reads the value from argv, the environment or a file', async () => {
  const source = await readFile(new URL('../benchmarks/support/square-issuance.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /process\.argv/);
  assert.doesNotMatch(source, /console\.(log|error|warn)/);
  const cli = await readFile(new URL('../scripts/measure-square-issuance.ts', import.meta.url), 'utf8');
  assert.match(cli, /process\.argv\.slice\(2\)/);
  assert.doesNotMatch(cli, /process\.env/);
});
