/**
 * What the repository records about the scanners the benchmark ran with, beyond what they found (#612):
 * how each version is pinned, how it was installed, the configuration it ran with and where it was observed.
 * Everything is read from committed files and validated before a page may show it:
 *
 *  - pins: `qualification/suite-v1.json` (Gitleaks, TruffleHog, redact-secret) and `package.json` (the npm packages),
 *    with the registry integrity hash from `package-lock.json`;
 *  - install: `scanners/peer-checksums.json`, the SHA-256 of each pinned release archive that
 *    `scripts/provision-peers.mjs` checks before it extracts or runs anything;
 *  - configuration and observation: the committed peer snapshots (`peer-observations/**`), each validated with
 *    `validateSnapshot` (schema, shape and content digest). The page summarises them; when every snapshot agrees
 *    that is one line, and any disagreement is kept so the page can list it;
 *  - redact-secret's own adapter configuration: `scanners/index.mjs`, the module the benchmark runs.
 *
 * Nothing here ranks a scanner or reads what it found. A fact a file does not carry is absent, never guessed.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { scanners as adapters } from '../../scanners/index.mjs';
import { PEER_IDS } from '../../benchmarks/lib/peer-rule-families';
import { validateSnapshot } from '../../benchmarks/lib/peer-observations';
import { once, readJson, readJsonIfPresent, REPO_ROOT } from './repo';

export const PRODUCT = 'redact-secret';
const SNAPSHOTS = 'peer-observations';

export interface PinFacts {
  /** The pinned version, or `null` when the pin file does not name this scanner. */
  version: string | null;
  /** The file that pins it. */
  file: 'qualification/suite-v1.json' | 'package.json';
}

export interface ArchiveFact { platform: string; archive: string; sha256: string }

export interface SnapshotFacts {
  /** Snapshots that validated, and snapshots that did not (never read further). */
  count: number;
  invalid: number;
  observedFrom: string;
  observedTo: string;
  platforms: string[];
  versions: string[];
  modes: string[];
  configurationHashes: string[];
  artifactDigests: string[];
  /** The digest of the installed artifact per snapshot (a release archive's SHA-256 for a binary), and its platform. */
  observed: { platform: string; digest: string }[];
  /** Distinct replay counts, and whether every snapshot recorded that its replays agreed. */
  replayCounts: number[];
  /** The configuration of the first snapshot read, as recorded. */
  configuration: Record<string, unknown>;
}

export interface ScannerSource {
  id: string;
  pin: PinFacts;
  /** The npm package the scanner is installed from, with what the lockfile holds for it. */
  npm: { name: string; lockedVersion: string | null; integrity: string | null } | null;
  /** The release archive each platform's binary comes from; `null` for an npm package. */
  release: { repo: string; archives: ArchiveFact[] } | null;
  /** `null` when no committed snapshot exists for this scanner (the product is run fresh and has none). */
  snapshots: SnapshotFacts | null;
  /** The adapter configuration the benchmark runs the scanner with (the product only; a peer's is in its snapshots). */
  adapter: Record<string, unknown> | null;
}

/** Where a scanner's observation facts come from: the committed peer snapshots (the legacy pipeline) or the official run's own record (the new pipeline). */
export type EnvironmentSource = 'snapshots' | 'official';

export interface ScannerEnvironment { sources: ScannerSource[]; suiteId: string; source: EnvironmentSource }

interface Suite { id: string; scanners: Record<string, string> }
interface Checksums { [id: string]: unknown }
interface Lock { packages: Record<string, { version?: string; integrity?: string }> }
interface PackageFile { dependencies?: Record<string, string> }

const NPM: Record<string, string> = { [PRODUCT]: '@redact-secret/core', 'flare-redact': 'flare-redact', openredaction: '@openredaction/core' };

async function snapshotFiles(id: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try { entries = await readdir(path.join(REPO_ROOT, dir), { withFileTypes: true }); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const next = `${dir}/${entry.name}`;
      // A directory may be a symlink (a checkout that links a shared store, the unit tests' overlay).
      const directory = entry.isDirectory() || (entry.isSymbolicLink() && (await stat(path.join(REPO_ROOT, next))).isDirectory());
      if (directory) await walk(next);
      else if (entry.name === `${id}.json`) found.push(next);
    }
  };
  await walk(SNAPSHOTS);
  return found.sort();
}

const distinct = <T,>(values: T[]): T[] => [...new Set(values)];

async function summariseSnapshots(id: string): Promise<SnapshotFacts | null> {
  const files = await snapshotFiles(id);
  if (files.length === 0) return null;
  const valid: ReturnType<typeof validateSnapshot>[] = [];
  let invalid = 0;
  for (const file of files) {
    try { valid.push(validateSnapshot(await readJson<unknown>(file))); } catch { invalid++; }
  }
  if (valid.length === 0) return null;
  const dates = valid.map(s => s.observedAt).sort();
  return {
    count: valid.length,
    invalid,
    observedFrom: dates[0],
    observedTo: dates[dates.length - 1],
    platforms: distinct(valid.map(s => s.peer.observedArtifact.platform)).sort(),
    versions: distinct(valid.map(s => s.peer.version)).sort(),
    modes: distinct(valid.map(s => s.peer.mode)).sort(),
    configurationHashes: distinct(valid.map(s => s.peer.configurationHash)).sort(),
    artifactDigests: distinct(valid.map(s => s.peer.artifactDigest)).sort(),
    observed: distinct(valid.map(s => `${s.peer.observedArtifact.platform} ${s.peer.observedArtifact.digest}`)).sort().map(v => { const [platform, digest] = v.split(' '); return { platform, digest }; }),
    replayCounts: distinct(valid.map(s => s.replay.count)).sort((a, b) => a - b),
    configuration: valid[0].peer.configuration,
  };
}

/**
 * `official` reads no peer snapshot: under the new authority the observation facts of a scanner (version, mode, build, configuration hash, the run
 * and population it was observed in) are the official run's, added by the resolver from the measured run. The pins, the npm lock and the archive
 * checksums are product-owned inputs both pipelines read.
 */
export function loadScannerEnvironment(source: EnvironmentSource = 'snapshots'): Promise<ScannerEnvironment> {
  return once(`scanner-environment:${source}`, async () => {
    const [suite, pkg, lock, checksums] = await Promise.all([
      readJson<Suite>('qualification/suite-v1.json'),
      readJson<PackageFile>('package.json'),
      readJsonIfPresent<Lock>('package-lock.json'),
      readJson<Checksums>('scanners/peer-checksums.json'),
    ]);
    const sources: ScannerSource[] = [];
    for (const id of [PRODUCT, ...PEER_IDS]) {
      const name = NPM[id];
      const pinned = suite.scanners[id];
      const pin: PinFacts = pinned !== undefined
        ? { version: pinned, file: 'qualification/suite-v1.json' }
        : { version: name ? (pkg.dependencies?.[name] ?? null) : null, file: 'package.json' };
      const locked = name ? lock?.packages[`node_modules/${name}`] : undefined;
      const table = checksums[id] as { repo?: string; binary?: string; assets?: Record<string, { archive: string; sha256: string }> } | undefined;
      const adapter = id === PRODUCT ? (adapters.find(a => a.id === id)?.configuration ?? null) : null;
      sources.push({
        id,
        pin,
        npm: name ? { name, lockedVersion: locked?.version ?? null, integrity: locked?.integrity ?? null } : null,
        release: table?.binary && table.assets && table.repo
          ? { repo: table.repo, archives: Object.entries(table.assets).map(([platform, a]) => ({ platform, archive: a.archive, sha256: a.sha256 })) }
          : null,
        snapshots: id === PRODUCT || source === 'official' ? null : await summariseSnapshots(id),
        adapter,
      });
    }
    return { sources, suiteId: suite.id, source };
  });
}
