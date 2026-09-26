import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry as compatibilityRegistry } from '../benchmarks/engine/registry.ts';
import { createRegistry } from '../benchmarks/evaluation/substrate/registry.ts';
import { hash as compatibilityHash } from '../benchmarks/engine/model.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { evaluationInputs as collectEvaluationInputs } from '../benchmarks/evaluation/substrate/case-lifecycle.ts';
import { projectKnownResults } from '../benchmarks/evaluation/substrate/public-projection.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const substrate = path.join(root, 'benchmarks/evaluation/substrate');

test('the internal substrate has no domain branches or dependencies on semantic layers', async () => {
  const files = (await readdir(substrate)).filter(file => file.endsWith('.ts')).sort();
  assert.deepEqual(files, ['case-lifecycle.ts', 'hash.ts', 'provenance.ts', 'public-projection.ts', 'registry.ts', 'review-state.ts', 'runtime.ts', 'variant-lifecycle.ts']);
  for (const file of files) {
    const source = await readFile(path.join(substrate, file), 'utf8');
    assert.doesNotMatch(source, /\b(?:credential|pii)\b/i, file);
    assert.doesNotMatch(source, /from ['"][^'"]*(?:engine|methods|operators|support|accounting|assessment)[^'"]*['"]/, file);
  }
  const manifest = await readFile(path.join(root, 'package.json'), 'utf8');
  assert.doesNotMatch(manifest, /evaluation\/substrate/, 'substrate stays internal and is not exported as a plugin API');
});

test('compatibility paths expose the exact deterministic substrate primitives', () => {
  assert.equal(compatibilityRegistry, createRegistry);
  assert.equal(compatibilityHash, hash);
  assert.equal(hash({ b: 2, a: 1 }), compatibilityHash({ b: 2, a: 1 }));
});

test('case lifecycle and public projection are deterministic and fail closed', () => {
  const cases = [{ id: 'b' }, { id: 'a' }];
  const first = collectEvaluationInputs(cases, c => ({ variants: [{ fixture: { path: `${c.id}.txt`, content: c.id } }] }));
  const second = collectEvaluationInputs(cases, c => ({ variants: [{ fixture: { path: `${c.id}.txt`, content: c.id } }] }));
  assert.deepEqual(first, second);
  assert.throws(() => collectEvaluationInputs([{ id: 'same' }, { id: 'same' }], c => ({ variants: [{ fixture: { path: `${c.id}.txt` } }] })),
    /Empty or duplicate evaluation cases/);
  assert.throws(() => collectEvaluationInputs(cases, () => ({ variants: [{ fixture: { path: 'same.txt' } }] })), /Duplicate generated path/);
  assert.deepEqual(projectKnownResults({
    sources: cases, results: [{ id: 'a', value: 1 }], accepts: (source, result) => source.id === result.id,
    project: (source, result) => `${source.id}:${result.value}`, refusal: 'refused',
  }), ['a:1']);
  assert.throws(() => projectKnownResults({
    sources: cases, results: [{ id: 'missing' }], accepts: () => true, project: source => source.id, refusal: 'refused',
  }), /refused/);
});
