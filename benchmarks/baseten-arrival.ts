import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { buildBasetenArrival, validateBasetenArrival, BASETEN_CONTRACT } from '../fixtures/generated/baseten-arrival.mjs';
import { score } from './scoring/scoring.ts';
import { encodeOutcome } from './scoring/lattice.ts';
import { accountGroups, validateAccounting } from './accounting/index.ts';
import suite from '../qualification/suite-v1.json';
import type { Fixture, Finding, AccountingConfig } from './types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const hashFile = async (file: string) => digest(await readFile(file));
export function parseBasetenInputs(args: string[]) {
  const values: Record<string, string> = {};
  const keys = ['core', 'node', 'wasm', 'source-commit', 'qualification-inventory', 'output'];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, '');
    if (!keys.includes(key) || !args[index]?.startsWith('--') || !args[index + 1] || key in values) throw new Error('invalid-baseten-inputs');
    values[key] = args[index + 1];
  }
  if (keys.some(key => !values[key]) || !/^[a-f0-9]{40}$/.test(values['source-commit'])) throw new Error('invalid-baseten-inputs');
  for (const key of keys.filter(key => key !== 'source-commit')) values[key] = resolve(values[key]);
  return values;
}
export function scoreBasetenArrival(fixtures: Fixture[], findings: Finding[]) {
  validateBasetenArrival(fixtures);
  const accounting = validateAccounting(suite.accounting as AccountingConfig);
  // Use the exact shared lattice/accounting under scoreReport. The standalone T1
  // contract is not inserted into the accepted qualification-policy registry.
  const { rows } = score(fixtures, findings);
  return { groups: accountGroups(rows, accounting), rows: rows.map(row => ({
    fixtureId: row.id, kind: row.kind, tier: row.tier, expectedSpans: row.expected.length,
    outcome: encodeOutcome(row), actual: row.actual,
  })) };
}

export async function runBasetenArrival(options: Record<string, string>) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('unsupported-measurement-host');
  const benchmarkCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) throw new Error('dirty-benchmark-source');
  if (!/trufflehog 3\.97\.4\b/.test(execFileSync('trufflehog', ['--version'], { encoding: 'utf8' }))) throw new Error('peer-version-not-pinned');
  const inventoryBytes = await readFile(options['qualification-inventory']);
  const inventory = JSON.parse(inventoryBytes.toString());
  if (inventory.sourceCommit !== options['source-commit'] || inventory.published !== false) throw new Error('qualification-source-mismatch');
  const packages = await Promise.all(['core', 'node', 'wasm'].map(async role => ({ role, sha256: await hashFile(options[role]) })));
  const qualifiedFiles = inventory.artifacts.filter((row: { artifact: string }) => ['wasm-web', 'wasm-web-common'].includes(row.artifact) || (row.artifact === 'node-addon-aarch64-apple-darwin' && (row as { file?: string }).file === 'redact-secret.darwin-arm64.node'));
  if (qualifiedFiles.length !== 17) throw new Error('incomplete-qualification-inventory');
  for (const row of qualifiedFiles) {
    const role = row.artifact === 'node-addon-aarch64-apple-darwin' ? 'node' : 'wasm';
    const bytes = execFileSync('tar', ['-xOf', options[role], `package/${row.file}`]);
    if (digest(bytes) !== row.sha256) throw new Error('qualification-component-mismatch');
  }
  const fixtures = validateBasetenArrival(buildBasetenArrival()) as Fixture[];
  const scratch = await mkdtemp(join(tmpdir(), 'baseten-arrival-'));
  let installation;
  const startedAt = new Date().toISOString();
  try {
    installation = await installCandidate({ core: options.core, node: options.node, wasm: options.wasm });
    const scanner = await loadCandidate(installation, undefined, { actions: true });
    const api = await import(pathToFileURL(join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href);
    await api.initialize();
    const manifest = api.artifactManifest();
    if (api.artifact() !== 'addon' || manifest.sourceRevision !== options['source-commit'] || manifest.artifact.variant !== 'full') throw new Error('candidate-runtime-identity-mismatch');
    const native = await readFile(join(installation.root, 'node_modules/@redact-secret/node-darwin-arm64/redact-secret.darwin-arm64.node'));
    const nativeHash = digest(native);
    if (!inventory.artifacts.some((row: { file: string; sha256: string }) => row.file === 'redact-secret.darwin-arm64.node' && row.sha256 === nativeHash)) throw new Error('qualification-binary-mismatch');
    for (const fixture of fixtures) {
      await mkdir(join(scratch, 'cases'), { recursive: true });
      await writeFile(join(scratch, fixture.path), fixture.content, { mode: 0o600 });
    }
    const findings = await scanner.scan(scratch, fixtures);
    const repeated = await scanner.scan(scratch, fixtures);
    if (JSON.stringify(findings) !== JSON.stringify(repeated)) throw new Error('unstable-baseten-observation');
    const result = scoreBasetenArrival(fixtures, findings);
    const report = { schema: 'baseten-arrival/v1', status: 'complete', supportClaims: false,
      scope: 'focused-independent-development', peerComparison: false, startedAt, finishedAt: new Date().toISOString(),
      candidate: { sourceCommit: options['source-commit'], declaredVersion: installation.declaredVersion,
        profile: 'full', backend: 'addon', published: false, packages, nativeBinarySha256: nativeHash,
        qualificationRun: inventory.workflowRun, inventorySha256: digest(inventoryBytes), artifactManifestSha256: digest(JSON.stringify(manifest)) },
      benchmark: { sourceCommit: benchmarkCommit, dirty: false, lockfileSha256: await hashFile(join(root, 'package-lock.json')) },
      corpus: { contract: BASETEN_CONTRACT, sha256: digest(JSON.stringify(fixtures)), selected: fixtures.length, scanned: fixtures.length,
        generatorSha256: await hashFile(join(root, 'fixtures/generated/baseten-arrival.mjs')) },
      scanner: { version: scanner.version, configuration: 'default/full/native; PII off', replays: 2, host: { platform: process.platform, arch: process.arch, node: process.version } },
      ...result };
    await mkdir(resolve(options.output, '..'), { recursive: true });
    await writeFile(options.output, JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally { await removeCandidate(installation); await rm(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runBasetenArrival(parseBasetenInputs(process.argv.slice(2))); }
  catch { console.error('Baseten arrival measurement failed; no complete evidence was produced.'); process.exitCode = 1; }
}
