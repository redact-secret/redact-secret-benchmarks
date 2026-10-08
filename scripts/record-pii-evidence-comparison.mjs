#!/usr/bin/env node
// Collect an already completed public run. Never dispatches or changes authority.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, lstatSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readEvidenceComparisonPlan, PLAN_PATH, validateEvidencePlanPath, validateEvidenceExecutionSelection, evidenceDigest, validateEvidenceCostDecision, COST_PATH, same } from './lib/pii-evidence-comparison-plan.mjs';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';
import { sha256 } from './lib/pii-evidence-contract.mjs';
import { loadPiiEvidenceComparison, SIDES } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
export const COMPARISON_DIR = 'benchmarks/pii-evidence-comparison';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const UPLOAD_NAMES = ['plan.json', 'receipt.json', 'build-receipt.json', ...SIDES.map(side => `${side}.public-synthetic-artifact.json`),
  ...SIDES.flatMap(side => ['manifest', 'observation', 'run-artifact'].map(name => `replay-inputs/${side}/${name}.json`))];
export function collectEvidenceComparison({ run, artifact, files, archiveSha256, expectedHeadSha, plan, costDecision, populationIndex }) {
  validateEvidenceCostDecision(costDecision, { preflight: plan.preflight, policy: plan.policy, populationIndex, productTuple: plan.productTuple, executionPaths: plan.executionPaths });
  if (costDecision.state !== 'approved' || evidenceDigest(costDecision) !== plan.dispatch?.costDecisionSha256) throw new Error('evidence-approved-cost-mismatch');
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha ?? '') || run?.repository?.full_name !== REPOSITORY || run.head_repository?.full_name !== REPOSITORY ||
      run.path !== '.github/workflows/pii-official-run.yml' || run.event !== 'workflow_dispatch' || run.status !== 'completed' || run.conclusion !== 'success' ||
      run.run_attempt !== 1 || run.head_sha !== expectedHeadSha || !Number.isSafeInteger(run.id) || run.id <= 0 || !run.head_branch || ['main', 'develop'].includes(run.head_branch))
    throw new Error('evidence-github-run-mismatch');
  if (!artifact || artifact.expired !== false || artifact.name !== 'pii-evidence-comparison' || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 ||
      artifact.digest !== `sha256:${archiveSha256}` || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 ||
      artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha) throw new Error('evidence-github-artifact-mismatch');
  if (!same(Object.keys(files).sort(), [...UPLOAD_NAMES].sort())) throw new Error('evidence-upload-member-set-mismatch');
  const receipt = parseEvidenceJson(files['receipt.json']);
  if (plan.mode !== 'official' || !plan.dispatch.authorised || !same(parseEvidenceJson(files['plan.json']), plan) ||
      !same(parseEvidenceJson(files['build-receipt.json']), receipt.importer?.buildReceipt)) throw new Error('evidence-upload-plan-or-build-mismatch');
  for (const input of receipt.replayInputs ?? [])
    if (typeof files[input.name] !== 'string' || sha256(files[input.name]) !== input.sha256) throw new Error('evidence-replay-input-bytes-mismatch');
  const artifacts = SIDES.map(side => ({ side, text: files[`${side}.public-synthetic-artifact.json`] }));
  const record = { schema: 'pii-evidence-comparison-record/1', publicOnly: true, supportClaims: false, authorityChanged: false, planDigest: evidenceDigest(plan),
    workflow: { repository: REPOSITORY, path: run.path, reusablePath: '.github/workflows/pii-evidence-comparison.yml', runId: run.id, runAttempt: run.run_attempt,
      event: run.event, headSha: run.head_sha, headBranch: run.head_branch, conclusion: run.conclusion },
    actionsArtifact: { id: artifact.id, name: artifact.name, archiveSha256, sizeInBytes: artifact.size_in_bytes },
    receipt: { sha256: sha256(files['receipt.json']), documentDigest: evidenceDigest(receipt) },
    buildReceipt: { sha256: sha256(files['build-receipt.json']), documentDigest: evidenceDigest(receipt.importer.buildReceipt) },
    artifacts: artifacts.map(row => ({ side: row.side, sha256: sha256(row.text) })), replayInputs: receipt.replayInputs };
  const summary = loadPiiEvidenceComparison({ plan, receipt, receiptText: files['receipt.json'], record, artifacts, populationIndex });
  if (summary.state !== 'recorded' || summary.mode !== 'official') throw new Error(`evidence-upload-refused:${summary.reason ?? 'mode'}`);
  return { record, summary, files: Object.fromEntries(UPLOAD_NAMES.map(name => [name, files[name]])) };
}
export function evidenceComparisonSourceProblems({ root = ROOT, planFile = PLAN_PATH, plan = readEvidenceComparisonPlan(planFile) } = {}) {
  validateEvidencePlanPath(planFile);
  const dir = join(root, dirname(planFile));
  if (!existsSync(join(dir, 'receipt.json')) && !existsSync(join(dir, 'record.json'))) return SIDES.some(side => existsSync(join(dir, `${side}.public-synthetic-artifact.json`))) ? ['evidence-artifact-without-record'] : [];
  try {
    const receiptText = readFileSync(join(dir, 'receipt.json'), 'utf8'), receipt = parseEvidenceJson(receiptText), record = parseEvidenceJson(readFileSync(join(dir, 'record.json'), 'utf8'));
    const cost = validateEvidenceCostDecision(parseEvidenceJson(readFileSync(join(dir, 'cost-decision.json'), 'utf8')), { preflight: plan.preflight, policy: plan.policy, populationIndexDigest: plan.populationIndexDigest, productTuple: plan.productTuple, executionPaths: plan.executionPaths });
    if (cost.state !== 'approved' || evidenceDigest(cost) !== plan.dispatch.costDecisionSha256) return ['evidence-source-cost-mismatch'];
    if (!same(parseEvidenceJson(readFileSync(join(dir, 'plan.json'), 'utf8')), plan)) return ['evidence-source-plan-stale'];
    const result = loadPiiEvidenceComparison({ plan, receipt, receiptText, record,
      artifacts: SIDES.map(side => ({ side, text: readFileSync(join(dir, `${side}.public-synthetic-artifact.json`), 'utf8') })),
      populationIndex: parseEvidenceJson(readFileSync(join(dir, 'population-index.json'), 'utf8')) });
    const buildText = readFileSync(join(dir, 'build-receipt.json'), 'utf8');
    if (sha256(buildText) !== record.buildReceipt?.sha256 || !same(parseEvidenceJson(buildText), receipt.importer.buildReceipt)) return ['evidence-source-build-receipt-mismatch'];
    for (const input of record.replayInputs ?? [])
      if (sha256(readFileSync(join(dir, input.name))) !== input.sha256) return ['evidence-source-replay-input-mismatch'];
    return result.state === 'recorded' && result.mode === 'official' ? [] : [result.reason ?? 'evidence-source-not-canonical'];
  } catch { return ['evidence-source-incomplete-or-unreadable']; }
}
function gh(endpoint, binary = false) { return execFileSync('gh', ['api', endpoint], { encoding: binary ? null : 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
export function extractEvidenceComparisonArchive({ archive, dir }) {
  try {
    execFileSync('python3', ['-c', `import zipfile,json,sys,stat,pathlib
with zipfile.ZipFile(sys.argv[1]) as z:
 allowed=set(json.loads(sys.argv[3])); entries=z.infolist()
 assert len(entries)==len(allowed) and {e.filename for e in entries}==allowed
 assert sum(e.file_size for e in entries)<=32*1024*1024
 for e in entries:
  assert e.file_size<=8*1024*1024 and not stat.S_ISLNK(e.external_attr>>16)
  dest=pathlib.Path(sys.argv[2],e.filename); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(z.read(e))`, archive, dir, JSON.stringify(UPLOAD_NAMES)], { timeout: 30000, stdio: 'pipe' });
    return Object.fromEntries(UPLOAD_NAMES.map(name => [name, new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(join(dir, name)))]));
  } catch { throw new Error('evidence-archive-member-set-invalid'); }
}
export function writeCollectedEvidence({ root = ROOT, outDir, result }) {
  validateEvidencePlanPath(`${outDir}/plan.json`);
  const dir = join(root, outDir);
  const names = [...Object.keys(result.files), 'record.json'];
  if (!same(Object.keys(result.files).sort(), [...UPLOAD_NAMES].sort())) throw new Error('evidence-durable-member-set-invalid');
  for (const name of names) {
    const parts = `${outDir}/${name}`.split('/');
    for (let i = 1; i <= parts.length; i++) {
      try { if (lstatSync(join(root, ...parts.slice(0, i))).isSymbolicLink()) throw new Error('evidence-output-symlink-refused'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  if (existsSync(join(dir, 'record.json')) || existsSync(join(dir, 'receipt.json'))) throw new Error('evidence-existing-record-refused');
  for (const name of names) {
    const destination = join(dir, name);
    if (!existsSync(destination)) continue;
    if (name !== 'plan.json') throw new Error('evidence-existing-member-refused');
    if (!lstatSync(destination).isFile() || !readFileSync(destination).equals(Buffer.from(result.files[name])))
      throw new Error('evidence-existing-plan-mismatch');
  }
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(result.files)) {
    const destination = join(dir, name); mkdirSync(dirname(destination), { recursive: true });
    if (name === 'plan.json' && existsSync(destination)) continue;
    writeFileSync(destination, text, { flag: 'wx' });
  }
  writeFileSync(join(dir, 'record.json'), JSON.stringify(result.record, null, 1) + '\n', { flag: 'wx' });
}
export function collectEvidenceGithub({ runId, expectedHeadSha, write = false, planFile = PLAN_PATH, outDir = dirname(planFile) }) {
  const plan = readEvidenceComparisonPlan(planFile);
  validateEvidenceExecutionSelection(plan, { planPath: planFile });
  validateEvidencePlanPath(`${outDir}/plan.json`);
  if (outDir !== dirname(planFile)) throw new Error('evidence-collection-origin-mismatch');
  if (!/^[0-9]+$/.test(String(runId)) || !/^[a-f0-9]{40}$/.test(expectedHeadSha ?? '')) throw new Error('evidence-run-identity-invalid');
  const run = JSON.parse(gh(`repos/${REPOSITORY}/actions/runs/${runId}`));
  const listing = JSON.parse(gh(`repos/${REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`));
  if (listing.total_count !== listing.artifacts?.length) throw new Error('evidence-upload-list-incomplete');
  const matches = listing.artifacts.filter(row => row.name === 'pii-evidence-comparison');
  if (matches.length !== 1) throw new Error('evidence-upload-not-unique');
  const artifact = matches[0], zip = gh(`repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`, true);
  const archiveSha256 = sha256(zip); if (artifact.digest !== `sha256:${archiveSha256}`) throw new Error('evidence-upload-archive-digest');
  const headJson = file => { const doc = JSON.parse(gh(`repos/${REPOSITORY}/contents/${file}?ref=${expectedHeadSha}`));
    if (doc.encoding !== 'base64' || typeof doc.content !== 'string' || doc.content.length > 500000) throw new Error('evidence-head-file-invalid');
    return parseEvidenceJson(Buffer.from(doc.content, 'base64').toString('utf8')); };
  const headPlan = headJson(planFile), costDecision = headJson(plan.dispatch.costDecision), populationIndex = headJson(`${dirname(planFile)}/population-index.json`);
  if (!same(headPlan, plan)) throw new Error('evidence-workflow-head-plan-mismatch');
  const temp = mkdtempSync(join(tmpdir(), 'pii-evidence-collect-'));
  try {
    const archive = join(temp, 'archive.zip'); writeFileSync(archive, zip);
    const files = extractEvidenceComparisonArchive({ archive, dir: join(temp, 'files') });
    const result = collectEvidenceComparison({ run, artifact, files, archiveSha256, expectedHeadSha, plan, costDecision, populationIndex });
    if (write) writeCollectedEvidence({ outDir, result });
    return result.record;
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const planFile = process.argv.find(value => value.startsWith('--plan='))?.slice(7) ?? PLAN_PATH;
    const problems = evidenceComparisonSourceProblems({ planFile }); if (problems.length) throw new Error(problems.join(','));
    console.log('PII evidence source bindings valid, or canonical measurement not recorded yet');
  } else {
    const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
    console.log(JSON.stringify(collectEvidenceGithub({ runId: arg('run-id'), expectedHeadSha: arg('head-sha'), write: process.argv.includes('--write'), planFile: arg('plan') ?? PLAN_PATH, outDir: arg('out-dir') ?? undefined }), null, 1));
  }
}
