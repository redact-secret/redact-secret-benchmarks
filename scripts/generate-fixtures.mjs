import { readFile, writeFile } from "node:fs/promises";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import { validateCorpus } from "../benchmarks/lib/scoring.mjs";
import { classifyFixture, validateAssessment } from "../benchmarks/lib/cohorts.mjs";
import { validateStructures } from '../benchmarks/lib/validate-structures.mjs';

const check = process.argv.includes("--check");
const generated = buildCorpora();
for (const [id, corpus] of Object.entries(generated)) {
  validateCorpus(corpus);
  corpus.fixtures.forEach(validateAssessment);
  validateStructures(corpus.fixtures);
  const file = new URL(`../fixtures/generated/${id}.json`, import.meta.url);
  const serialized = JSON.stringify(corpus, null, 2) + "\n";
  if (check) {
    if ((await readFile(file, "utf8")) !== serialized)
      throw new Error(
        `Generated corpus drift: ${id}. Run npm run fixtures:generate.`,
      );
  } else await writeFile(file, serialized);
  console.log(
    `${check ? "Checked" : "Generated"} ${id}: ${corpus.fixtures.length} files`,
  );
}
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
  if (check && current !== serialized) throw new Error(`Assessment drift: ${id}`);
  if (!check) await writeFile(file, serialized);
}
const assignmentFile = new URL('../benchmarks/fixture-detectors.json', import.meta.url);
const current = await readFile(assignmentFile, 'utf8');
const assignments = JSON.parse(current);
for (const f of generated['common-formats'].fixtures) assignments[`common-formats--${f.id}`] = f.detectors;
const serialized = JSON.stringify(assignments, null, 2) + '\n';
if (check && current !== serialized) throw new Error('Detector assignment drift');
if (!check) await writeFile(assignmentFile, serialized);
