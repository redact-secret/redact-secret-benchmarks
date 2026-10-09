import Ajv from 'ajv';
import registrySchema from '../schemas/pii-current-product-bindings-v1.json';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-contract.ts';
import { piiPopulationContract, type PiiPopulationReport } from '../benchmarks/evaluation/domains/pii/population-contracts.ts';
import type { PiiAccountingRow } from '../benchmarks/evaluation/domains/pii/accounting-types.ts';
import { validatePiiProductBinding, type PiiTrustedProductBinding } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import currentIndex from '../benchmarks/inputs/pii/current-inputs-index.json';
import supportRegistry from '../benchmarks/evaluation/domains/pii/support-registry-v1.json';
import { piiInputCommitment } from '../benchmarks/evaluation/domains/pii/current-inputs.ts';
import type { PiiEvalMeasurement } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import type { CustodianConformance } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

/**
 * Inputs one PII support publication may bind. Both describe one product: the
 * product commit this publication measured. Committed product evidence
 * in the explicit current registry is bound only when its source commit and core tarball are
 * that product; a population bundle only when its candidate is that product.
 * Anything else stays not-measured rather than describing another build.
 */
export interface PiiMeasuredProduct { sourceCommit: string; coreSha256: string }
export type PiiPublicationProductBinding = { state: 'matched'; sourceCommit: string; coreSha256: string;
  packageTreeSha256: string; engineCommit: string; protocol: { id: string; revision: number };
  populationDigests: Record<string, string> } | { state: 'absent' | 'invalid' | 'other-product'; reason: string };
export interface PiiPublicationInputOptions {
  /** Bundled callers supply their repository root; CLI callers use this source module location. */
  repoRoot?: string;
  /** Tests may supply a reviewed receipt resolver; every returned identity is still checked below. */
  productBindingLoader?: (root: string, product: PiiMeasuredProduct) => Promise<PiiPublicationProductBinding> | PiiPublicationProductBinding;
}

/**
 * Validate public pii-eval artifacts independently and project only their scanner-neutral evidence. Several pin sets may be
 * bound (the transport-verified CI measurement and the committed benchmark populations); each artifact is judged only by the
 * pin set that names its population, every pin set must be satisfied, and all of them must name one engine build. A candidate
 * is never described as the release, and it is described as measuring this publication's product only when its pin names
 * that source commit, its core tarball and engine package tree through a validated paired-comparison receipt.
 */
export async function piiEvalMeasurementFrom(pinsFile: string | string[], artifactFiles: string[], product: PiiMeasuredProduct | null = null, options: PiiPublicationInputOptions = {}): Promise<PiiEvalMeasurement> {
  if (!artifactFiles.length) throw new Error('At least one pii-eval artifact is required');
  if (product && (!/^[a-f0-9]{40}$/.test(product.sourceCommit) || !/^[a-f0-9]{64}$/.test(product.coreSha256)))
    throw new Error('Invalid measured product');
  const { loadPins, consume, parseStrictJson } = await import('../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs');
  const pinSets = await Promise.all([pinsFile].flat().map(async file => loadPins(await readFile(file, 'utf8'))));
  const artifacts = await Promise.all(artifactFiles.map(async file => ({ name: path.basename(file), text: await readFile(file, 'utf8') })));
  const populationOf = (text: string): string | undefined => { try { return parseStrictJson(text)?.semantic?.population?.populationId; } catch { return undefined; } };
  const reports = pinSets.map((pins: any) => {
    const own = new Set(pins.populations.map((row: any) => row.population.populationId));
    const report = consume(pins, artifacts.filter(artifact => own.has(populationOf(artifact.text))));
    if (!report.complete) throw new Error(`pii-eval artifact validation failed: ${report.rejections.flatMap((row: any) => row.reasons.map((reason: any) => reason.code)).join(',') || 'pinned population missing'}`);
    return { report, pins };
  });
  const claimed = new Set(pinSets.flatMap((pins: any) => pins.populations.map((row: any) => row.population.populationId)));
  const stray = artifacts.filter(artifact => !claimed.has(populationOf(artifact.text)));
  if (stray.length) throw new Error(`pii-eval artifact validation failed: population-not-pinned (${stray.map(row => row.name).join(', ')})`);
  const [first] = reports;
  for (const { report } of reports) {
    if (JSON.stringify(report.build) !== JSON.stringify(first.report.build)) throw new Error('pii-eval pin sets name different engine builds');
  }
  const proof = product ? await (options.productBindingLoader ?? (async (root, measured) => {
    const { loadPiiPublicationProductBinding } = await import('../benchmarks/support/pii-publication-product.mjs');
    return loadPiiPublicationProductBinding(root, measured);
  }))(options.repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), product) : null;
  const populations = reports.flatMap(({ report, pins }: any) => report.populations.map((row: any) => {
    const pin = pins.populations.find((item: any) => item.label === row.label);
    const scanner = pin.scanners[0], sourceCommit: string | null = scanner.candidateSourceCommit ?? null;
    const exactProduct = product && proof?.state === 'matched' && pin.scanners.length === 1 &&
      sourceCommit === product.sourceCommit && proof.sourceCommit === product.sourceCommit && proof.coreSha256 === product.coreSha256 &&
      proof.engineCommit === report.build.commit && proof.protocol?.id === pins.protocol.id && proof.protocol?.revision === pins.protocol.version && proof.protocol?.id === 'pii-v1' && proof.protocol?.revision === 2 &&
      /^[a-f0-9]{64}$/.test(proof.packageTreeSha256) && scanner.artifactDigest === proof.packageTreeSha256 &&
      scanner.product?.kind === 'candidate' && scanner.product.candidateDigest === proof.packageTreeSha256 &&
      proof.populationDigests?.[row.populationId] === row.population.populationDigest;
    const state = !product ? 'publication-product-not-measured' : sourceCommit !== product.sourceCommit || proof?.state === 'other-product' ? 'other-product' :
      exactProduct ? 'measures-publication-product' : 'publication-artifact-not-bound';
    return { ...row, productBinding: { state, candidateSourceCommit: sourceCommit, ...(exactProduct && proof?.state === 'matched' ?
      { proof: { coreSha256: proof.coreSha256, packageTreeSha256: proof.packageTreeSha256, engineCommit: proof.engineCommit,
        protocol: proof.protocol, populationDigest: proof.populationDigests[row.populationId] } } : {}) } };
  }));
  if (new Set(populations.map((row: any) => row.populationId)).size !== populations.length) throw new Error('pii-eval pin sets name one population twice');
  return { ...first.report, populations, ...(product ? { publicationProduct: { ...product } } : {}) } as PiiEvalMeasurement;
}

/** Verify a public synthetic custodian bridge bundle. It is conformance evidence, never a live support input. */
export async function custodianConformanceFrom(bundleFile: string): Promise<CustodianConformance> {
  const bytes = await readFile(bundleFile), bundle = JSON.parse(bytes.toString('utf8'));
  if (bundle?.schema !== 'redact-secret-benchmarks.synthetic-custodian-bundle/1') throw new Error('Invalid synthetic custodian bundle');
  const { canonicalize, conformanceReport } = await import('../benchmarks/evaluation/domains/pii/custodian-consumer.mjs');
  const part = bundle.initial;
  const report = conformanceReport(bundle.pins, canonicalize(part.request), {
    manifest: canonicalize(part.manifest), projections: part.projections.map(canonicalize), revocations: part.revocations.map(canonicalize),
  }, part.now);
  return { ...report, bundleSha256: createHash('sha256').update(bytes).digest('hex') } as CustodianConformance;
}

const registryShape = new Ajv({ allErrors: true, strict: false }).compile<PiiCurrentProductRegistry>(registrySchema);

export interface PiiCurrentProductRegistry {
  schema: 'redact-secret/pii-current-product-bindings/v1'; supportClaims: false;
  source: { commit: string; path: string; sha256: string };
  products: Array<PiiMeasuredProduct & { role: 'baseline' | 'candidate' }>;
  bindings: Array<{ sourceCommit: string; coreSha256: string; bindingCommitment: string; binding: PiiTrustedProductBinding }>;
  projectionCommitment: string;
}

/** Explicit bindings are reviewed independently of the receipt's self-hash. Absence means not measured. */
export function validateCurrentPiiProductRegistry(value: any): PiiCurrentProductRegistry {
  const expected = currentIndex.inputs.filter(row => row.role === 'product-bindings');
  if (!registryShape(value) || !value || value.schema !== 'redact-secret/pii-current-product-bindings/v1' || value.supportClaims !== false ||
      Object.keys(value).sort().join(',') !== 'bindings,products,projectionCommitment,schema,source,supportClaims' ||
      !Array.isArray(value.products) || !Array.isArray(value.bindings) || expected.length !== 1 ||
      expected[0].path !== 'benchmarks/inputs/pii/product-bindings.json') throw new Error('Invalid, ambiguous or missing current PII product registry');
  const { projectionCommitment, ...projection } = value;
  if (projectionCommitment !== expected[0].projectionCommitment || piiInputCommitment(projection) !== projectionCommitment ||
      piiInputCommitment(value.source) !== piiInputCommitment(expected[0].source)) throw new Error('Current PII product registry source or projection mismatch');
  const identities = new Set<string>(), roles = new Set<string>();
  for (const product of value.products) {
    if (!product || Object.keys(product).sort().join(',') !== 'coreSha256,role,sourceCommit' ||
        !['baseline', 'candidate'].includes(product.role) || !/^[a-f0-9]{40}$/.test(product.sourceCommit) || !/^[a-f0-9]{64}$/.test(product.coreSha256) ||
        identities.has(product.sourceCommit) || roles.has(product.role)) throw new Error('Ambiguous or invalid current PII product identity');
    identities.add(product.sourceCommit); roles.add(product.role);
  }
  const bindings = new Set<string>();
  for (const row of value.bindings) {
    if (!row || Object.keys(row).sort().join(',') !== 'binding,bindingCommitment,coreSha256,sourceCommit' || bindings.has(row.sourceCommit) ||
        !value.products.some((product: PiiMeasuredProduct) => product.sourceCommit === row.sourceCommit && product.coreSha256 === row.coreSha256) ||
        piiInputCommitment(row.binding) !== row.bindingCommitment) throw new Error('Ambiguous or mismatched current PII activation binding');
    validatePiiProductBinding(row.binding, supportRegistry.families.map(row => row.family));
    if (row.binding.activationArtifact.product.sourceCommit !== row.sourceCommit || row.binding.activationArtifact.product.artifactCommitment !== row.coreSha256)
      throw new Error('Current PII activation binding names another product');
    bindings.add(row.sourceCommit);
  }
  return structuredClone(value);
}

/** No evidence-directory discovery: only the separately bound current registry can describe this product. */
export async function productEvidenceFor(product: PiiMeasuredProduct, registryFile = fileURLToPath(new URL('../benchmarks/inputs/pii/product-bindings.json', import.meta.url))): Promise<{ directory: string; binding: PiiTrustedProductBinding } | null> {
  if (!/^[0-9a-f]{40}$/.test(product.sourceCommit) || !/^[0-9a-f]{64}$/.test(product.coreSha256)) throw new Error('Invalid measured product identity');
  const registry = validateCurrentPiiProductRegistry(JSON.parse(await readFile(registryFile, 'utf8')));
  const selected = registry.products.find(row => row.sourceCommit === product.sourceCommit);
  if (selected && selected.coreSha256 !== product.coreSha256) throw new Error('Current PII product registry names another core artifact than the measured product');
  const record = registry.bindings.find(row => row.sourceCommit === product.sourceCommit);
  return record ? { directory: registryFile, binding: record.binding } : null;
}

type BundleRow = { population: 'diagnostic-balanced' | 'benign-heavy-stress'; baselineReport: PiiPopulationReport;
  candidateReport: PiiPopulationReport; baselineRows: PiiAccountingRow[]; candidateRows: PiiAccountingRow[] };

/** Bounded oracle bindings from a historical release bundle; with a measured product, the bundle's candidate must be that product. */
export function populationOracleBindingsFrom(bundle: any, product: PiiMeasuredProduct | null) {
  if (bundle?.schemaVersion !== 1 || !Array.isArray(bundle.comparisons) || bundle.comparisons.length !== 2 ||
      new Set(bundle.comparisons.map((row: any) => row?.population)).size !== 2 || bundle.comparisons.some((row: any) =>
        !['diagnostic-balanced', 'benign-heavy-stress'].includes(row?.population) || !Array.isArray(row?.baselineRows) || !Array.isArray(row?.candidateRows) ||
        row?.baselineReport?.population !== row.population || row?.candidateReport?.population !== row.population))
    throw new Error('Invalid PII population release bundle');
  if (product && (bundle.candidate?.sourceCommit !== product.sourceCommit || bundle.candidate?.components?.core !== product.coreSha256))
    throw new Error('PII population bundle observed another product than the one this publication measured');
  const rows = bundle.comparisons as BundleRow[];
  return {
    populations: rows.map(row => ({ report: row.candidateReport, rows: row.candidateRows, contract: piiPopulationContract, evidence: piiBenignCollisionEvidence })),
    comparisons: rows.map(row => ({ baseline: row.baselineReport, candidate: row.candidateReport, baselineRows: row.baselineRows,
      candidateRows: row.candidateRows, contract: piiPopulationContract, evidence: piiBenignCollisionEvidence })),
  };
}

/** Raw legacy observations cannot be publication inputs in the current lane. */
export function populationBindingsFrom(_bundle: unknown, _product: PiiMeasuredProduct | null): never {
  throw new Error('Legacy PII population release bundles require the explicit bounded population oracle; use validated pii-eval artifacts for current publication');
}
