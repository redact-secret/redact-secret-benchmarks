import { readFile, writeFile } from "node:fs/promises";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import { validateCorpus } from "../benchmarks/lib/scoring.mjs";
import { classifyFixture, validateAssessment } from "../benchmarks/lib/cohorts.mjs";
import { validateStructures } from '../benchmarks/lib/validate-structures.mjs';
import { createHash } from 'node:crypto';

const check = process.argv.includes("--check");
const ensure = process.argv.includes('--ensure');
if (process.argv.slice(2).some(arg => !['--check', '--ensure'].includes(arg)) || (check && ensure)) throw new Error('Usage: generate-fixtures.mjs [--check | --ensure]');
const generated = buildCorpora();
const manifest = {};
for (const [id, corpus] of Object.entries(generated)) {
  validateCorpus(corpus);
  corpus.fixtures.forEach(validateAssessment);
  validateStructures(corpus.fixtures);
  const file = new URL(`../fixtures/generated/${id}.json`, import.meta.url);
  const serialized = JSON.stringify(corpus, null, 2) + "\n";
  manifest[id] = { sha256: createHash('sha256').update(serialized).digest('hex'), fixtures: corpus.fixtures.length, expectedSpans: corpus.fixtures.reduce((n, f) => n + f.expected.length, 0) };
  const current = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (ensure && current === null) await writeFile(file, serialized);
  else if (check || ensure) {
    if (current !== serialized)
      throw new Error(
        `Generated corpus drift: ${id}. Run npm run fixtures:generate.`,
      );
  } else if (current !== serialized) await writeFile(file, serialized);
  console.log(
    `${check || ensure ? "Checked" : "Generated"} ${id}: ${corpus.fixtures.length} files`,
  );
}
const manifestFile = new URL('../benchmarks/generated-corpora.json', import.meta.url);
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
if (check || ensure) {
  if (await readFile(manifestFile, 'utf8') !== manifestText) throw new Error('Generated corpus hash drift. Review the generator change and run npm run fixtures:generate.');
} else await writeFile(manifestFile, manifestText);
// Annotate hand-authored legacy fixtures without changing bytes or expectations.
for (const id of ['accuracy', 'token-contexts']) {
  const file = new URL(`../fixtures/${id}/corpus.json`, import.meta.url);
  const current = await readFile(file, 'utf8');
  const corpus = JSON.parse(current);
  for (const f of corpus.fixtures) {
    f.assessment = classifyFixture(id, f);
    validateAssessment(f);
  }
  const serialized = JSON.stringify(corpus, null, 2) + '\n';
  if ((check || ensure) && current !== serialized) throw new Error(`Assessment drift: ${id}`);
  if (!check && !ensure && current !== serialized) await writeFile(file, serialized);
}
const assignmentFile = new URL('../benchmarks/fixture-detectors.json', import.meta.url);
const current = await readFile(assignmentFile, 'utf8');
const assignments = JSON.parse(current);
for (const f of generated['common-formats'].fixtures) assignments[`common-formats--${f.id}`] = f.detectors;
const serialized = JSON.stringify(assignments, null, 2) + '\n';
if ((check || ensure) && current !== serialized) throw new Error('Detector assignment drift');
if (!check && !ensure && current !== serialized) await writeFile(assignmentFile, serialized);
