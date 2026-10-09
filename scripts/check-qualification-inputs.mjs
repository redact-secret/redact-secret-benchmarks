/**
 * CI gate: `benchmarks/qualification-inputs.json` (#603) names the five
 * qualification input populations, each with an owner, a run class, one
 * denominator of its own and a pin, and gives every legacy qualification input
 * an owner and a disposition. This gate checks structure only: it never reads
 * a fixture, a count or a ledger value, and it asserts nothing about the product.
 * The spec is docs/specs/qualification-inputs.md.
 *
 * Run: npm run qualification-inputs:check
 */
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { decisionStatus } from './lib/decision-provenance.mjs';

const root = new URL('../', import.meta.url);
export const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus', 'candidate-regression-inputs', 'protected-holdout'];
const RUN_CLASSES = ['public', 'internal'];
const DISPOSITIONS = ['migrate-to-credential-evidence', 'remain-product-owned', 'specialized-protected-outside-credential-eval', 'obsolete-compatibility-only'];
const PIN_STATES = ['pending', 'resolved-at-run', 'not-applicable'];
const PIN_FIELDS = ['sourceRevision', 'runArtifact', 'productPolicyRevision'];
const SUPERSEDED_RELEASES = ['snapshot-2026.10.01'];

const exists = async path => stat(new URL(path, root)).then(() => true, () => false);

/** Pure structural check of a parsed manifest; `pathExists` and `decisionAccepted` are injected so structural tests need no disk. */
export async function qualificationInputProblems(manifest, pathExists, decisionAccepted = pathExists) {
  const problems = [];
  const populations = manifest.populations ?? [];
  const ids = populations.map(p => p.id);
  if (manifest.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (ids.join(',') !== POPULATIONS.join(',')) problems.push(`populations must be exactly, in order: ${POPULATIONS.join(', ')}`);
  const denominators = populations.map(p => p.denominator);
  if (new Set(denominators).size !== denominators.length) problems.push('two populations share a denominator');

  for (const p of populations) {
    const at = `population ${p.id}`;
    if (p.denominator !== p.id) problems.push(`${at}: denominator must be its own id, never a combined one`);
    if (!p.owner || !p.ownerKind) problems.push(`${at}: owner and ownerKind are required`);
    if (!DISPOSITIONS.includes(p.disposition)) problems.push(`${at}: unknown disposition ${p.disposition}`);
    if (!Array.isArray(p.runClasses) || p.runClasses.length === 0 || p.runClasses.some(c => !RUN_CLASSES.includes(c))) problems.push(`${at}: runClasses must be a non-empty subset of ${RUN_CLASSES.join(', ')}`);
    if (!p.currentLocation?.kind) problems.push(`${at}: currentLocation.kind is required`);
    for (const path of p.currentLocation?.paths ?? []) if (!(await pathExists(path))) problems.push(`${at}: path does not exist: ${path}`);
    for (const key of ['manifest', 'contract', 'catalog']) {
      const path = p.currentLocation?.[key];
      if (path && !(await pathExists(path))) problems.push(`${at}: ${key} does not exist: ${path}`);
    }
    const pin = p.pin ?? {};
    for (const field of PIN_FIELDS) {
      const value = pin[field];
      if (typeof value === 'string') continue;
      if (!value || !PIN_STATES.includes(value.state)) problems.push(`${at}: pin.${field} must be a value or a state in ${PIN_STATES.join(', ')}`);
      else if (value.state === 'pending' && !/^#\d+$/.test(value.resolvedBy ?? '')) problems.push(`${at}: pin.${field} is pending without a resolving issue`);
    }
  }

  const snapshot = populations.find(p => p.id === 'public-evidence-snapshot')?.pin;
  if (snapshot) {
    if (!/^[a-f0-9]{40}$/.test(snapshot.sourceRevision ?? '')) problems.push('public-evidence-snapshot: sourceRevision must be a full 40-hex commit');
    for (const field of ['manifestDigest', 'snapshotDigest']) if (!/^sha256:[a-f0-9]{64}$/.test(snapshot[field] ?? '')) problems.push(`public-evidence-snapshot: ${field} must be sha256:<64 hex>`);
    if (!snapshot.evidenceRelease || SUPERSEDED_RELEASES.includes(snapshot.evidenceRelease)) problems.push('public-evidence-snapshot: evidenceRelease is missing or names a superseded release');
    if (!/^credential-eval-protocol\/\d+$/.test(snapshot.evalProtocol ?? '')) problems.push('public-evidence-snapshot: evalProtocol must be credential-eval-protocol/<n>');
    if (!snapshot.evalVersion) problems.push('public-evidence-snapshot: evalVersion is required');
  }
  const holdout = populations.find(p => p.id === 'protected-holdout');
  if (holdout && (holdout.runClasses ?? []).includes('public')) problems.push('protected-holdout: must not carry the public run class');
  const candidates = populations.find(p => p.id === 'candidate-regression-inputs');
  if (candidates && (candidates.runClasses ?? []).includes('public')) problems.push('candidate-regression-inputs: must not carry the public run class');

  for (const input of manifest.legacyInputs ?? []) {
    const at = `legacy input ${input.path}`;
    if (!(await pathExists(input.path))) problems.push(`${at}: path does not exist`);
    if (!input.owner) problems.push(`${at}: owner is required`);
    if (!DISPOSITIONS.includes(input.disposition)) problems.push(`${at}: unknown disposition ${input.disposition}`);
    if (input.population !== null && !ids.includes(input.population)) problems.push(`${at}: unknown population ${input.population}`);
    if (input.population === null && !input.role) problems.push(`${at}: an input outside every population must name its role`);
    const population = populations.find(p => p.id === input.population);
    if (population && population.disposition !== input.disposition) problems.push(`${at}: disposition differs from its population ${population.id}`);
  }
  for (const id of ids) if (!(manifest.legacyInputs ?? []).some(input => input.population === id)) problems.push(`population ${id}: no legacy input maps to it`);

  for (const change of manifest.supportStatusChanges ?? []) {
    if (!change.family || !change.reason || !change.decision || !change.productPolicyRevision) problems.push('supportStatusChanges entries need family, reason, decision and productPolicyRevision');
    if (change.decision && !(await decisionAccepted(change.decision))) problems.push(`supportStatusChanges: decision has no validated accepted provenance: ${change.decision}`);
    // The stamp is defined by the adapter (#605, docs/specs/qualification-adapter.md).
    if (change.productPolicyRevision && !/^rs-policy-\d+:sha256:[0-9a-f]{64}$/.test(change.productPolicyRevision)) problems.push(`supportStatusChanges: productPolicyRevision must be an adapter stamp (rs-policy-<n>:sha256:<64 hex>) for ${change.family}`);
  }
  if (!(await pathExists(manifest.spec))) problems.push(`spec does not exist: ${manifest.spec}`);
  if (!(await decisionAccepted(manifest.decision))) problems.push(`decision has no validated accepted provenance: ${manifest.decision}`);
  return problems;
}

export async function checkQualificationInputs() {
  const manifest = JSON.parse(await readFile(new URL('benchmarks/qualification-inputs.json', root), 'utf8'));
  const problems = await qualificationInputProblems(manifest, exists, path => decisionStatus(path) === 'accepted');
  // The two corpus manifests partition the catalog; each category belongs to exactly one population view.
  const [development, regression, catalog] = await Promise.all(['corpora/development/manifest.json', 'corpora/regression/manifest.json', 'benchmarks/categories.json']
    .map(path => readFile(new URL(path, root), 'utf8').then(JSON.parse)));
  const overlap = development.categories.filter(id => regression.categories.includes(id));
  if (overlap.length > 0) problems.push(`corpora development and regression partitions overlap: ${overlap.join(', ')}`);
  // Qualification-only categories (#602) are measured by the qualification path alone: no legacy partition or catalog lists them, so the legacy path never loads them.
  for (const id of regression.qualificationCategories ?? []) {
    if (development.categories.includes(id) || regression.categories.includes(id)) problems.push(`regression corpus: qualification-only category ${id} is also listed in a legacy partition`);
    if (catalog.some(category => category.id === id)) problems.push(`regression corpus: qualification-only category ${id} is in benchmarks/categories.json, which the legacy path reads`);
  }
  const policy = manifest.populations.find(p => p.id === 'policy-corpus')?.currentLocation?.category;
  if (policy && !catalog.some(category => category.id === policy)) problems.push(`policy-corpus: category ${policy} is not in benchmarks/categories.json`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkQualificationInputs();
  if (problems.length > 0) {
    console.error(`${problems.length} qualification-input problem(s):\n${problems.map(problem => `  - ${problem}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Qualification inputs: every population has an owner, a run class, its own denominator and a pin.');
}
