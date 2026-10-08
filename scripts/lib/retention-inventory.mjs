import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';

export const SCOPES = ['docs/', 'evidence/', 'scripts/', 'benchmarks/', 'baselines/', 'peer-observations/', 'src/', 'web/'];
const CODE = /\.(?:[cm]?[jt]sx?|py|sh|ya?ml|html|css)$/;
const TEXT = /\.(?:[cm]?[jt]sx?|py|sh|ya?ml|html|css|json|md|toml|txt)$/;
const IMPORT = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)(['"])([^'"\n]+)\1/g;
const QUOTED = /(['"`])([@\w./*?{}$-]{1,512})\1/g;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sorted = values => [...values].sort();

function role(path) {
  if (path.startsWith('docs/decisions/')) return ['decision-record', 'benchmarks governance', 'policy-or-owner-record'];
  if (path.startsWith('docs/specs/')) return ['canonical-contract', 'benchmarks governance', 'normative-contract'];
  if (path.startsWith('docs/generated/')) return ['generated-record', 'owning generator / issue', 'consumer-dependent'];
  if (path.startsWith('docs/reports/')) return ['report-record', 'owning measurement / issue', 'provenance-dependent'];
  if (path.startsWith('evidence/')) return ['evidence-record', `issue #${path.split('/')[1]}`, 'reproduction-or-historical-evidence'];
  if (path.startsWith('baselines/')) return ['release-anchor', 'benchmarks release measurement', 'comparison-input'];
  if (path.startsWith('peer-observations/')) return ['peer-observation', 'benchmarks peer measurement', 'rollback-and-comparison-input'];
  if (path === 'benchmarks/review-ledger.json') return ['review-ledger', 'benchmarks qualification policy', 'authoritative-policy'];
  if (path.startsWith('src/')) return ['legacy-site', 'benchmarks legacy oracle / shared design', 'oracle-or-shared-input'];
  if (path.startsWith('web/')) return ['current-site', 'benchmarks Next site', 'publication'];
  return [CODE.test(path) ? 'executable-source' : 'retained-input', 'benchmarks maintainers', 'consumer-dependent'];
}

function candidates(from, literal, known) {
  const base = literal.startsWith('.') ? posix.normalize(posix.join(posix.dirname(from), literal)) : literal;
  const bases = [base, ...(from.startsWith('web/') ? [posix.normalize(`web/${literal}`)] : [])];
  const out = new Set();
  for (const b of bases) {
    const stem = b.replace(/\.(?:m?js)$/, '');
    for (const p of [b, `${stem}.ts`, `${stem}.mts`, `${stem}.tsx`, `${b}.ts`, `${b}.tsx`, `${b}.mjs`, `${b}.js`, `${b}.json`, `${b}/index.ts`, `${b}/index.tsx`, `${b}/index.mjs`])
      if (known.has(p)) out.add(p);
  }
  return out;
}

// A missing static edge never proves that a computed path or an external consumer is absent.
export function analyzeFiles(files, { sourceCommit = null, remoteReferences = [] } = {}) {
  const known = new Set(files.map(f => f.path));
  const directories = new Map();
  for (const path of known) {
    let dir = posix.dirname(path);
    while (dir !== '.') {
      if (!directories.has(dir)) directories.set(dir, []);
      directories.get(dir).push(path);
      dir = posix.dirname(dir);
    }
  }
  const incoming = new Map(files.map(f => [f.path, new Map()]));
  const dynamicReaders = [];
  const byBasename = new Map();
  for (const f of files) {
    const name = posix.basename(f.path);
    if (!byBasename.has(name)) byBasename.set(name, []);
    byBasename.get(name).push(f.path);
  }
  const add = (from, to, via) => {
    if (from === to) return;
    const edges = incoming.get(to);
    if (!edges) return;
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from).add(via);
  };
  for (const from of [...files, ...remoteReferences]) {
    const text = from.text ?? (TEXT.test(from.path) ? from.bytes.toString('utf8') : '');
    if (!text) continue;
    if (CODE.test(from.path) && /(?:readFile|readdir|glob|require|import)\s*\([^)]*(?:\$\{|\+|\b(?:path|file|dir|target|name)\b)/.test(text))
      dynamicReaders.push(from.path);
    for (const m of text.matchAll(IMPORT)) for (const target of candidates(from.path, m[2], known)) add(from.path, target, 'import');
    const literals = [...text.matchAll(QUOTED)].map(m => m[2]);
    // Unquoted paths cover shell/npm commands, workflow invocations, Markdown and JSON pins.
    literals.push(...(text.match(/[\w@.\/-]+\/[\w@.*?{}\/-]+/g) ?? []));
    for (const literal of new Set(literals)) {
      for (const target of candidates(from.path, literal, known)) add(from.path, target, 'literal-path');
      const prefix = literal.split(/\$\{|[*?{]/)[0].replace(/\/$/, '');
      const prefixes = [prefix, ...(prefix.startsWith('.') ? [posix.normalize(posix.join(posix.dirname(from.path), prefix))] : []), ...(from.path.startsWith('web/') ? [`web/${prefix}`] : [])];
      for (const p of prefixes) for (const target of directories.get(p) ?? []) add(from.path, target, 'directory-or-computed-prefix');
      if (!literal.includes('/') && byBasename.has(literal))
        for (const target of byBasename.get(literal)) add(from.path, target, 'basename-possible');
    }
  }
  const entries = files.map(f => {
    const [classification, owner, authoritativeRole] = role(f.path);
    const callers = [...incoming.get(f.path)].map(([path, via]) => ({ path, via: sorted(via), active: CODE.test(path) || /(?:package|tsconfig).*\.json$/.test(path) })).sort((a, b) => a.path.localeCompare(b.path));
    return {
      path: f.path, size: f.bytes.length, sha256: sha256(f.bytes), class: classification, owner,
      ownerStatus: 'inferred-from-surface; file-level review required', authoritativeRole, callers,
      candidateDisposition: callers.some(c => c.active) ? 'retain-active-consumers' : 'review-before-removal',
      blockingPrerequisites: ['computed/indirect readers require scoped review', 'external repository pins and GitHub references require review', 'durable preservation and verified retrieval required', ...(classification === 'legacy-site' ? ['legacy-site oracle / shared-consumer retirement gate'] : []), ...(f.path.includes('/domains/pii/') ? ['independent PII oracle exit and rollback gate'] : [])],
      accessClass: f.path.startsWith('evidence/') ? 'unverified; never automatically publish payload' : 'tracked-public-metadata',
    };
  });
  return {
    schemaVersion: 1, sourceCommit, removesNothing: true,
    coverage: { trackedFiles: files.length, inventoriedFiles: entries.length, scannedSources: files.filter(f => TEXT.test(f.path)).length, externalReferences: remoteReferences.map(r => r.path), dynamicReaders: sorted(new Set(dynamicReaders)), limitations: ['Static candidate edges are conservative, not a proof of runtime reachability.', 'Computed filenames and outside-repository readers cannot be resolved by this scan.', 'No file is approved for deletion by absence of an edge.'] },
    summary: { files: entries.length, bytes: entries.reduce((n, e) => n + e.size, 0), scopedFiles: entries.filter(e => SCOPES.some(s => e.path.startsWith(s))).length, byScope: Object.fromEntries([...SCOPES, 'other'].map(s => [s, { files: entries.filter(e => s === 'other' ? !SCOPES.some(p => e.path.startsWith(p)) : e.path.startsWith(s)).length, bytes: entries.filter(e => s === 'other' ? !SCOPES.some(p => e.path.startsWith(p)) : e.path.startsWith(s)).reduce((n, e) => n + e.size, 0) }])) },
    entries,
  };
}

export function applyReaderMigrations(files, migrations, readAfter) {
  const byPath = new Map(files.map(file => [file.path, file]));
  const reviewed = new Map();
  for (const row of migrations) {
    const original = byPath.get(row.path);
    if (reviewed.has(row.path) || !/^docs\/(?:decisions|reports)\/[\w./-]+\.md$/.test(row.path) || row.path.split('/').includes('..') ||
        !original || !/^[a-f0-9]{64}$/.test(row.afterSha256 ?? '') || row.sourceSha256 !== sha256(original.bytes) ||
        !row.owner || !row.issue || !row.reason?.trim()) throw new Error('Invalid checksum-bound historical reader migration');
    const after = readAfter(row.path);
    if (sha256(after) !== row.afterSha256) throw new Error(`Historical reader migration bytes differ: ${row.path}`);
    reviewed.set(row.path, after.toString('utf8'));
  }
  // Keep original inventories/hashes; only the reviewed documentation's edges use current bytes.
  return files.map(file => reviewed.has(file.path) ? { ...file, text: reviewed.get(file.path) } : file);
}

export function inventoryAt(root, ref = null, remoteReferences = [], readerMigrations = []) {
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
  const paths = git(ref ? ['ls-tree', '-r', '--name-only', '-z', ref] : ['ls-files', '-z']).toString().split('\0').filter(Boolean);
  const files = paths.map(path => ({ path, bytes: ref ? git(['show', `${ref}:${path}`]) : lstatSync(resolve(root, path)).isSymbolicLink() ? Buffer.from(readlinkSync(resolve(root, path))) : readFileSync(resolve(root, path)) }));
  if (readerMigrations.length && !ref) throw new Error('Reader migrations require an original source ref');
  const reviewed = applyReaderMigrations(files, readerMigrations, file => {
    const location = resolve(root, file);
    if (!lstatSync(location).isFile() || lstatSync(location).isSymbolicLink()) throw new Error('Historical reader must be a regular file');
    return readFileSync(location);
  });
  const inventory = analyzeFiles(reviewed, { sourceCommit: git(['rev-parse', `${ref ?? 'HEAD'}^{commit}`]).toString().trim(), remoteReferences });
  inventory.coverage.reviewedReaderMigrations = readerMigrations;
  return inventory;
}

export function removalDryRun(inventory, manifest = { entries: [] }) {
  const byPath = new Map(inventory.entries.map(e => [e.path, e]));
  const requested = new Set(manifest.entries.map(e => e.path));
  if (requested.size !== manifest.entries.length) throw new Error('duplicate removal path');
  const errors = [];
  const reachable = new Set();
  const queue = [...requested];
  const reviews = new Map(manifest.entries.map(e => [e.path, e.review?.excludedCallers ?? []]));
  const excluded = (target, caller) => reviews.get(target)?.some(e => e.path === caller.path && typeof e.reason === 'string' && e.reason.trim() && caller.via.every(v => ['directory-or-computed-prefix', 'basename-possible'].includes(v)) && JSON.stringify(sorted(e.via ?? [])) === JSON.stringify(sorted(caller.via)));
  while (queue.length) {
    const target = queue.pop();
    for (const caller of byPath.get(target)?.callers ?? []) {
      if (excluded(target, caller)) continue;
      if (reachable.has(caller.path)) continue;
      reachable.add(caller.path);
      if (caller.active && !requested.has(caller.path)) errors.push(`${target}: reachable active consumer: ${caller.path}`);
      if (byPath.has(caller.path)) queue.push(caller.path);
    }
  }
  for (const row of manifest.entries) {
    const entry = byPath.get(row.path);
    if (!entry) { errors.push(`${row.path}: not inventoried`); continue; }
    if (row.sha256 !== entry.sha256) errors.push(`${row.path}: content digest changed`);
    const active = entry.callers.filter(c => c.active && !requested.has(c.path) && !excluded(row.path, c));
    if (active.length) errors.push(`${row.path}: active consumers: ${active.map(c => c.path).join(', ')}`);
    if (!row.review?.dynamicReaders || !row.review?.externalReferences || !row.review?.authorityGates)
      errors.push(`${row.path}: scoped dynamic/external/authority review missing`);
    if (!row.preservation?.ref || row.preservation.sha256 !== entry.sha256 || !row.preservation.verifiedAt)
      errors.push(`${row.path}: verified durable preservation missing`);
    if (!row.owner || !row.issue) errors.push(`${row.path}: owning issue / reviewer missing`);
  }
  return { removesNothing: true, removablePaths: errors.length ? [] : sorted(requested), totalBytes: errors.length ? 0 : manifest.entries.reduce((n, e) => n + byPath.get(e.path).size, 0), reachableDependencies: sorted(reachable), errors };
}

export function renderInventory(inventory) {
  return `# Retention inventory\n\nSource: ${inventory.sourceCommit}. Read-only; no deletion approval is inferred.\n\n${inventory.summary.files} tracked files, ${inventory.summary.bytes} bytes (${inventory.summary.scopedFiles} in the eight cleanup surfaces).\n\nComputed readers, external pins and issue references require explicit scoped review. JSON carries every caller and prerequisite.\n\n| Path | Bytes | Class | Disposition | Callers |\n| --- | ---: | --- | --- | ---: |\n${inventory.entries.map(e => `| \`${e.path}\` | ${e.size} | ${e.class} | ${e.candidateDisposition} | ${e.callers.length} |`).join('\n')}\n`;
}
