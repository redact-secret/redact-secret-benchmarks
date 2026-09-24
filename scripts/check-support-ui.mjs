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
 * Run: npm run support:check:ui
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { supportPage, SUPPORT_STATUS_COPY } from '../src/pages/support.ts';
import { supportMatrixProblem } from '../src/support-model.ts';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sorted = values => [...values].sort();
const titleCase = value => value.slice(0, 1).toUpperCase() + value.slice(1);
/** Every status the rendered HTML attributes to a family, a legend entry or a filter. */
const rendered = html => new Set([...html.matchAll(/data-support-status="([^"]*)"/g)].map(match => match[1]));

/** A matrix in which every family carries one status, built from the checked-in taxonomy. */
function probeMatrix(status, vocabulary) {
  const families = taxonomy.families.map(family => ({
    provider: family.provider, family: family.id, familyName: family.name, status,
    evidenceTier: 'T1', providerSource: { url: 'https://example.invalid/format', observedAt: '2026-09-20', formatVersion: 'probe', covers: 'probe' },
    evidenceBasis: 'provider-documented', qualificationProfile: status === 'stable' ? 'documented' : null,
    corroboratingScanners: [], twinCoverage: { pairs: 0, failures: 0, unprobeable: null },
    unresolvedCriticalItems: { metamorphic: 0, mutation: 0, differential: 0 },
    empiricalEvidence: { observations: 0, subjects: 0, issuanceDates: 0, corroborationReferences: 0, corroborationOwners: 0, corroborationClasses: [], contradictions: 0, boundedContradictions: 0, uncertainty: null, supportedContexts: [], mode: null, supportsBareValues: true },
    fixtureProfile: { positiveCases: 6, positiveAxes: 4, benignCases: 8, controlAxes: 4, twinPairs: 5, totalFixtures: 24, contextTwinPairs: 0, confusionAxes: 4 },
    detectors: ['probe-detector'], reason: status === 'stable' ? null : `probe: ${status}`,
  }));
  const distribution = Object.fromEntries(vocabulary.map(key => [key, key === status ? families.length : 0]));
  const stableDistribution = { documented: status === 'stable' ? families.length : 0, empirical: 0 };
  return {
    schemaVersion: 1, taxonomySchemaVersion: taxonomy.schemaVersion,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T00:00:00.000Z', runId: 'probe-run', revision: '0'.repeat(40), dirty: false, criteriaSchemaVersion: 1 },
    providerCount: taxonomy.providers.length, familyCount: families.length, distribution, stableDistribution, families,
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

export async function checkSupportUi() {
  const problems = [];
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
    const rows = [...supportPage(matrix, null, 'all').matchAll(/<tr data-support-status="([^"]*)"/g)].map(match => match[1]);
    if (rows.length !== matrix.families.length) problems.push(`Rendering a ${status} matrix lists ${rows.length} families of ${matrix.families.length}: every family stays visible, whatever its status`);
    for (const value of new Set(rows)) if (value !== status) problems.push(`Rendering a ${status} matrix lists a family as "${value}"`);
  }

  const files = await uiFilesRenderingStatuses();
  const expected = ['src/pages/support.ts'];
  for (const file of files) if (!expected.includes(file)) problems.push(`${file} renders support statuses; this gate only sees ${expected.join(', ')}`);
  for (const file of expected) if (!files.includes(file)) problems.push(`${file} no longer marks rendered statuses with data-support-status, so this gate cannot see them`);

  const published = path.join(root, 'public/results/support-matrix-v1.json');
  try {
    const matrix = JSON.parse(await readFile(published, 'utf8'));
    const invalid = supportMatrixProblem(matrix);
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
  else console.log(`Support UI gate passed: ${Object.keys(SUPPORT_STATUS_COPY).join(', ')} are exactly the statuses the generated matrix can carry.`);
}
