import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiPopulationContract, type PiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import type { PiiAccountingRow } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import type { PiiTrustedProductBinding } from '../benchmarks/evaluation/domains/pii/product-binding.ts';

/**
 * Inputs one PII support publication may bind. Both describe one product: the
 * product commit this publication measured. Committed product evidence
 * (`evidence/<n>/`) is bound only when its source commit and core tarball are
 * that product; a population bundle only when its candidate is that product.
 * Anything else stays not-measured rather than describing another build.
 */
export interface PiiMeasuredProduct { sourceCommit: string; coreSha256: string }

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
