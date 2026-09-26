/**
 * Generate or check the fixture semantic index (#340).
 *
 * This command never infers family or scenario membership. The complete,
 * reviewed assignments live in benchmarks/fixture-semantics.json. Corpus
 * fixtures provide only canonical source/provenance references and relations.
 */
import { readFile, writeFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildFixtureIndex, fixtureIndexProblems } from '../benchmarks/lib/fixture-index.ts';

const readText = file => readFile(file, 'utf8');
const read = async file => JSON.parse(await readText(file));
const categories = await read('benchmarks/categories.json');
const taxonomy = await read('benchmarks/support/taxonomy.json');
const scenarios = await read('benchmarks/scenarios.json');
const reviewed = await read('benchmarks/fixture-semantics.json');
const corpora = Object.fromEntries(await Promise.all(categories.filter(c => !c.calibrationOnly).map(async c => [c.id, await read(c.corpus)])));

const ajv = new Ajv2020({ strict: true, allErrors: true });
for (const [name, value, schemaFile] of [
  ['scenario registry', scenarios, 'schemas/scenarios-v1.json'],
  ['reviewed fixture semantics', reviewed, 'schemas/fixture-semantics-v1.json'],
]) {
  const validate = ajv.compile(await read(schemaFile));
  if (!validate(value)) throw new Error(`Invalid ${name}: ${JSON.stringify(validate.errors)}`);
}

const index = buildFixtureIndex({ categories, corpora, taxonomy, scenarios, reviewed });
const validateIndex = ajv.compile(await read('schemas/fixture-index-v1.json'));
if (!validateIndex(index)) throw new Error(`Invalid generated fixture index: ${JSON.stringify(validateIndex.errors)}`);
const problems = fixtureIndexProblems(index);
if (problems.length) throw new Error(`Invalid generated fixture index: ${problems.join('; ')}`);

const file = 'benchmarks/fixture-index.json';
const expected = JSON.stringify(index, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const actual = await readText(file).catch(() => null);
  if (actual !== expected) {
    console.error(`::error file=${file}::${file} is stale — run \`npm run fixture-index:generate\` and commit the result`);
    process.exitCode = 1;
  } else {
    console.log(`Fixture index is current: ${index.identity.fixtureCount} fixtures, semantic digest ${index.identity.digest}.`);
  }
} else {
  await writeFile(file, expected);
  console.log(`Wrote ${file}: ${index.identity.fixtureCount} fixtures, semantic digest ${index.identity.digest}.`);
}
