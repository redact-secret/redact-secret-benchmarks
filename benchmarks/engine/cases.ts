import type { Fixture, Corpus } from '../types.ts';
import type { Registry, Operator, EvaluationCase, CaseSeed } from './types.ts';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCorpora } from '../../fixtures/generated/build.mjs';
import { validateCorpus } from '../lib/scoring.ts';
import { validateAssessment, classifyFixture, validateContracts, controlAxis } from '../lib/assessment.ts';
import { validateStructures } from '../lib/validate-structures.ts';
import { hash, secrets } from './model.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
/** Fail closed (#91): a reviewed must-not-flag control always has an axis. T0 controls are unscored and carry the explicit `pending` axis instead. */
const axisFor = (category: string, f: Fixture) => {
  if (f.assessment.tier === 'T0') return 'pending';
  const axis = controlAxis(category, f);
  if (axis === null) throw new Error(`No reviewed axis rule for control: ${category}/${f.id}`);
  return axis;
};

/** Bridge the corpus catalog to cases; never relabel from observations. */
export async function loadCases(operators: Registry<Operator>): Promise<EvaluationCase[]> {
  validateContracts();
  const categories = JSON.parse(await readFile(path.join(root, 'benchmarks/categories.json'), 'utf8'));
  const visibilityByCategory = new Map<string, 'development' | 'regression'>();
  for (const visibility of ['development', 'regression'] as const) {
    const manifest = JSON.parse(await readFile(path.join(root, `corpora/${visibility}/manifest.json`), 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.visibility !== visibility || !Array.isArray(manifest.categories)) throw new Error('Invalid development corpus manifest');
    for (const id of manifest.categories) {
      if (visibilityByCategory.has(id) || !categories.some((c: { id: string }) => c.id === id)) throw new Error('Duplicate or unknown corpus category');
      visibilityByCategory.set(id, visibility);
    }
  }
  if (visibilityByCategory.size !== categories.length) throw new Error('Incomplete development corpus manifests');
  const targets = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-detectors.json'), 'utf8'));
  const generated: Record<string, Corpus> = buildCorpora(), cases: EvaluationCase[] = [];
  const developmentRoots = ['fixtures', 'corpora/development', 'corpora/regression'].map(p => path.join(root, p) + path.sep);
  const allowed = (file: string) => developmentRoots.some(directory => file.startsWith(directory));
  for (const category of categories) {
    const source = path.resolve(root, category.corpus);
    if (!allowed(source)) throw new Error('Development corpus points outside development storage');
    let input = generated[category.id];
    if (!input) {
      const resolved = await realpath(source);
      if (!allowed(resolved)) throw new Error('Development corpus symlink escapes development storage');
      input = JSON.parse(await readFile(resolved, 'utf8'));
    }
    const corpus = validateCorpus(input);
    corpus.fixtures.forEach(f => {
      validateAssessment(f);
      if (JSON.stringify(f.assessment) !== JSON.stringify(classifyFixture(category.id, f))) throw new Error('Stale case assessment');
    });
    validateStructures(corpus.fixtures);
    // Calibration-only rows are validated above and consumed by candidate-feature
    // extraction, but never become public benchmark cases or support evidence.
    if (category.calibrationOnly) continue;
    const sourceHash = hash(corpus);
    for (const f of corpus.fixtures) {
      const base: CaseSeed = {
        // Beta.8 arrival targets (#207–#212) are case targets, never registry detectors.
        targets: [...(targets[`${category.id}--${f.id}`] ?? f.detectors ?? []), ...(f.arrivalTargets ?? [])],
        visibility: visibilityByCategory.get(category.id)!,
        source: { category: category.id, fixtureId: f.id, path: category.corpus },
        seed: f, operators: [],
        provenance: { source: category.corpus, sourceHash, rationale: f.assessment.reason,
          seed: `${category.id}/${f.id}`, reviewStatus: corpus.reviewStatus, sources: f.assessment.sources },
      };
      const add = (method: string, extra: Partial<EvaluationCase> = {}) => {
        const c = { ...base, id: `${category.id}--${f.id}--${method}`, method, ...extra };
        cases.push(c);
        return c;
      };
      add('differential');
      if (f.twinOf) {
        const positive = corpus.fixtures.find(p => p.id === f.twinOf);
        add('twin', { seed: positive!, twin: f, operators: [{ id: 'authored.twin' }] });
      } else if (!secrets(f).length) add('benign', { taxonomy: axisFor(category.id, f) });
      // Context methods also check preservation of silence and pending cases.
      // Existing twins remain in the paired method rather than being unpaired.
      if (!f.twinOf) {
        const context = operators.values().filter(o => /^(context|encoding)\./.test(o.id));
        if (context.length) add('metamorphic', { operators: context.map(o => ({ id: o.id })) });
        const twin = corpus.fixtures.find(t => t.twinOf === f.id);
        const mutationSeed = { ...base, twin };
        const lexical = operators.values().filter(o =>
          /^(lexical|boundary|structural)\./.test(o.id) || (o.id === 'authored.twin' && o.supports(mutationSeed)));
        if (lexical.length) add('mutation', { twin, operators: lexical.map(o => ({ id: o.id })) });
      }
    }
  }
  return cases;
}
