/**
 * CI gate for the support-status UI (#50, A9): the site may not carry a
 * support status the generated matrix does not have.
 *
 * Three ways that could break, all checked here:
 *  1. the page's status copy drifts from the artifact's own vocabulary
 *     (`schemas/support-matrix-v1.json`) — an invented or renamed status;
 *  2. a status is written into markup instead of read from the matrix — the
 *     probe renders a matrix carrying one status and fails if any other one
 *     appears;
 *  3. a second page starts rendering support statuses, out of this gate's
 *     reach.
 *
 * The providers roadmap (#478) is held to the same rule by checkProvidersUi:
 * its stages and verdicts are the generated file's own vocabulary, every
 * taxonomy family is listed once, a stage or verdict is read from the file and
 * never written into markup, and nothing on the page or in the schema forecasts
 * a date.
 *
 * Run: npm run support:check:ui
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { supportPage, SUPPORT_STATUS_COPY } from '../src/pages/support.ts';
import { supportMatrixProblem } from '../benchmarks/shared/support-model.ts';
import { providersPage, PROVIDER_STAGE_COPY, DOSSIER_VERDICT_COPY } from '../src/pages/providers.ts';
import { providerDossiersProblem, PROVIDER_STAGES, DOSSIER_VERDICTS } from '../src/providers-model.ts';
import { buildProviderDossiers, defaultInputs, STAGES } from '../benchmarks/generate-provider-dossiers.ts';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';
import fixtureIndex from '../benchmarks/fixture-index.json' with { type: 'json' };
import { findingTypeSource } from '../benchmarks/support/finding-types.ts';
import { buildPiiMatrixSection } from '../benchmarks/support/pii-families.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
/** The PII section a generated matrix carries (#647), read once from the committed aggregate records. */
const piiSection = await buildPiiMatrixSection(fileURLToPath(new URL('../', import.meta.url)));
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sorted = values => [...values].sort();
const titleCase = value => value.slice(0, 1).toUpperCase() + value.slice(1);
/** Every status the rendered HTML attributes to a family, a legend entry or a filter. */
const rendered = html => new Set([...html.matchAll(/data-support-status="([^"]*)"/g)].map(match => match[1]));

/** A matrix in which every family carries one status, built from the checked-in taxonomy. */
function probeMatrix(status, vocabulary) {
  const profileCoverage = {
    profilesVersion: 1, claimed: 'stable-documented', explicit: false, target: 'stable-documented', cellsMet: ['arrival-provisional', 'stable-documented'],
    cells: { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4, confusionAxes: 4, positiveContextAxisIds: ['env'], controlAxisIds: ['ordinary-prose'], confusionAxisIds: ['near-miss'] },
    requiredCells: { totalFixtures: 24, positiveCases: 6, benignControls: 8, twinPairs: 5, positiveContextAxes: 4, controlAxes: 4 }, requiredButEmptyAxisIds: [], debt: [],
  };
  const families = taxonomy.families.map(family => ({
    provider: family.provider, family: family.id, familyName: family.name, status,
    evidenceTier: 'T1', providerSource: { url: 'https://example.invalid/format', observedAt: '2026-09-20', formatVersion: 'probe', covers: 'probe' },
    evidenceBasis: 'provider-documented', qualificationProfile: status === 'stable' ? 'documented' : null,
    corroboratingScanners: [], twinCoverage: { pairs: 0, failures: 0, unprobeable: null },
    unresolvedCriticalItems: { metamorphic: 0, mutation: 0, differential: 0 },
    empiricalEvidence: { observations: 0, subjects: 0, issuanceDates: 0, corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [], contradictions: 0, boundedContradictions: 0, uncertainty: null, supportedContexts: [], mode: null, supportsBareValues: true },
    fixtureProfile: { positiveCases: 6, positiveAxes: 4, benignCases: 8, controlAxes: 4, twinPairs: 5, totalFixtures: 24, contextTwinPairs: 0, confusionAxes: 4 },
    profileCoverage,
    detectors: ['probe-detector'], findingTypes: null, reason: status === 'stable' ? null : `probe: ${status}`,
  }));
  const distribution = Object.fromEntries(vocabulary.map(key => [key, key === status ? families.length : 0]));
  const stableDistribution = { documented: status === 'stable' ? families.length : 0, empirical: 0 };
  return {
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T00:00:00.000Z', runId: 'probe-run', revision: '0'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
      fixtureIndex: fixtureIndex.identity, taxonomyDigest: fixtureIndex.sources.taxonomy.digest,
      scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-09-20T00:00:00.000Z', sourceRunId: 'probe-run' } } },
    providerCount: taxonomy.providers.length, familyCount: families.length, distribution, stableDistribution, families,
    findingTypeSource, ...structuredClone(piiSection),
  };
}

async function uiFilesRenderingStatuses() {
  const found = [];
  const walk = async dir => {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(relative);
      else if (/\.(ts|mjs)$/.test(entry.name) && (await readFile(path.join(root, relative), 'utf8')).includes('data-support-status')) found.push(relative);
    }
  };
  await walk('src');
  return found;
}

/** A file's families with the stage/verdict a probe chooses; deliberately not validated, the page must render what it is given. */
function probedDossiers(base, patch) {
  const file = structuredClone(base);
  for (const provider of file.providers) for (const family of provider.families) Object.assign(family, patch);
  return file;
}
const articles = html => [...html.matchAll(/<article data-stage="([^"]*)" data-verdict="([^"]*)" data-family="([^"]*)"/g)].map(match => ({ stage: match[1], verdict: match[2], family: match[3] }));
const propertyNames = value => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => [key, ...propertyNames(child)]) : [];

/** The providers roadmap cannot drift from the taxonomy, its schema, or the dossier schema, and never promises a date. */
export async function checkProvidersUi() {
  const problems = [];
  const schema = await read('schemas/provider-dossiers-v1.json');
  const dossierSchema = await read('schemas/dossier-v1.json');
  const stages = schema.definitions.stage.enum;
  const verdicts = schema.definitions.family.properties.verdict.enum;
  const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
  if (!same(stages, Object.keys(schema.properties.stageDistribution.properties)) || !same(stages, Object.keys(schema.definitions.family.properties.reached.properties)))
    problems.push('provider-dossiers-v1.json disagrees with itself: the stage enum, stageDistribution keys and reached keys differ');
  if (!same(verdicts, Object.keys(schema.properties.verdictDistribution.properties))) problems.push('provider-dossiers-v1.json disagrees with itself: the verdict enum and verdictDistribution keys differ');
  if (!same(verdicts, dossierSchema.$defs.research.properties.verdict.enum)) problems.push('provider-dossiers-v1.json verdicts differ from schemas/dossier-v1.json: a verdict a dossier can carry has no place on the roadmap, or the reverse');
  if (JSON.stringify(stages) !== JSON.stringify([...STAGES]) || JSON.stringify(stages) !== JSON.stringify(PROVIDER_STAGES)) problems.push('The generator, the schema and the UI model disagree on the stages or their order');
  if (!same(verdicts, DOSSIER_VERDICTS)) problems.push('The UI model disagrees with the schema on the verdicts');
  const stageCopy = Object.keys(PROVIDER_STAGE_COPY), verdictCopy = Object.keys(DOSSIER_VERDICT_COPY);
  for (const stage of stageCopy) if (!stages.includes(stage)) problems.push(`The UI carries the stage "${stage}", which the roadmap cannot: it is not in schemas/provider-dossiers-v1.json`);
  for (const stage of stages) if (!stageCopy.includes(stage)) problems.push(`The roadmap can carry the stage "${stage}", and the UI has no copy for it: src/pages/providers.ts would render undefined`);
  for (const verdict of verdictCopy) if (!verdicts.includes(verdict)) problems.push(`The UI carries the verdict "${verdict}", which the roadmap cannot`);
  for (const verdict of verdicts) if (!verdictCopy.includes(verdict)) problems.push(`The roadmap can carry the verdict "${verdict}", and the UI has no copy for it`);
  for (const name of propertyNames(schema).filter(name => /^(eta|etas|expected\w*|forecast\w*|deadline|targetDate|dueDate|estimate\w*)$/i.test(name)))
    problems.push(`schemas/provider-dossiers-v1.json has a "${name}" field: the roadmap answers "when" with a stage and a blocker, never a date`);

  let base;
  try { base = buildProviderDossiers(defaultInputs(null)); } catch (error) { return [...problems, `The generator cannot build the roadmap from the checked-in dossiers: ${error.message.split('\n')[0]}`]; }
  const invalid = providerDossiersProblem(base);
  if (invalid) return [...problems, `The generated roadmap is rejected by the page's own validator (${invalid}); the gate cannot be trusted until it is fixed`];
  const html = providersPage(base, null, 'all');
  const rows = articles(html);
  const listed = new Set(rows.map(row => row.family));
  if (rows.length !== taxonomy.families.length || listed.size !== rows.length) problems.push(`The roadmap page lists ${rows.length} families (${listed.size} distinct) of ${taxonomy.families.length} in the taxonomy: every family stays visible`);
  for (const family of taxonomy.families) if (!listed.has(family.id)) problems.push(`The roadmap page does not list the taxonomy family ${family.id}`);
  for (const stage of stages) {
    const shown = articles(providersPage(probedDossiers(base, { stage }), null, 'all'));
    for (const row of shown) if (row.stage !== stage) problems.push(`Rendering a ${stage} roadmap lists a family at "${row.stage}"`);
    if (shown.length !== taxonomy.families.length) problems.push(`Rendering a ${stage} roadmap lists ${shown.length} families of ${taxonomy.families.length}`);
  }
  for (const verdict of verdicts) for (const row of articles(providersPage(probedDossiers(base, { verdict }), null, 'all')))
    if (row.verdict !== verdict) problems.push(`Rendering a ${verdict} roadmap lists a family as "${row.verdict}"`);
  const promise = /\b(ETA|coming soon|expected (?:by|in|on)|will be (?:supported|available|added)|planned for|due (?:by|in))\b/i.exec(html.replace(/<[^>]+>/g, ' '));
  if (promise) problems.push(`The roadmap page promises a date or delivery ("${promise[0]}"): it states a stage and a blocker only`);

  const files = [];
  const walk = async dir => {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(relative);
      else if (/\.(ts|mjs)$/.test(entry.name) && (await readFile(path.join(root, relative), 'utf8')).includes('data-stage=')) files.push(relative);
    }
  };
  await walk('src');
  if (files.join() !== 'src/pages/providers.ts') problems.push(`data-stage is rendered by ${files.join(', ') || 'no file'}; this gate only sees src/pages/providers.ts`);

  const published = path.join(root, 'public/results/provider-dossiers-v1.json');
  try {
    const file = JSON.parse(await readFile(published, 'utf8'));
    const problem = providerDossiersProblem(file);
    if (problem) problems.push(`public/results/provider-dossiers-v1.json is published but the UI would reject it: ${problem}`);
  } catch (error) {
    if (error.code !== 'ENOENT') problems.push(`public/results/provider-dossiers-v1.json is unreadable: ${error.message}`);
  }
  return problems;
}

export async function checkSupportUi() {
  const problems = [...await checkProvidersUi()];
  const schema = await read('schemas/support-matrix-v1.json');
  const vocabulary = schema.properties.families.items.properties.status.enum;
  const distributionKeys = Object.keys(schema.properties.distribution.properties);
  if (JSON.stringify(sorted(vocabulary)) !== JSON.stringify(sorted(distributionKeys)))
    problems.push(`support-matrix-v1.json disagrees with itself: status enum ${sorted(vocabulary)} vs distribution keys ${sorted(distributionKeys)}`);

  const copy = Object.keys(SUPPORT_STATUS_COPY);
  for (const status of copy) if (!vocabulary.includes(status)) problems.push(`The UI carries the support status "${status}", which the matrix cannot: it is not in schemas/support-matrix-v1.json`);
  for (const status of vocabulary) if (!copy.includes(status)) problems.push(`The matrix can carry "${status}", and the UI has no copy for it: src/pages/support.ts would render undefined`);
  for (const [status, entry] of Object.entries(SUPPORT_STATUS_COPY))
    if (entry.word !== titleCase(status)) problems.push(`The UI renames "${status}" to "${entry.word}"; a status is shown under its own name or not at all`);

  for (const status of vocabulary.filter(value => copy.includes(value))) {
    const matrix = probeMatrix(status, vocabulary);
    const invalid = supportMatrixProblem(matrix);
    if (invalid) { problems.push(`The ${status} probe matrix is not a valid artifact (${invalid}); the gate cannot be trusted until it is`); continue; }
    const shown = rendered(supportPage(matrix, null, 'all'));
    for (const value of shown) if (!Object.hasOwn(matrix.distribution, value)) problems.push(`Rendering a ${status} matrix shows "${value}", a status that matrix does not carry`);
    const rows = [...supportPage(matrix, null, 'all').matchAll(/<article data-support-status="([^"]*)"/g)].map(match => match[1]);
    if (rows.length !== matrix.families.length) problems.push(`Rendering a ${status} matrix lists ${rows.length} families of ${matrix.families.length}: every family stays visible, whatever its status`);
    for (const value of new Set(rows)) if (value !== status) problems.push(`Rendering a ${status} matrix lists a family as "${value}"`);
  }

  const files = await uiFilesRenderingStatuses();
  const expected = ['src/pages/coverage.ts', 'src/pages/pii-support.ts', 'src/pages/support.ts'];
  for (const file of files) if (!expected.includes(file)) problems.push(`${file} renders support statuses; this gate only sees ${expected.join(', ')}`);
  for (const file of expected) if (!files.includes(file)) problems.push(`${file} no longer marks rendered statuses with data-support-status, so this gate cannot see them`);

  const published = path.join(root, 'public/results/support-matrix-v1.json');
  try {
    const matrix = JSON.parse(await readFile(published, 'utf8'));
    const invalid = supportMatrixProblem(matrix);
    if (matrix.piiCurrentQualification && JSON.stringify(matrix.piiCurrentQualification) !== JSON.stringify(piiSection.piiCurrentQualification))
      problems.push('Published current PII qualification does not reconcile with the verified public comparison package');
    if (invalid) problems.push(`public/results/support-matrix-v1.json is published but the UI would reject it: ${invalid}`);
    else for (const value of rendered(supportPage(matrix, null, 'all'))) if (!Object.hasOwn(matrix.distribution, value)) problems.push(`The published matrix does not carry "${value}", and the page renders it`);
  } catch (error) {
    if (error.code !== 'ENOENT') problems.push(`public/results/support-matrix-v1.json is unreadable: ${error.message}`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkSupportUi();
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log(`Support UI gate passed: ${Object.keys(SUPPORT_STATUS_COPY).join(', ')} are exactly the statuses the generated matrix can carry, and ${Object.keys(PROVIDER_STAGE_COPY).join(', ')} the stages the providers roadmap can carry.`);
}
