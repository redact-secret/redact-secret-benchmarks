/**
 * Fetch and verify the public evidence snapshot a registry pins (#699), for the view stage that derives the snapshot's product inputs.
 *
 *   node scripts/fetch-pinned-public-snapshot.mjs --out <dir>
 *
 * Downloads the release manifest and the snapshot asset of the floors population's pinned evidence release (skipped when both are already in <dir>), then
 * refuses unless the manifest digest is the pin's, the snapshot bytes are the ones the manifest lists, the release identity holds and the snapshot's corpus
 * digest is the pin's. The registry is the one on the checked-out commit: on a replay branch that is the candidate's pin, so the inputs are derived from
 * the exact snapshot the replay measured. Nothing is written outside <dir>.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SNAPSHOT_ASSET, releaseIdentityProblems } from './evidence-adoption.mjs';

const root = new URL('../', import.meta.url);

/** Pure: the problems of a downloaded release against a population pin (`pin.release.{tag,manifestDigest}`, `pin.corpusDigest`). */
export function pinnedSnapshotProblems({ pin, manifestBytes, snapshotBytes }) {
  const manifest = JSON.parse(manifestBytes), snapshot = JSON.parse(snapshotBytes);
  const problems = releaseIdentityProblems({ tag: pin.release.tag, expectedManifestDigest: pin.release.manifestDigest, manifestBytes, manifest, snapshotBytes, snapshot });
  if (snapshot.identity?.corpus_digest !== pin.corpusDigest) problems.push(`the snapshot is corpus ${snapshot.identity?.corpus_digest}, the registry pins ${pin.corpusDigest}`);
  return problems;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const at = process.argv.indexOf('--out');
  if (at < 0 || !process.argv[at + 1]) throw new Error('Usage: fetch-pinned-public-snapshot.mjs --out <dir>');
  const dir = path.resolve(process.argv[at + 1]);
  const registry = JSON.parse(readFileSync(new URL('benchmarks/official-runs.json', root), 'utf8'));
  const pin = registry.populations.find(p => p.id === 'public-evidence-snapshot').evidence;
  mkdirSync(dir, { recursive: true });
  if (!['release-manifest.json', SNAPSHOT_ASSET].every(f => existsSync(path.join(dir, f))))
    execFileSync('gh', ['release', 'download', pin.release.tag, '-R', 'redact-secret/credential-evidence', '-D', dir, '-p', 'release-manifest.json', '-p', SNAPSHOT_ASSET, '--clobber'], { stdio: 'inherit' });
  const problems = pinnedSnapshotProblems({ pin, manifestBytes: readFileSync(path.join(dir, 'release-manifest.json')), snapshotBytes: readFileSync(path.join(dir, SNAPSHOT_ASSET)) });
  if (problems.length) { console.error(`The downloaded ${pin.release.tag} is not the pinned snapshot:\n${problems.map(p => `  - ${p}`).join('\n')}`); process.exit(3); }
  console.log(`Verified ${pin.release.tag} (manifest ${pin.release.manifestDigest}, corpus ${pin.corpusDigest}) in ${dir}`);
}
