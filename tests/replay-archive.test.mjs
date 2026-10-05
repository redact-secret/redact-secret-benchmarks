import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { extractVerified, isAppleDouble, pack, readTarEntries, sha256File } from '../scripts/replay-archive.mjs';

/** A hand-built ustar so the members are exactly what the test says, on any platform (macOS tar would add or hide `._*` itself). */
function tarball(members) {
  const blocks = [];
  for (const { name, data = '', type = '0', link = '' } of members) {
    const body = Buffer.from(data);
    const h = Buffer.alloc(512);
    h.write(name, 0); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124); h.write('00000000000\0', 136);
    h.write('        ', 148); h.write(type, 156); h.write(link, 157); h.write('ustar\0' + '00', 257);
    h.write(`${[...h].reduce((a, b) => a + b, 0).toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}
const CLEAN = [
  { name: 'policy-corpus/artifact.json', data: '{"a":1}' },
  { name: 'policy-corpus/run-record.json', data: '{"r":1}' },
  { name: 'public-evidence-snapshot/methods/artifact.json', data: '{"m":1}' },
];
const APPLE = [
  { name: 'policy-corpus/._artifact.json', data: 'AppleDouble junk' },
  CLEAN[0],
  { name: 'policy-corpus/._run-record.json', data: 'AppleDouble junk' },
  CLEAN[1],
  { name: 'public-evidence-snapshot/methods/._artifact.json', data: 'AppleDouble junk' },
  CLEAN[2],
];
const scratch = mkdtempSync(path.join(tmpdir(), 'replay-archive-test-'));
test.after(() => rmSync(scratch, { recursive: true, force: true }));
let n = 0;
function extract(members, raw) {
  const gz = raw ?? tarball(members);
  const file = path.join(scratch, `a${n}.tar.gz`); const out = path.join(scratch, `out${n++}`);
  writeFileSync(file, gz);
  extractVerified(file, out);
  return out;
}
const tree = (dir, base = dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tree(path.join(dir, e.name), base) : [[path.relative(base, path.join(dir, e.name)), readFileSync(path.join(dir, e.name), 'utf8')]]).sort();

test('AppleDouble members are skipped: same content as the clean archive, none extracted', () => {
  const clean = extract(CLEAN); const apple = extract(APPLE);
  assert.deepEqual(tree(apple), tree(clean));
  assert.equal(tree(apple).some(([f]) => path.basename(f).startsWith('._')), false);
  assert.equal(isAppleDouble('policy-corpus/._artifact.json'), true);
  assert.equal(isAppleDouble('policy-corpus/artifact.json'), false);
});

test('the digest covers the original bytes, AppleDouble members included, and a different archive has a different digest', () => {
  const a = path.join(scratch, 'd1.tar.gz'); const b = path.join(scratch, 'd2.tar.gz');
  writeFileSync(a, tarball(APPLE)); writeFileSync(b, tarball(CLEAN));
  assert.notEqual(sha256File(a), sha256File(b));
  assert.equal(readTarEntries(readFileSync(a)).length, APPLE.length);
});

test('real paths stay on the allowlist and the refusals still hold', () => {
  const refused = (members, pattern) => assert.throws(() => extract(members), pattern);
  refused([...APPLE, { name: 'policy-corpus/extra.json', data: '{}' }], /unexpected path/);
  refused([{ name: '../artifact.json', data: '{}' }], /unexpected path/);
  refused([{ name: 'a/../../artifact.json', data: '{}' }], /unexpected path/);
  refused([{ name: '/etc/artifact.json', data: '{}' }], /unexpected path/);
  refused([{ name: 'policy-corpus/artifact.json', type: '2', link: '/etc/passwd' }], /link or special/);
  refused([{ name: 'policy-corpus/artifact.json', type: '1', link: 'x' }], /link or special/);
  refused([CLEAN[0], ...APPLE], /duplicate path/);
  refused([{ name: 'policy-corpus/._link', type: '2', link: 'x' }, CLEAN[0]], /link or special/);
  refused([{ name: 'policy-corpus/._dir/', type: '5' }, CLEAN[0]], /unexpected path/);
  refused([{ name: '../._x', data: 'x' }], /unexpected path/);
});

test('an archive whose non-AppleDouble content differs extracts different content (and not the clean one)', () => {
  const other = extract([{ ...CLEAN[0], data: '{"a":2}' }, CLEAN[1], CLEAN[2]]);
  assert.notDeepEqual(tree(other), tree(extract(APPLE)));
});

test('nothing is extracted when any member is refused', () => {
  const file = path.join(scratch, 'partial.tar.gz'); const out = path.join(scratch, 'partial-out');
  writeFileSync(file, tarball([CLEAN[0], { name: 'evil.txt', data: 'x' }]));
  assert.throws(() => extractVerified(file, out), /unexpected path/);
  assert.throws(() => statSync(out));
});

test('pack writes no AppleDouble members and round-trips', () => {
  const input = path.join(scratch, 'in'); mkdirSync(path.join(input, 'policy-corpus'), { recursive: true });
  writeFileSync(path.join(input, 'policy-corpus/artifact.json'), '{"a":1}');
  writeFileSync(path.join(input, 'policy-corpus/ignored.txt'), 'x');
  const { tarball: tb, files } = pack({ input, out: path.join(scratch, 'packed') });
  assert.deepEqual(files, ['policy-corpus/artifact.json']);
  assert.deepEqual(readTarEntries(readFileSync(tb)).map(e => e.name), ['policy-corpus/artifact.json']);
  assert.deepEqual(tree(extract(null, readFileSync(tb))), [['policy-corpus/artifact.json', '{"a":1}']]);
});
