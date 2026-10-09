import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceJson } from './lib/pii-evidence-json.mjs';
import { validateEvidenceComparisonPlan, evidenceSides } from './lib/pii-evidence-comparison-plan.mjs';
import { loadPiiEvidenceComparison, validateEvidencePopulationIndex } from '../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';

export const PII_EVIDENCE_DIRECTORY = 'benchmarks/pii-evidence-comparison';
export const PII_EVIDENCE_INDEX = 'public/results/pii-evidence-comparison-v1.json';
export const PII_EVIDENCE_VIEW = 'public/results/pii-evidence-comparison-view-v1.json';
const sha256 = text => createHash('sha256').update(text).digest('hex');
async function optional(root, relative) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

/** Fixed public paths only. The consumer verifies every measurement identity. */
export async function piiEvidencePublication(root, { directory = PII_EVIDENCE_DIRECTORY } = {}) {
  if (directory !== PII_EVIDENCE_DIRECTORY && directory !== 'benchmarks/pii-evidence-comparison/v2-post37-published-retry2') throw new Error('evidence-publication-directory-unreviewed');
  const sources = [];
  const texts = new Map();
  const json = async name => {
    const relative = `${directory}/${name}.json`;
    const text = await optional(root, relative);
    if (text === undefined) return undefined;
    sources.push({ path: relative, sha256: sha256(text) });
    texts.set(name, text);
    return parseEvidenceJson(text);
  };
  let comparison;
  try {
    const plan = await json('plan'), receipt = await json('receipt'), record = await json('record');
    const populationIndex = await json('population-index');
    if (plan) validateEvidenceComparisonPlan(plan, { populationIndex });
    if (populationIndex) validateEvidencePopulationIndex(populationIndex, { plan });
    if (record && !receipt) throw new Error('evidence-receipt-missing');
    if (receipt && !plan) throw new Error('evidence-plan-missing');
    const artifacts = [];
    if (receipt) for (const side of evidenceSides(plan)) {
      const relative = `${directory}/${side}.public-synthetic-artifact.json`;
      const text = await optional(root, relative);
      if (text === undefined) throw new Error('missing-public-artifact');
      sources.push({ path: relative, sha256: sha256(text) });
      artifacts.push({ side, text });
    }
    comparison = loadPiiEvidenceComparison({ plan, receipt, receiptText: texts.get('receipt'), record, artifacts, populationIndex });
  } catch {
    comparison = { state: 'invalid', reason: 'evidence-comparison-inputs-unreadable', publicOnly: true, supportClaims: false, qualified: false };
  }
  const view = { schema: 'pii-evidence-publication-view/v1', sources, comparison };
  const viewText = `${JSON.stringify(view, null, 2)}\n`;
  const index = { schema: 'pii-evidence-publication-index/v1', state: comparison.state,
    publicOnly: true, supportClaims: false, qualified: false,
    populationScope: 'pii-evidence-derived-only', pooledWithBenchmarkPopulations: false,
    view: { path: '/results/pii-evidence-comparison-view-v1.json', sha256: sha256(viewText) },
    sources };
  return { index, view, viewText };
}

export async function writePiiEvidencePublication(root) {
  const result = await piiEvidencePublication(root);
  if (result.view.comparison.state === 'invalid') throw new Error('pii-evidence-publication-inputs-invalid');
  await mkdir(path.join(root, 'public/results'), { recursive: true });
  await writeFile(path.join(root, PII_EVIDENCE_VIEW), result.viewText);
  await writeFile(path.join(root, PII_EVIDENCE_INDEX), `${JSON.stringify(result.index, null, 2)}\n`);
  return result;
}

/** Recompute source and output identities, without changing qualification authority. */
export async function piiEvidencePublicationProblems(root) {
  const expected = await piiEvidencePublication(root);
  const indexText = await optional(root, PII_EVIDENCE_INDEX), viewText = await optional(root, PII_EVIDENCE_VIEW);
  if (!indexText || !viewText) return ['pii-evidence-publication-missing'];
  try {
    if (JSON.stringify(parseEvidenceJson(indexText)) !== JSON.stringify(expected.index)) return ['pii-evidence-publication-index-mismatch'];
    if (viewText !== expected.viewText) return ['pii-evidence-publication-view-mismatch'];
    if (expected.view.comparison.state === 'invalid') return ['pii-evidence-publication-inputs-invalid'];
    return [];
  } catch { return ['pii-evidence-publication-malformed']; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.cwd());
  if (process.argv.length !== 3 || !['--write', '--check'].includes(process.argv[2])) throw new Error('Use --write or --check');
  if (process.argv[2] === '--write') {
    const result = await writePiiEvidencePublication(root);
    if (result.view.comparison.state === 'invalid') { console.error('PII evidence publication refused invalid inputs'); process.exitCode = 1; }
    else console.log(`PII evidence publication: ${result.index.state}, separate population`);
  } else {
    const problems = await piiEvidencePublicationProblems(root);
    if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
    else console.log('PII evidence publication: source and digest checks pass');
  }
}
