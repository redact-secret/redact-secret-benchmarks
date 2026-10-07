/**
 * Record one official run (the run-record.json that scripts/run-official-credential-eval.ts writes next to its artifact)
 * into benchmarks/official-runs.json `runs[]` (#604). It replaces the entry with the same id and then re-checks the
 * registry, so a record that does not match the pins is refused before it is written.
 *
 *   npm run official-runs:record -- <run-record.json> [--date YYYY-MM-DD]
 *
 * The canonical record is a linux-x64 run from .github/workflows/official-runs.yml; any other platform is recorded as a
 * local verification and says so.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { officialRunProblems } from './check-official-runs.mjs';

const file = process.argv[2];
const dateAt = process.argv.indexOf('--date');
const date = dateAt >= 0 ? process.argv[dateAt + 1] : new Date().toISOString().slice(0, 10);
if (!file || file.startsWith('--') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Usage: official-runs:record <run-record.json> [--date YYYY-MM-DD]');

const registryUrl = new URL('../benchmarks/official-runs.json', import.meta.url);
const text = await readFile(registryUrl, 'utf8');
const registry = JSON.parse(text);
const record = JSON.parse(await readFile(file, 'utf8'));
const { diagnosticRecordProblem } = await import('../benchmarks/qualification/diagnostic-lane.ts');
const diagnosticProblem = diagnosticRecordProblem(record);
if (diagnosticProblem) throw new Error(`Refused: ${diagnosticProblem} (#705)`);
if (record.schema !== 'redact-secret-benchmarks/official-run-record/v1') throw new Error('Not an official run record');

const canonical = Boolean(registry.config.platforms[record.platform]?.canonical);
const methods = record.kind === 'methods';
const entry = {
  id: `${record.population}${methods ? '+methods' : ''}@${record.platform}`,
  population: record.population,
  ...(methods ? { kind: 'methods', methods: record.methods, evaluation: record.evaluation } : {}),
  platform: record.platform,
  canonical,
  purpose: canonical
    ? `canonical ${methods ? 'methods run' : 'measurement'}: the linux-x64 official run of .github/workflows/official-runs.yml`
    : 'local verification of the pins and the determinism check; the canonical measurement is the linux-x64 CI run (.github/workflows/official-runs.yml)',
  recordedOn: date,
  benchmarkRevision: record.benchmarkRevision,
  engine: record.engine,
  runClass: record.publication === 'public' ? 'public' : 'internal',
  engineRunClass: record.runClass,
  publication: record.publication,
  configHash: record.configHash,
  evidence: record.evidence,
  artifact: {
    semanticDigest: record.artifact.semanticDigest, byteDigest: record.artifact.digest, schemaDigest: record.artifact.schemaDigest,
    stored: canonical ? 'the build artifact of the CI run that produced it (immutable, with its manifest)' : 'not committed; the CI run uploads the canonical artifact as a build artifact',
  },
  determinism: record.determinism,
  scanners: record.scanners,
  // An optional scanner of the roster the run left out on purpose (#763): carried so the registry check can tell it from a silent drop.
  ...(record.omittedOptionalScanners?.length ? { omittedOptionalScanners: record.omittedOptionalScanners } : {}),
  // The scanner selection the run was made under (#812): the configuration file and hash, the scanners and the explicit opt-in (if any), so the recorded result carries its own identity.
  ...(record.scannerSelection ? { scannerSelection: record.scannerSelection } : {}),
  caseCounts: record.caseCounts,
};
const runs = [...registry.runs.filter(run => run.id !== entry.id), entry].sort((a, b) => (a.id < b.id ? -1 : 1));
const schemaBytes = await readFile(new URL('../schemas/credential-eval-run-artifact-v1.json', import.meta.url));
const inputs = JSON.parse(await readFile(new URL('../benchmarks/qualification-inputs.json', import.meta.url), 'utf8'));
const { canonical: canonicalJson, sha256Digest } = await import('../benchmarks/qualification/canonical.ts');
const evaluationEvidenceDigest = sha256Digest(canonicalJson(JSON.parse(await readFile(new URL(registry.methodsRun.evaluationEvidence.file, new URL('../', import.meta.url)), 'utf8'))));
const problems = officialRunProblems({ ...registry, runs }, { schemaDigest: `sha256:${createHash('sha256').update(schemaBytes).digest('hex')}`, inputs, evaluationEvidenceDigest });
if (problems.length) throw new Error(`The run record does not match the pins:\n  - ${problems.join('\n  - ')}`);

const head = text.slice(0, text.indexOf('  "runs": ['));
const body = JSON.stringify(runs, null, 2).split('\n').map((line, i) => (i === 0 ? line : `  ${line}`)).join('\n');
await writeFile(registryUrl, `${head}  "runs": ${body}\n}\n`);
console.log(`Recorded ${entry.id} (${canonical ? 'canonical' : 'local verification'}), semantic digest ${entry.artifact.semanticDigest}`);
