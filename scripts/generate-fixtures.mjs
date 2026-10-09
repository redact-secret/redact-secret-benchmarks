import { readFile, writeFile } from "node:fs/promises";
import { buildCorpora } from "../fixtures/generated/build.mjs";
import { validateCorpus } from "../benchmarks/scoring/scoring.ts";
import { classifyFixture, validateAssessment, validateContracts, contracts } from "../benchmarks/lib/assessment.ts";
import { validateStructures } from '../benchmarks/lib/validate-structures.ts';
import { checkLexicalSeparability, validateLexicalExemptions } from '../benchmarks/lib/lexical-separability.ts';
import { createHash } from 'node:crypto';
import { validateBeta8 } from '../benchmarks/lib/credential-regressions/index.ts';
import { categoriesOf, loadPopulations, populationProblems } from '../fixtures/generated/populations.mjs';

const usage = 'Usage: generate-fixtures.mjs [--check | --ensure] [--population <id>]... (a population needs --check or --ensure)';
const args = process.argv.slice(2);
const populationIds = [];
const flags = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--population') { if (!args[i + 1]) throw new Error(usage); populationIds.push(args[++i]); } else flags.push(args[i]);
}
const check = flags.includes('--check');
const ensure = flags.includes('--ensure');
if (flags.some(arg => !['--check', '--ensure'].includes(arg)) || (check && ensure) || (populationIds.length && !check && !ensure)) throw new Error(usage);
validateContracts();
const beta8Problems = validateBeta8(JSON.parse(await readFile(new URL('../benchmarks/detectors.json', import.meta.url), 'utf8')).detectors.map(d => d.id), JSON.parse(await readFile(new URL('../benchmarks/support/taxonomy.json', import.meta.url), 'utf8')).families.map(f => f.id));
if (beta8Problems.length) throw new Error(`Beta.8 module problems:\n${beta8Problems.map(p => `  - ${p}`).join('\n')}`);
const generated = buildCorpora();
// #659: every generated category has one owning population (benchmarks/generated-populations.json); a gap or an overlap fails before anything is written.
const populations = loadPopulations();
const partition = populationProblems({
  manifest: populations,
  generatedIds: Object.keys(generated),
  qualificationInputs: JSON.parse(await readFile(new URL('../benchmarks/qualification-inputs.json', import.meta.url), 'utf8')),
  regressionManifest: JSON.parse(await readFile(new URL('../corpora/regression/manifest.json', import.meta.url), 'utf8')),
});
if (partition.length) throw new Error(`Generated population problems:\n${partition.map(p => `  - ${p}`).join('\n')}`);
// A population run touches only that population's categories and their manifest entries. The whole-corpus gates (the hash manifest as a whole, the
// legacy annotation, lexical separability and the detector assignments) belong to the full run, which stays the default.
const scoped = populationIds.length > 0;
const selected = scoped ? new Set(populationIds.flatMap(id => categoriesOf(populations, id, Object.keys(generated)))) : null;
const committedManifest = scoped ? JSON.parse(await readFile(new URL('../benchmarks/generated-corpora.json', import.meta.url), 'utf8')) : null;
const manifest = {};
for (const [id, corpus] of Object.entries(generated)) {
  if (selected && !selected.has(id)) continue;
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
if (scoped) {
  for (const id of selected) if (JSON.stringify(committedManifest[id]) !== JSON.stringify(manifest[id])) throw new Error(`Generated corpus hash drift: ${id}. Review the generator change and run npm run fixtures:generate.`);
  console.log(`Checked populations ${populationIds.join(', ')}: ${selected.size} categories`);
  process.exit(0);
}
const manifestFile = new URL('../benchmarks/generated-corpora.json', import.meta.url);
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
if (check || ensure) {
  if (await readFile(manifestFile, 'utf8') !== manifestText) throw new Error('Generated corpus hash drift. Review the generator change and run npm run fixtures:generate.');
} else await writeFile(manifestFile, manifestText);
// Annotate hand-authored legacy fixtures without changing bytes or expectations.
const legacyCorpora = [];
for (const id of ['accuracy', 'token-contexts']) {
  const file = new URL(`../fixtures/${id}/corpus.json`, import.meta.url);
  const current = await readFile(file, 'utf8');
  const corpus = JSON.parse(current);
  corpus.schemaVersion = 2;
  for (const f of corpus.fixtures) {
    // Corpus schema 2: every span declares its role; bytes and ranges are untouched.
    f.expected = f.expected.map(({ start, end, note, role, envelope }) => ({ start, end, role: role ?? 'secret', note, ...(envelope ? { envelope } : {}) }));
    f.assessment = classifyFixture(id, f);
    validateAssessment(f);
  }
  validateCorpus(corpus);
  legacyCorpora.push(corpus);
  const serialized = JSON.stringify(corpus, null, 2) + '\n';
  if ((check || ensure) && current !== serialized) throw new Error(`Assessment drift: ${id}`);
  if (!check && !ensure && current !== serialized) await writeFile(file, serialized);
}
// #84: no fixture pair may be lexically inseparable, across the whole corpus.
const allFixtures = [...Object.values(generated).flatMap(c => c.fixtures), ...legacyCorpora.flatMap(c => c.fixtures)];
validateLexicalExemptions(allFixtures, contracts);
const lexicalViolations = checkLexicalSeparability(allFixtures, contracts);
if (lexicalViolations.length)
  throw new Error(`Lexically inseparable fixture pair(s):\n${lexicalViolations.map(v => `  - ${v.reason}`).join('\n')}`);
const assignmentFile = new URL('../benchmarks/fixture-detectors.json', import.meta.url);
const current = await readFile(assignmentFile, 'utf8');
const assignments = JSON.parse(current);
for (const [category, corpus] of Object.entries(generated))
  for (const f of corpus.fixtures)
    // Beta.8 arrival fixtures carry no registry detector: assigned [] like any untargeted case.
    if (f.detectors || f.arrivalTargets) assignments[`${category}--${f.id}`] = f.detectors ?? [];
// A beta8-<issue> fixture that no longer exists leaves no stale assignment behind (#207–#212).
for (const slug of Object.keys(assignments)) {
  const [category, id] = slug.split('--');
  if (category.startsWith('beta8-') && !generated[category]?.fixtures.some(f => f.id === id)) delete assignments[slug];
}
const serialized = JSON.stringify(assignments, null, 2) + '\n';
if ((check || ensure) && current !== serialized) throw new Error('Detector assignment drift');
if (!check && !ensure && current !== serialized) await writeFile(assignmentFile, serialized);
