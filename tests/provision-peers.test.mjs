import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checksumTableProblems, sha256, verifyArchive } from '../scripts/provision-peers.mjs';

const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url), 'utf8'));
const table = JSON.parse(await readFile(new URL('../scanners/peer-checksums.json', import.meta.url), 'utf8'));

test('checked-in checksums cover exactly the suite peer pins', () => {
  assert.deepEqual(checksumTableProblems(suite, table), []);
});

test('a suite pin bump without regenerated checksums fails', () => {
  const bumped = { ...suite, scanners: { ...suite.scanners, trufflehog: '3.97.6' } };
  assert.match(checksumTableProblems(bumped, table).join('\n'), /trufflehog 3\.97\.4.*pins 3\.97\.6/);
});

test('a checksum mismatch is rejected before extraction', () => {
  const asset = { archive: 'x.tar.gz', sha256: sha256(Buffer.from('good')) };
  assert.equal(verifyArchive('gitleaks', asset, Buffer.from('good')), asset.sha256);
  assert.throws(() => verifyArchive('gitleaks', asset, Buffer.from('tampered')), /Refusing to extract or run it/);
});
