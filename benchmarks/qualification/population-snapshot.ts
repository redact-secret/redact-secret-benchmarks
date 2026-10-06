import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCorpora } from '../../fixtures/generated/build.mjs';
import { buildTwinScopeCorpus, TWIN_SCOPE_CATEGORY } from '../../fixtures/generated/twin-scope.mjs';
import { validateCorpus } from '../scoring/scoring.ts';
import { classifyFixture, controlAxis, validateAssessment, validateContracts } from '../evaluation/domains/credential/assessment.ts';
import type { Corpus, Fixture } from '../types.ts';
import { canonical, sha256Hex } from './canonical.ts';

/**
 * Corpus snapshots for the two product-owned credential populations (#604, docs/specs/official-runs.md).
 * One population is one CorpusSnapshot v1 and one credential-eval run (credential-eval
 * docs/multi-corpus-qualification.md section 3); populations are never concatenated. Cases are exactly the
 * authored fixtures, projected the way credential-eval's legacy exporter projected them (assessment and control
 * axis read, never re-derived). Nothing here reads scanner output, and the digests are content-addressed: they do
 * not depend on the benchmark commit, a clock or the host.
 */
export const PRODUCT_POPULATIONS = ['regression-corpus', 'policy-corpus'] as const;
export type ProductPopulation = typeof PRODUCT_POPULATIONS[number];

export const SNAPSHOT_SCHEMA = 'credential-eval/corpus-snapshot/v1';
export const SNAPSHOT_ENTRY = 'credential-eval/corpus-snapshot.json';
export const MANIFEST_FORMAT = 'redact-secret-benchmarks/population-release-manifest';
const EVIDENCE_SCHEMA = 'redact-secret-benchmarks/fixtures/v2';
const SOURCES: Record<ProductPopulation, string> = {
  'regression-corpus': 'redact-secret-benchmarks/regression',
  'policy-corpus': 'redact-secret-benchmarks/policy',
};
const TAG_PREFIX: Record<ProductPopulation, string> = { 'regression-corpus': 'regression', 'policy-corpus': 'policy' };

const root = fileURLToPath(new URL('../../', import.meta.url));
const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

/** Product-side metadata keyed by case id. Policy facts never enter the snapshot (qualification-boundary 3.8). */
export interface CaseMetadata { group: string; contextAxis?: string; expectedAction?: string; policyConformance?: boolean; axisCategory?: string }

export interface PopulationExport {
  population: ProductPopulation;
  categories: string[];
  snapshot: Record<string, unknown>;
  snapshotBytes: string;
  corpusDigest: string;
  tag: string;
  manifest: Record<string, unknown>;
  manifestBytes: string;
  manifestDigest: string;
  metadata: Record<string, CaseMetadata>;
  caseCount: number;
}

/** The categories a population measures: the regression manifest, and the one policy category. */
export async function populationCategories(population: ProductPopulation): Promise<string[]> {
  if (population === 'regression-corpus') {
    const manifest = JSON.parse(await readFile(path.join(root, 'corpora/regression/manifest.json'), 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.visibility !== 'regression' || !Array.isArray(manifest.categories)) throw new Error('Invalid regression corpus manifest');
    // `qualificationCategories` are measured by the qualification path only: the legacy partitions and categories.json do not list them.
    const extra = manifest.qualificationCategories ?? [];
    if (!Array.isArray(extra) || extra.some((id: unknown) => typeof id !== 'string' || manifest.categories.includes(id))) throw new Error('Invalid regression corpus manifest: qualificationCategories');
    return [...manifest.categories, ...extra];
  }
  const inputs = JSON.parse(await readFile(path.join(root, 'benchmarks/qualification-inputs.json'), 'utf8'));
  const category = inputs.populations.find((p: { id: string }) => p.id === 'policy-corpus')?.currentLocation?.category;
  if (typeof category !== 'string') throw new Error('policy-corpus names no category in benchmarks/qualification-inputs.json');
  return [category];
}

const CASE_ID = /^[a-z0-9][a-z0-9-]*$/;

export async function exportPopulation(population: ProductPopulation): Promise<PopulationExport> {
  validateContracts();
  const categories = await populationCategories(population);
  const qualificationOnly = new Set<string>(population === 'regression-corpus' ? (JSON.parse(await readFile(path.join(root, 'corpora/regression/manifest.json'), 'utf8')).qualificationCategories ?? []) : []);
  const catalog: { id: string; corpus: string; calibrationOnly?: boolean }[] = JSON.parse(await readFile(path.join(root, 'benchmarks/categories.json'), 'utf8'));
  const detectorMap: Record<string, string[]> = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-detectors.json'), 'utf8'));
  const generated: Record<string, Corpus> = buildCorpora();
  const cases: Record<string, unknown>[] = [];
  const metadata: Record<string, CaseMetadata> = {};
  const storage = ['fixtures', 'corpora/development', 'corpora/regression'].map(p => path.join(root, p) + path.sep);

  for (const id of categories) {
    const category = catalog.find(c => c.id === id);
    // A qualification-only category is built here (fixtures/generated/twin-scope.mjs) and is in no legacy catalog; every other category must be in the catalog.
    if (!category && !(id === TWIN_SCOPE_CATEGORY && qualificationOnly.has(id))) throw new Error(`Population ${population} names unknown category ${id}`);
    if (category?.calibrationOnly) throw new Error(`Category ${id} is calibration-only and cannot be a measured population`);
    let input = id === TWIN_SCOPE_CATEGORY ? buildTwinScopeCorpus() : generated[id];
    if (!input) {
      const source = path.resolve(root, category!.corpus);
      if (!storage.some(directory => source.startsWith(directory))) throw new Error(`Corpus of ${id} points outside fixture storage`);
      input = JSON.parse(await readFile(await realpath(source), 'utf8'));
    }
    const corpus = validateCorpus(input);
    for (const f of corpus.fixtures as Fixture[]) {
      validateAssessment(f);
      if (JSON.stringify(f.assessment) !== JSON.stringify(classifyFixture(id, f))) throw new Error(`Stale fixture assessment: ${id}/${f.id}`);
      if (/[\uD800-\uDFFF]/u.test(f.content.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''))) throw new Error(`Lone surrogate in ${id}/${f.id}`);
      const caseId = `${id}--${f.id}`;
      if (!CASE_ID.test(caseId) || caseId.length > 256) throw new Error(`Case id is not a valid credential-eval id: ${caseId}`);
      // Evaluation targets exactly as loadCases builds them.
      const targets = [...new Set([...(detectorMap[caseId] ?? f.detectors ?? []), ...(f.arrivalTargets ?? [])])].sort(byteOrder);
      const a = f.assessment;
      const control = !f.twinOf && !f.expected.some(e => (e.role ?? 'secret') === 'secret');
      const taxonomy = control && a.tier !== 'T0' ? controlAxis(id, f) : null;
      cases.push({
        id: caseId,
        path: `${id}/${f.path}`,
        content: f.content,
        expected: f.expected.map(e => ({
          start: e.start, end: e.end, role: e.role ?? 'secret',
          ...(e.envelope ? { envelope: { start: e.envelope.start, end: e.envelope.end, reason: e.envelope.reason } } : {}),
        })),
        grouping: {
          kind: a.kind, tier: a.tier, ...(a.contract ? { family: a.contract } : {}), group: id,
          ...(targets.length ? { targets } : {}),
          ...(taxonomy ? { taxonomy } : {}),
        },
        ...(f.twinOf ? { twin: { twin_of: `${id}--${f.twinOf}`, mutation: f.mutation, mutation_kind: f.mutationKind } } : {}),
      });
      metadata[caseId] = {
        group: f.group,
        ...(f.copyOf ? { axisCategory: f.copyOf } : {}),
        ...(f.contextAxis ? { contextAxis: f.contextAxis } : {}),
        ...(f.expectedAction ? { expectedAction: f.expectedAction } : {}),
        ...(f.policyConformance ? { policyConformance: true } : {}),
      };
    }
  }
  cases.sort((a, b) => byteOrder(a.id as string, b.id as string));
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error(`Population ${population} repeats a case id`);
  if (new Set(cases.map(c => c.path)).size !== cases.length) throw new Error(`Population ${population} repeats a fixture path`);
  if (!cases.length) throw new Error(`Population ${population} has no cases`);

  const corpusHex = sha256Hex(canonical(cases));
  const corpusDigest = `sha256:${corpusHex}`;
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    // Content-addressed identity: the revision is the corpus digest, so the artifact's semantic digest does not move
    // with the benchmark commit when the cases did not change.
    identity: { source: SOURCES[population], revision: `corpus-sha256:${corpusHex}`, evidence_schema: EVIDENCE_SCHEMA, corpus_digest: corpusDigest },
    cases,
  };
  const snapshotBytes = `${JSON.stringify(snapshot)}\n`;
  const tag = `${TAG_PREFIX[population]}-${corpusHex.slice(0, 12)}`;
  const manifest = {
    format: MANIFEST_FORMAT, version: 1, population, tag,
    files: [{ path: SNAPSHOT_ENTRY, sha256: sha256Hex(snapshotBytes) }],
  };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  return {
    population, categories, snapshot, snapshotBytes, corpusDigest, tag, manifest, manifestBytes,
    manifestDigest: `sha256:${sha256Hex(manifestBytes)}`, metadata, caseCount: cases.length,
  };
}
