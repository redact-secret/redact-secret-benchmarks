/**
 * Build the qualification view the Next app reads (#605, consumed by #606) from official credential-eval run artifacts.
 *
 *   npm run qualification:view -- --artifacts <dir> [--out public/results/qualification-v1.json] [--holdout-receipt <aggregate.json>] [--inputs <derived dir>]
 *
 * <dir> holds one directory per population (the output directories of scripts/run-official-credential-eval.ts):
 * <dir>/<population>/artifact.json, and for a product population <dir>/<population>/inputs/case-metadata.json. The floors
 * population also carries its methods run, <dir>/<population>/methods/artifact.json, when one was made (docs/specs/official-runs.md).
 * `--inputs <dir>` (#699) builds a CANDIDATE view: the axis overlay, twin-scope map and review-ledger re-key come from a directory written by
 * `npm run qualification:derive-inputs` for that snapshot, never from the committed copies of the accepted population. Without it the committed
 * inputs are read and a stale one is refused by the adapter. Either way the adapter refuses an input bound to another corpus than the artifacts.
 * The output is validated against schemas/qualification-view-v1.json before it is written, and is byte-identical for the
 * same artifacts and product inputs. It reads no legacy evaluator output. Spec: docs/specs/qualification-adapter.md.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildQualificationView, serializeView, type ArtifactInput } from '../benchmarks/qualification/adapter.ts';
import { loadProductInputs, loadRegistry } from '../benchmarks/qualification/inputs.ts';
import { readScannerRoster, type MeasurementHistory } from '../benchmarks/qualification/scanner-roster.ts';
import { validateQualificationView } from '../benchmarks/qualification/view-schema.ts';
import { declaredProfiles } from '../benchmarks/lib/peer-rule-families.ts';
import { validatePolicyHoldoutReceipt } from '../benchmarks/support/policy-holdout-receipt.ts';

const usage = 'Usage: qualification:view --artifacts <dir> [--out <file>] [--holdout-receipt <aggregate.json>] [--inputs <derived dir>]';
const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const dir = option('artifacts');
if (!dir || args.length % 2 !== 0 || args.some((a, i) => i % 2 === 0 && !/^--(artifacts|out|holdout-receipt|inputs)$/.test(a))) throw new Error(usage);
const out = path.resolve(option('out') ?? 'public/results/qualification-v1.json');

const { populations, engine } = await loadRegistry();
const inputsDir = option('inputs');
const product = await loadProductInputs({ derivedInputsDir: inputsDir && path.resolve(inputsDir) });
const receiptFile = option('holdout-receipt');
if (receiptFile) product.holdoutReceipt = validatePolicyHoldoutReceipt(JSON.parse(await readFile(path.resolve(receiptFile), 'utf8')));

const artifacts: ArtifactInput[] = [];
for (const id of Object.keys(product.policy.populations)) {
  const folder = path.resolve(dir, id);
  const metadataFile = path.join(folder, 'inputs/case-metadata.json');
  artifacts.push({
    population: id,
    bytes: await readFile(path.join(folder, 'artifact.json')),
    caseMetadata: await readFile(metadataFile, 'utf8').then(JSON.parse, () => undefined),
    methodsBytes: await readFile(path.join(folder, 'methods/artifact.json')).catch(() => undefined),
  });
}

const profiles = declaredProfiles(JSON.parse(await readFile(new URL('../scanners/peer-registry.json', import.meta.url), 'utf8')));
// The evaluation contract (#763): the roster says which scanners are required and which optional; the registry's recorded runs are read only to point at the last measurement of an optional scanner this view does not carry.
const history = JSON.parse(await readFile(new URL('../benchmarks/official-runs.json', import.meta.url), 'utf8')) as MeasurementHistory;
const view = buildQualificationView({ registry: populations, engine, artifacts, product, profiles, roster: readScannerRoster(), history });
const problems = validateQualificationView(view);
if (problems.length) throw new Error(`The qualification view does not match schemas/qualification-view-v1.json: ${problems.join('; ')}`);
await mkdir(path.dirname(out), { recursive: true });
const temporary = `${out}.tmp`;
await writeFile(temporary, serializeView(view), { mode: 0o644 });
await rename(temporary, out);
console.log(`Qualification view (${view.publication}): ${view.families.length} families, ${JSON.stringify(view.distribution)}, policy ${view.policy.revision}`);
for (const n of view.scannerRoster?.notMeasured ?? []) console.log(`${n.statement}; last measurement: ${n.lastMeasurement ? `${n.lastMeasurement.runs.map(r => r.id).join(', ')} on engine ${n.lastMeasurement.engine.version}, ${n.lastMeasurement.recordedOn}` : 'none recorded'}`);
console.log(`Populations: ${view.populations.map(p => `${p.population} ${p.runClass} ${p.artifact.semanticDigest.slice(0, 19)}`).join('; ')}`);
if (inputsDir) console.log(`Candidate view: overlay, twin-scope map and review-ledger re-key derived from ${path.resolve(inputsDir)} (receipt snapshot ${(await readFile(path.join(path.resolve(inputsDir), 'derived-inputs.json'), 'utf8').then(JSON.parse)).snapshot.corpusDigest}); the committed inputs were not read`);
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
