import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { arch, platform, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { classifyFixture, validateAssessment, validateContracts } from './lib/assessment.ts';
import { encodeOutcome } from './lib/lattice.ts';
import { scoreReport } from './lib/reporting.ts';
import { validateCorpus } from './lib/scoring.ts';
import { validateStructures } from './lib/validate-structures.ts';
import { hash } from './engine/model.ts';
import { validateEvidence } from './engine/evidence.ts';
import type { Category, Fixture, ScoredRow } from './types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const usage = 'npm run eval:candidate -- --candidate-package <core.tgz> --candidate-node-package <node.tgz> --candidate-wasm-package <wasm.tgz> --candidate-source-commit <40-hex> --product-state clean|dirty --output-dir <absolute-path> [--filter <detector-id>] [--expected-artifact-sha256 <64-hex>]';

function parse(argv: string[]) {
  const values: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!/^--[a-z][a-z0-9-]*$/.test(key ?? '') || value === undefined || value.startsWith('--') || key.slice(2) in values) throw new Error(usage);
    values[key.slice(2)] = value;
  }
  const required = ['candidate-package', 'candidate-node-package', 'candidate-wasm-package', 'candidate-source-commit', 'product-state', 'output-dir'];
  if (required.some(key => !values[key]) || Object.keys(values).some(key => ![...required, 'filter', 'expected-artifact-sha256'].includes(key))) throw new Error(usage);
  if (!SHA.test(values['candidate-source-commit']) || !['clean', 'dirty'].includes(values['product-state']) || !path.isAbsolute(values['output-dir'])) throw new Error(usage);
  if (values['filter'] && !/^[a-z0-9-]+$/.test(values['filter'])) throw new Error(usage);
  if (values['expected-artifact-sha256'] && !SHA256.test(values['expected-artifact-sha256'])) throw new Error(usage);
  for (const key of ['candidate-package', 'candidate-node-package', 'candidate-wasm-package']) values[key] = path.resolve(values[key]);
  return values;
}

const sha256File = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');
const safeFailure = (phase: string, code: string) => ({ phase, code });

async function main() {
  const options = parse(process.argv.slice(2));
  const target = path.join(options['output-dir'], 'candidate-evidence-v1.json');
  await mkdir(options['output-dir'], { recursive: true });
  const startedAt = new Date().toISOString(), runId = randomUUID();
  let benchmarkRevision = 'unknown', benchmarkDirty = true;
  try {
    benchmarkRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    benchmarkDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  } catch {}
  const artifactSha256 = await sha256File(options['candidate-package']);
  const artifactSet = await Promise.all(['candidate-package', 'candidate-node-package', 'candidate-wasm-package'].map(async key => ({
    role: key.replace('candidate-', '').replace('-package', ''), sha256: await sha256File(options[key]),
  })));
  const failures: { phase: string; code: string }[] = [];
  let installation: Awaited<ReturnType<typeof installCandidate>> | undefined;
  let packageName = 'unknown', declaredVersion = 'unknown', scannedFixtures = 0;
  let results: any[] = [], selectedFixtures = 0, corpusHash = '0'.repeat(64);
  const categoryHashes: { id: string; sha256: string }[] = [];
  try {
    if (options['expected-artifact-sha256'] && options['expected-artifact-sha256'] !== artifactSha256) throw new Error('artifact-identity-mismatch');
    const registry: Category[] = JSON.parse(await readFile(path.join(root, 'benchmarks/categories.json'), 'utf8'));
    const assignments: Record<string, string[]> = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-detectors.json'), 'utf8'));
    const baseline = JSON.parse(await readFile(path.join(root, 'baselines/0.1.0-beta.4.json'), 'utf8'));
    validateContracts();
    const selected: { category: string; fixture: Fixture }[] = [];
    for (const category of registry) {
      const source = await readFile(path.join(root, category.corpus));
      categoryHashes.push({ id: category.id, sha256: createHash('sha256').update(source).digest('hex') });
      const corpus = validateCorpus(JSON.parse(source.toString('utf8')));
      for (const fixture of corpus.fixtures) {
        validateAssessment(fixture);
        if (JSON.stringify(fixture.assessment) !== JSON.stringify(classifyFixture(category.id, fixture))) throw new Error('stale-fixture-assessment');
      }
      validateStructures(corpus.fixtures);
      for (const fixture of corpus.fixtures) {
        const slug = `${category.id}--${fixture.id}`;
        if (!options.filter || assignments[slug]?.includes(options.filter)) selected.push({ category: category.id, fixture });
      }
    }
    if (!selected.length) throw new Error('empty-selection');
    selectedFixtures = selected.length;
    corpusHash = hash(categoryHashes);
    installation = await installCandidate({ core: options['candidate-package'], node: options['candidate-node-package'], wasm: options['candidate-wasm-package'] });
    packageName = installation.packageName; declaredVersion = installation.declaredVersion;
    const scanner = await loadCandidate(installation);
    if (scanner.version !== declaredVersion) throw new Error('candidate-version-mismatch');
    const scratch = await mkdtemp(path.join(tmpdir(), 'redact-secret-candidate-fixtures-'));
    try {
      for (const { fixture } of selected) {
        const file = path.join(scratch, fixture.path);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, fixture.content, { mode: 0o600 });
      }
      const findings = await scanner.scan(scratch, selected.map(entry => entry.fixture));
      const byCategory = new Map<string, Fixture[]>();
      for (const entry of selected) byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry.fixture]);
      for (const [category, fixtures] of byCategory) {
        const paths = new Set(fixtures.map(fixture => fixture.path));
        const scored = scoreReport(fixtures, findings.filter(finding => paths.has(finding.path))).rows;
        results.push(...scored.map((row: ScoredRow) => {
          const slug = `${category}--${row.id}`;
          return { fixtureId: slug, corpusSection: category === 'common-formats' ? 'fixed-corpus' : 'expanded-corpus', kind: row.kind, tier: row.tier, expectedSpans: row.expected.filter(value => (value.role ?? 'secret') === 'secret').length,
            actualFindings: row.actual.length, outcome: encodeOutcome(row), baseline: { version: baseline.version, outcome: baseline.rows[slug]?.['redact-secret'] ?? null } };
        }));
      }
      scannedFixtures = results.length;
    } finally { await rm(scratch, { recursive: true, force: true }); }
  } catch (error) {
    const code = error instanceof Error && /^[a-z][a-z0-9-]+$/.test(error.message) ? error.message : 'candidate-execution-failed';
    const phase = code.includes('identity') || code.includes('version') ? 'identity' : code.includes('install') ? 'installation' : code.includes('initialization') ? 'initialization' : 'scan';
    failures.push(safeFailure(phase, code));
  } finally { await removeCandidate(installation); }
  const report = {
    schemaVersion: 1, reportType: 'candidate', runId, startedAt, finishedAt: new Date().toISOString(),
    status: failures.length === 0 && scannedFixtures === selectedFixtures ? 'complete' : scannedFixtures ? 'incomplete' : 'failed', supportClaims: false,
    candidate: { sourceCommit: options['candidate-source-commit'], sourceState: options['product-state'], packageName, declaredVersion,
      artifactSha256, expectedArtifactSha256: options['expected-artifact-sha256'] ?? null, artifacts: artifactSet },
    benchmark: { sourceCommit: benchmarkRevision, dirty: benchmarkDirty, lockfileSha256: await sha256File(path.join(root, 'package-lock.json')) },
    corpus: { protocol: 'measurement-v4', hash: corpusHash, categories: categoryHashes },
    scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration, configurationHash: hash(candidateConfiguration) },
    runtime: { node: process.version, os: platform(), arch: arch() }, command: [process.execPath, ...process.execArgv, ...process.argv.slice(1)],
    selection: { scope: options.filter ? 'filtered-development' : 'full-suite', filter: options.filter ?? null },
    completeness: { selectedFixtures, scannedFixtures }, failures, results,
  };
  validateEvidence(report, 'candidate');
  const temporary = `${target}.${runId}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  console.log(`Candidate evaluation: ${report.status}; ${scannedFixtures}/${selectedFixtures} fixtures.`);
  console.log(`Evidence: ${target}`);
  process.exitCode = report.status === 'complete' ? 0 : 1;
}

await main();
