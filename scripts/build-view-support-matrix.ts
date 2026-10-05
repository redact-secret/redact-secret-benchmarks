/**
 * Write the support matrix from a validated qualification view (#657), not from the legacy engine.
 *
 *   npm run qualification:matrix -- [--view public/results/qualification-v1.json] [--out results-output/support-matrix-from-view.json]
 *                                   [--mode published|candidate-projection]
 *
 * The view is validated against schemas/qualification-view-v1.json and bound to the pins of benchmarks/official-runs.json
 * (evidence identity, engine version, canonical semantic digests) before any matrix is written; a view built from other pins, or a
 * `published` matrix over a non-public run, an unrecorded artifact or a candidate scanner build, exits 1 and writes nothing.
 * The comparison with the legacy engine's `eval:matrix` is the parity report (`npm run qualification:parity`, its `matrix` section), which
 * attributes every legitimate difference by rule and fails on an unexplained one; a plain equality check would erase the architecture change.
 * Spec: docs/specs/qualification-adapter.md. This script asserts nothing about product output; it carries what the view holds.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMatrixArtifact, matrixArtifactProblems, type MatrixMode, type ViewForMatrix } from '../benchmarks/qualification/matrix-artifact.ts';
import { loadRegistry } from '../benchmarks/qualification/inputs.ts';
import { validateQualificationView } from '../benchmarks/qualification/view-schema.ts';

const usage = 'Usage: qualification:matrix [--view <file>] [--out <file>] [--mode published|candidate-projection]';
const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
if (args.length % 2 !== 0 || args.some((a, i) => i % 2 === 0 && !/^--(view|out|mode)$/.test(a))) throw new Error(usage);
const mode = (option('mode') ?? 'published') as MatrixMode;
if (mode !== 'published' && mode !== 'candidate-projection') throw new Error(usage);
const viewFile = path.resolve(option('view') ?? 'public/results/qualification-v1.json');
const out = path.resolve(option('out') ?? 'results-output/support-matrix-from-view.json');

const view = JSON.parse(await readFile(viewFile, 'utf8')) as ViewForMatrix & { populations: any[] };
const shape = validateQualificationView(view);
if (shape.length) throw new Error(`${path.relative('.', viewFile)} is not a qualification view: ${shape.join('; ')}`);

const { registry, populations: pins, engine } = await loadRegistry();
const stale: string[] = [];
for (const population of view.populations) {
  const pin = pins.find(p => p.id === population.population);
  if (!pin) { stale.push(`${population.population} is not a pinned population`); continue; }
  const e = population.artifact.evidence;
  if (e.revision !== pin.evidence.revision || e.corpus_digest !== pin.evidence.corpusDigest || e.release?.tag !== pin.evidence.release.tag || e.release?.manifest_digest !== pin.evidence.release.manifestDigest) stale.push(`${population.population} was built from other evidence than the pin`);
  if (population.artifact.engine.version !== engine.version) stale.push(`${population.population} ran engine ${population.artifact.engine.version}, the pin is ${engine.version}`);
}
for (const pin of pins) if (!view.populations.some((p: any) => p.population === pin.id)) stale.push(`${pin.id} is pinned but absent from the view`);
if (stale.length) throw new Error(`The view is not the one this checkout pins: ${stale.join('; ')}`);

const artifact = buildMatrixArtifact(view, mode);
const problems = matrixArtifactProblems(artifact, registry);
if (problems.length) throw new Error(`Refusing to write a ${mode} matrix: ${problems.join('; ')}`);

await mkdir(path.dirname(out), { recursive: true });
const temporary = `${out}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(artifact, null, 2) + '\n');
await rename(temporary, out);
console.log(`Support matrix (${mode}) from the view: ${artifact.familyCount} families, ${JSON.stringify(artifact.distribution)}; wrote ${path.relative('.', out)}`);
