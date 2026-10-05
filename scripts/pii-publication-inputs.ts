import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiPopulationContract, type PiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import type { PiiAccountingRow } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import type { PiiTrustedProductBinding } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import type { PiiEvalMeasurement } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import type { CustodianConformance } from '../benchmarks/evaluation/domains/pii/support-v2.ts';

/**
 * Inputs one PII support publication may bind. Both describe one product: the
 * product commit this publication measured. Committed product evidence
 * (`evidence/<n>/`) is bound only when its source commit and core tarball are
 * that product; a population bundle only when its candidate is that product.
 * Anything else stays not-measured rather than describing another build.
 */
export interface PiiMeasuredProduct { sourceCommit: string; coreSha256: string }

/**
 * Validate public pii-eval artifacts independently and project only their scanner-neutral evidence. Several pin sets may be
 * bound (the transport-verified CI measurement and the committed benchmark populations); each artifact is judged only by the
 * pin set that names its population, every pin set must be satisfied, and all of them must name one engine build. A candidate
 * is never described as the release, and it is described as measuring this publication's product only when its pin names
 * exactly that source commit.
 */
export async function piiEvalMeasurementFrom(pinsFile: string | string[], artifactFiles: string[], product: PiiMeasuredProduct | null = null): Promise<PiiEvalMeasurement> {
  if (!artifactFiles.length) throw new Error('At least one pii-eval artifact is required');
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
  const populations = reports.flatMap(({ report, pins }: any) => report.populations.map((row: any) => {
    const pin = pins.populations.find((item: any) => item.label === row.label);
    const scanner = pin.scanners[0], sourceCommit: string | null = scanner.candidateSourceCommit ?? null;
    const state = !product ? 'publication-product-not-measured' : sourceCommit !== null && sourceCommit === product.sourceCommit ? 'measures-publication-product' : 'other-product';
    return { ...row, productBinding: { state, candidateSourceCommit: sourceCommit } };
  }));
  if (new Set(populations.map((row: any) => row.populationId)).size !== populations.length) throw new Error('pii-eval pin sets name one population twice');
  return { ...first.report, populations } as PiiEvalMeasurement;
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

const EVIDENCE_FILES = { candidateEvidence: 'candidate-evidence-v1.json', activationArtifact: 'pii-activation-evidence-v1.json',
  qualificationArtifact: 'pii-family-qualification-v1.json' } as const;

/** The committed product evidence recorded for exactly this product, or null. Two records for one product fail closed. */
export async function productEvidenceFor(product: PiiMeasuredProduct, evidenceRoot: string): Promise<{ directory: string; binding: PiiTrustedProductBinding } | null> {
  if (!/^[0-9a-f]{40}$/.test(product.sourceCommit) || !/^[0-9a-f]{64}$/.test(product.coreSha256)) throw new Error('Invalid measured product identity');
  const matches: string[] = [];
  for (const entry of await readdir(evidenceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(evidenceRoot, entry.name, EVIDENCE_FILES.activationArtifact);
    let activation: any;
    try { activation = JSON.parse(await readFile(file, 'utf8')); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
    if (activation?.product?.sourceCommit === product.sourceCommit) matches.push(path.join(evidenceRoot, entry.name));
  }
  if (matches.length > 1) throw new Error(`More than one committed PII product record for ${product.sourceCommit}: ${matches.map(dir => path.basename(dir)).join(', ')}`);
  if (!matches.length) return null;
  const [directory] = matches;
  const [candidateEvidence, activationArtifact, qualificationArtifact] = await Promise.all(Object.values(EVIDENCE_FILES)
    .map(name => readFile(path.join(directory, name), 'utf8').then(JSON.parse)));
  if (activationArtifact.product.artifactCommitment !== product.coreSha256)
    throw new Error(`Committed PII product record ${path.basename(directory)} names another core artifact than the measured product`);
  return { directory, binding: { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] } };
}

type BundleRow = { population: 'diagnostic-balanced' | 'benign-heavy-stress'; baselineReport: PiiPopulationReport;
  candidateReport: PiiPopulationReport; baselineRows: PiiAccountingRow[]; candidateRows: PiiAccountingRow[] };

/** Population bindings from a release bundle; with a measured product, the bundle's candidate must be that product. */
export function populationBindingsFrom(bundle: any, product: PiiMeasuredProduct | null) {
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
