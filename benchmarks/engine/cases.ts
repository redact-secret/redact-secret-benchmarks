import type { Fixture, Corpus } from '../types.ts';
import type { Registry, Operator, EvaluationCase, CaseSeed } from './types.ts';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCorpora } from '../../fixtures/generated/build.mjs';
import { validateCorpus } from '../lib/scoring.ts';
import { validateAssessment, classifyFixture, validateContracts } from '../lib/assessment.ts';
import { validateStructures } from '../lib/validate-structures.ts';
import { hash, secrets } from './model.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const taxonomy = (category: string, f: Fixture) => {
  if (/reference|syntax/i.test(category + f.group)) return 'references';
  if (/placeholder|mask/i.test(f.group)) return 'placeholders';
  if (/encoded/i.test(f.group)) return 'encoded-values';
  if (/identifier/i.test(f.group)) return 'identifiers';
  if (/shape|miss/i.test(f.group)) return 'near-misses';
  return 'documentation';
};

/** Bridge the corpus catalog to cases; never relabel from observations. */
export async function loadCases(operators: Registry<Operator>): Promise<EvaluationCase[]> {
  validateContracts();
  const categories = JSON.parse(await readFile(path.join(root, 'benchmarks/categories.json'), 'utf8'));
  const targets = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-detectors.json'), 'utf8'));
  const generated: Record<string, Corpus> = buildCorpora(), cases: EvaluationCase[] = [];
  for (const category of categories) {
    const corpus = validateCorpus(generated[category.id] ?? JSON.parse(await readFile(path.join(root, category.corpus), 'utf8')));
    corpus.fixtures.forEach(f => {
      validateAssessment(f);
      if (JSON.stringify(f.assessment) !== JSON.stringify(classifyFixture(category.id, f))) throw new Error('Stale case assessment');
    });
    validateStructures(corpus.fixtures);
    const sourceHash = hash(corpus);
    for (const f of corpus.fixtures) {
      const base: CaseSeed = {
        targets: targets[`${category.id}--${f.id}`] ?? f.detectors ?? [],
        visibility: /regressions|milestone/.test(category.id) ? 'regression' : 'development',
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
      } else if (!secrets(f).length) add('benign', { taxonomy: taxonomy(category.id, f) });
      // Context methods also check preservation of silence and pending cases.
      // Existing twins remain in the paired method rather than being unpaired.
      if (!f.twinOf) {
        const context = operators.values().filter(o => /^(context|encoding)\./.test(o.id) && o.supports(base));
        if (context.length) add('metamorphic', { operators: context.map(o => ({ id: o.id })) });
        const twin = corpus.fixtures.find(t => t.twinOf === f.id);
        const mutationSeed = { ...base, twin };
        const lexical = operators.values().filter(o =>
          (o.id.startsWith('lexical.') || o.id === 'authored.twin') && o.supports(mutationSeed));
        if (lexical.length) add('mutation', { twin, operators: lexical.map(o => ({ id: o.id })) });
      }
    }
  }
  return cases;
}
