import { sha256Digest, canonical } from './canonical.ts';
import { seedCaseId } from './adapter.ts';
import type { RunArtifact, CaseResult, ScannerRun } from './run-artifact.ts';

/**
 * The triage queue of an adopted evidence snapshot (#698): every occurrence that needs a disposition, keyed by case semantic id, method and operator,
 * occurrence id and the scanner, configuration and product identity that produced it, deduplicated by root cause with every affected occurrence kept.
 *
 * This is an export, not a decision. It classifies nothing, settles no review-ledger entry, restores no status and asserts no product defect:
 * `classification`, `disposition` and `ledger` of every root cause are `null` until a reviewer decides them, and the attribution to the published
 * beta.13 waits for its pinned replay (#697). The scanned product of these artifacts is `@redact-secret/core` beta.12.
 */
export const TRIAGE_QUEUE_SCHEMA = 'redact-secret/triage-queue/v1';
export const CLASSIFICATIONS = ['in-contract-product-bug', 'unsupported-or-feature-scope', 'expectation-or-contract-correction', 'representation-or-scoring-limitation', 'justified-peer-divergence'] as const;

/** Handoffs #698 names; a pointer to where the family's failures are tracked, not a classification. */
export const CORE_HANDOFFS: Record<string, string> = { 'sendgrid-token': 'redact-secret/redact-secret#1199', 'generic-token': 'redact-secret/redact-secret#1200', 'connection-string': 'redact-secret/redact-secret#1201' };

export type RootCauseKind = 'core-positive-miss' | 'core-positive-partial-or-overbroad' | 'core-control-flagged' | 'gate-peer-differential-unsettled' | 'reference-assertion-failure';

interface SnapshotCaseLike { id: string; grouping?: Record<string, unknown>; representation?: Record<string, unknown>; twin?: unknown; expected?: unknown[] }
interface Operator { operator?: string; operator_version?: number; parameters?: unknown; strategy?: string; content_digest?: string }
interface UnsettledGate { id: string; peer: string; case: string; variant: string; disagreement: string; origin: string; families: string[] }

export interface TriageInput {
  source: { evidenceRelease: string; corpusDigest: string; manifestDigest: string; ciRun?: string; archiveRelease?: string; archiveSha256?: string };
  plain: { artifact: RunArtifact; semanticDigest: string };
  methods: { artifact: RunArtifact; semanticDigest: string };
  snapshotCases: SnapshotCaseLike[];
  addedIds: string[];
  /** Eval case ids of fixtures the release records as maintainer-only (credential-evidence ADR 0020), as far as the release attributes them. */
  maintainerOnlyIds: string[];
  /** Gate-peer differential occurrences with no ledger decision, own or mapped (the adoption comparison's `methods.unsettledGateOccurrences.items`). */
  unsettledGate: UnsettledGate[];
  reference: string;
  gatePeers: string[];
  disclosure: { maintainerOnlyFixtures: number; independentlyReviewed: number; newlyScoredPositives: number; newlyScoredControls: number };
}

const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const derivedId = (parts: unknown) => sha256Digest(canonical(parts));
const identityOf = (artifact: RunArtifact, scanner: string) => {
  const s = artifact.manifest.scanners.find(x => x.id === scanner) as unknown as Record<string, unknown> | undefined;
  return { scanner, version: s?.version ?? null, adapter: (s?.adapter as { id?: string; version?: string } | undefined) ?? null, configurationHash: s?.configuration_hash ?? null, build: s?.build ?? null };
};
const outcomeClass = (c: CaseResult): RootCauseKind | null => {
  const m = c.measurement as unknown as { type: string; span_outcomes?: string[]; flagged?: boolean };
  if (m.type === 'control') return m.flagged ? 'core-control-flagged' : null;
  if (m.type !== 'positive') return null;
  const outcomes = m.span_outcomes ?? [];
  if (outcomes.every(o => o === 'EXACT')) return null;
  return outcomes.every(o => o === 'MISS') ? 'core-positive-miss' : 'core-positive-partial-or-overbroad';
};
const observed = (c: CaseResult | undefined) => (c ? { expected: c.expected, actual: c.actual, measurement: c.measurement } : null);

export function buildTriageQueue(input: TriageInput) {
  const { plain, methods, reference } = input;
  const added = new Set(input.addedIds), maintainerOnly = new Set(input.maintainerOnlyIds);
  const snapshotCase = new Map(input.snapshotCases.map(c => [c.id, c]));
  const config = { plain: plain.artifact.manifest.config_hash, methods: methods.artifact.manifest.config_hash };
  const engine = { ...plain.artifact.manifest.engine, protocol: plain.artifact.manifest.protocol_version };
  const rootCauses = new Map<string, Record<string, unknown> & { occurrences: Record<string, unknown>[] }>();
  const add = (key: string, head: Record<string, unknown>, occurrence: Record<string, unknown>) => {
    const entry = rootCauses.get(key) ?? { id: derivedId({ key }), key, ...head, classification: null, disposition: null, ledger: null, occurrences: [] };
    entry.occurrences.push(occurrence);
    rootCauses.set(key, entry);
  };
  const caseHead = (seed: string, plainCase: CaseResult | undefined) => {
    const sc = snapshotCase.get(seed);
    return {
      seedCase: seed, family: plainCase?.family ?? null, group: plainCase?.group ?? (sc?.grouping?.group ?? null), tier: plainCase?.tier ?? null, evidenceClass: plainCase?.evidence_class ?? null,
      addedInThisSnapshot: added.has(seed), restsOnMaintainerOnlyDecision: maintainerOnly.has(seed), representation: sc?.representation ?? null,
    };
  };
  const scanners = (artifact: RunArtifact) => new Map(artifact.scanners.map(s => [s.scanner, s] as [string, ScannerRun]));
  const plainScanners = scanners(plain.artifact), methodScanners = scanners(methods.artifact);
  const plainOf = (scanner: string) => new Map((plainScanners.get(scanner)?.cases ?? []).map(c => [c.case_id, c]));
  const referencePlain = plainOf(reference);

  // 1. Core (the reference scanner) non-exact positives and flagged controls of the added cases, plain run.
  for (const c of [...referencePlain.values()].sort((a, b) => byteOrder(a.case_id, b.case_id))) {
    if (!added.has(c.case_id)) continue;
    const kind = outcomeClass(c);
    if (!kind) continue;
    add(`${kind}|${c.case_id}`, { kind, source: 'plain-run', ...caseHead(c.case_id, c) }, {
      occurrenceId: derivedId({ run: plain.semanticDigest, scanner: reference, case: c.case_id, method: 'plain' }), occurrenceIdKind: 'derived',
      method: 'plain', operator: null, variant: null, case: c.case_id, run: 'plain', scanner: identityOf(plain.artifact, reference), configHash: config.plain,
      observed: observed(c),
    });
  }

  // 2. Gate-peer differential occurrences with no ledger decision, from the methods run (engine-issued occurrence ids).
  const queue = new Map((methods.artifact.review_queue as unknown as { id: string; case_id: string; variant: string; peer: string; disagreement: string; reference: string }[]).map(q => [q.id, q]));
  const variants = new Map(((methods.artifact as unknown as { variants: unknown }).variants as unknown as ({ case_id: string; variant: string } & Operator)[]).map(v => [`${v.case_id}\u0000${v.variant}`, v]));
  const methodCases = (scanner: string) => new Map((methodScanners.get(scanner)?.cases ?? []).map(c => [c.case_id, c]));
  const referenceMethodCases = methodCases(reference);
  const peerMethodCases = new Map(input.gatePeers.map(p => [p, methodCases(p)]));
  for (const u of [...input.unsettledGate].sort((a, b) => byteOrder(a.id, b.id))) {
    const q = queue.get(u.id);
    if (!q || q.peer !== u.peer || seedCaseId(q.case_id, 'differential') !== u.case) throw new Error(`The unsettled gate occurrence ${u.id} is not in the methods artifact's review queue as recorded (peer ${u.peer}, case ${u.case})`);
    const evalCase = `${u.case}--differential`, variantKey = `${evalCase}--${q.variant}`;
    const op = variants.get(`${evalCase}\u0000${q.variant}`);
    add(`${'gate-peer-differential-unsettled'}|${u.case}|${u.peer}|${u.disagreement}`, { kind: 'gate-peer-differential-unsettled', source: 'methods-run', ...caseHead(u.case, referencePlain.get(u.case)), peer: u.peer, disagreement: u.disagreement, productFamilies: u.families, coreHandoff: u.families.map(f => CORE_HANDOFFS[f]).find(Boolean) ?? null }, {
      occurrenceId: u.id, occurrenceIdKind: 'engine', method: 'differential', operator: op?.operator ?? null, operatorVersion: op?.operator_version ?? null, parameters: op?.parameters ?? null, strategy: op?.strategy ?? null, contentDigest: op?.content_digest ?? null,
      variant: q.variant, case: u.case, origin: u.origin, run: 'methods', scanner: identityOf(methods.artifact, u.peer), reference: identityOf(methods.artifact, reference), configHash: config.methods,
      observed: { reference: observed(referenceMethodCases.get(variantKey)), peer: observed(peerMethodCases.get(u.peer)?.get(variantKey)) },
    });
  }

  // 3. Failed metamorphic and mutation assertions of the reference scanner on the added cases.
  const referenceMethods = methodScanners.get(reference);
  for (const a of (referenceMethods?.assertions ?? []).filter(x => x.status === 'fail')) {
    const seed = seedCaseId(a.case_id, a.method);
    if (!added.has(seed)) continue;
    const candidate = String((a as { candidate?: string }).candidate ?? ''), baseline = String((a as { baseline?: string }).baseline ?? '');
    const op = variants.get(`${a.case_id}\u0000${candidate}`);
    const baselineCase = referenceMethodCases.get(`${a.case_id}--${baseline}`), candidateCase = referenceMethodCases.get(`${a.case_id}--${candidate}`);
    add(`reference-assertion-failure|${seed}|${a.method}|${a.assertion}`, { kind: 'reference-assertion-failure', source: 'methods-run', ...caseHead(seed, referencePlain.get(seed)), method: a.method, assertion: a.assertion, coreHandoff: CORE_HANDOFFS[String(referencePlain.get(seed)?.family ?? '')] ?? null }, {
      occurrenceId: derivedId({ run: methods.semanticDigest, scanner: reference, case: a.case_id, method: a.method, baseline, candidate, assertion: a.assertion }), occurrenceIdKind: 'derived',
      method: a.method, operator: op?.operator ?? null, operatorVersion: op?.operator_version ?? null, parameters: op?.parameters ?? null, strategy: op?.strategy ?? null, contentDigest: op?.content_digest ?? null,
      baseline, variant: candidate, case: seed, run: 'methods', scanner: identityOf(methods.artifact, reference), configHash: config.methods,
      observed: { baseline: observed(baselineCase), candidate: observed(candidateCase) },
    });
  }

  const roots = [...rootCauses.values()].sort((a, b) => byteOrder(String(a.key), String(b.key)));
  for (const r of roots) r.occurrences.sort((a, b) => byteOrder(String(a.occurrenceId), String(b.occurrenceId)));
  const count = (f: (r: (typeof roots)[number]) => string, weight: (r: (typeof roots)[number]) => number = () => 1) => { const out: Record<string, number> = {}; for (const r of roots) out[f(r)] = (out[f(r)] ?? 0) + weight(r); return Object.fromEntries(Object.keys(out).sort(byteOrder).map(k => [k, out[k]])); };
  const kinds = [...new Set(roots.map(r => r.kind as string))];
  return {
    schema: TRIAGE_QUEUE_SCHEMA,
    note: 'An export for triage, not a decision: no root cause is classified, no review-ledger entry is settled, no status is restored and no product defect is asserted. Classification, disposition and ledger stay null until a reviewer decides them with evidence; the product attribution waits for the pinned beta.13 replay of the same snapshot (#697). Deduplicated by root cause (seed case, kind and, for peers and assertions, the peer or method); every affected occurrence is kept.',
    source: input.source,
    identity: { engine, product: identityOf(plain.artifact, reference), peers: Object.fromEntries(input.gatePeers.map(p => [p, identityOf(methods.artifact, p)])), configHash: config, runs: { plain: plain.semanticDigest, methods: methods.semanticDigest } },
    classifications: CLASSIFICATIONS,
    disclosure: {
      ...input.disclosure,
      note: 'Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): the fixtures behind some queue items were finalized by the sole maintainer and none is independently reviewed. `restsOnMaintainerOnlyDecision` is true only for a seed case the release attributes to a maintainer-only record; false is not a claim of review.',
    },
    summary: {
      rootCauses: roots.length, occurrences: roots.reduce((n, r) => n + r.occurrences.length, 0),
      rootCausesByKind: count(r => String(r.kind)), occurrencesByKind: count(r => String(r.kind), r => r.occurrences.length),
      occurrencesByProductFamily: count(r => String(r.family ?? '(no family)'), r => r.occurrences.length),
      gateOccurrencesByProductFamily: (() => { const out: Record<string, number> = {}; for (const r of roots) if (r.kind === 'gate-peer-differential-unsettled') for (const o of r.occurrences) for (const f of ((r.productFamilies as string[]).length ? (r.productFamilies as string[]) : ['(no product family)'])) { void o; out[f] = (out[f] ?? 0) + 1; } return Object.fromEntries(Object.keys(out).sort(byteOrder).map(k => [k, out[k]])); })(),
      restingOnMaintainerOnly: { rootCauses: roots.filter(r => r.restsOnMaintainerOnlyDecision).length, occurrences: roots.filter(r => r.restsOnMaintainerOnlyDecision).reduce((n, r) => n + r.occurrences.length, 0), byKind: Object.fromEntries(kinds.sort(byteOrder).map(k => [k, roots.filter(r => r.kind === k && r.restsOnMaintainerOnlyDecision).length])) },
      occurrencesOfCommonCases: roots.reduce((n, r) => n + r.occurrences.filter(o => o.origin === 'common').length, 0),
    },
    rootCauses: roots,
  };
}
