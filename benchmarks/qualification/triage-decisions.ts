import { CLASSIFICATIONS } from './triage-queue.ts';
import { CORE_1203, CORE_1203_LINKS, type Core1203Entry } from './triage-core-1203.ts';
import { CORE_1205, CORE_1205_LINKS } from './triage-core-1205.ts';

/**
 * Triage decisions for the queue of an adopted snapshot (#698): a classification and a disposition per root cause, each with the evidence it rests on.
 * Rules, not hand edits: a root cause is decided by the first rule that matches, a root cause no rule matches stays open (never defaulted), and
 * a decision only ever cites what is recorded (a core issue, a core ADR, a verified replay, the evidence's own expected spans).
 *
 * Boundary: this repository measures and records. A classification here is the reading of recorded evidence; the product's own scope statement
 * is the product's (redact-secret-benchmarks#622 records it). Nothing here restores a status.
 */
export type Classification = (typeof CLASSIFICATIONS)[number];
export type Status = 'settled' | 'fixed-in-candidate' | 'open';

interface RootCause {
  id: string; key: string; kind: string; seedCase: string; family: string | null; tier: string | null; evidenceClass: string | null;
  restsOnMaintainerOnlyDecision: boolean; peer?: string; disagreement?: string; method?: string; assertion?: string; addedInThisSnapshot: boolean;
  occurrences: Array<{ observed?: { reference?: Measured; peer?: Measured } }>;
}
interface Measured { expected?: unknown[]; actual?: unknown[]; measurement?: { type?: string; span_outcomes?: string[]; flagged?: boolean } }

export interface Decision { classification: Classification | null; disposition: string; status: Status; rule: string; evidence: string[]; links: string[]; /** A proposed credential-evidence change, kept apart from the disposition and never applied here. */ evidenceProposal?: string; ledger: { proposal: 'resolved' | 'not-assertable' | 'open'; basis: string } | null }

const CORE = 'https://github.com/redact-secret/redact-secret';
const L = { pr1202: `${CORE}/pull/1202`, i1199: `${CORE}/issues/1199`, i1200: `${CORE}/issues/1200`, i1201: `${CORE}/issues/1201`, b622: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/622' };
const ADR_FRAGMENT = 'redact-secret docs/decisions/2026-10-04-define-fragmented-credentials-as-outside-the-raw-input-contract.md (core PR #1202)';
const ADR_DECODING = 'redact-secret ADR defer-encoded-input-decoding (#491): base64/hex/nested encoded carriers are not decoded by the product';

export interface TriageContext {
  /** Core issue that tracks the families core has not classified (the handoff for the open root causes). */
  openCoreIssue?: string;
  /** Case ids the unpublished candidate (core 0ecf3e59) replays as fixed, and the ones it still fails, from the candidate replay (null when not replayed). */
  candidate?: { commit: string; fixed: string[]; stillFailing: string[] } | null;
}

const AMQP = 'generic-connection-grammar-authored--amqp-uri-all-sub-delimiters';
const UNCLASSIFIED_PREFIXES = ['structured-credential-files-authored--', 'http-auth-carriers-authored--', 'url-credential-boundaries-authored--', 'twilio-compound-credentials-authored--'];
// Families the product declares no detector or context for (docs/support-matrix.md and docs/specs/detector-families.md at core 0ecf3e59 name no netrc, kubeconfig,
// HTTP session cookie, generic signed-URL or SAS-in-config family): a missed positive of these is a scope fact; the 13 provisional statements were confirmed by the repository owner on 2026-10-05 (#622), as the owner's decision based on the product's docs.
const NO_DECLARED_FAMILY = ['generic:netrc-password', 'kubernetes:kubeconfig-user-credentials', 'generic:http-session-cookie', 'azure-storage:shared-access-signature-token', 'google:cloud-storage-signed-url', 'aws:s3-presigned-url'];
const NO_DECLARED_SEED = /^(structured-credential-files-authored--(kubeconfig-|netrc-)|http-auth-carriers-authored--(cookie-|set-cookie-)|url-credential-boundaries-authored--(sas-token|cloud-storage-signed|s3-presigned))/;

const matches = (m?: Measured) => {
  const t = m?.measurement;
  if (t?.type === 'positive') return (t.span_outcomes ?? []).length > 0 && (t.span_outcomes ?? []).every(o => o === 'EXACT');
  if (t?.type === 'control') return t.flagged === false;
  return false;
};
const isPending = (m?: Measured) => m?.measurement?.type === 'pending' || m?.measurement?.type === 'not-measured';

/**
 * The product's reading of a base case: #1203 (core PR #1204) and #1205 (core PR #1206). A fix is claimed fixed only when the candidate replay shows the case now
 * passing; a fix the registered candidate does not carry (PR #1206 is not in 1e45cecf) stays open and says so.
 */
function core1203(seed: string, ctx: TriageContext, ledger: Decision['ledger']): Decision | null {
  const from1205 = !CORE_1203[seed] && !!CORE_1205[seed];
  const e: Core1203Entry | undefined = CORE_1203[seed] ?? CORE_1205[seed];
  if (!e) return null;
  const verified = e.kind === 'fix' && ctx.candidate?.fixed.includes(seed);
  const links = from1205 ? CORE_1205_LINKS : CORE_1203_LINKS;
  return {
    classification: e.classification, status: e.kind === 'fix' ? (verified ? 'fixed-in-candidate' : 'open') : 'settled', rule: `core-${from1205 ? '1205' : '1203'}.${e.kind}`, ledger,
    disposition: e.kind === 'fix' && !verified ? `${e.disposition}; not yet verified on a candidate replay` : e.kind === 'fix' ? `${e.disposition}; the candidate replay (core ${ctx.candidate?.commit?.slice(0, 12)}) passes this case` : e.disposition,
    evidence: [...e.evidence], links, ...(e.evidenceProposal ? { evidenceProposal: e.evidenceProposal } : {}),
  };
}

const encodedCarrier = (): Decision => ({ classification: 'unsupported-or-feature-scope', status: 'settled', rule: 'encoded-carrier', ledger: null, disposition: 'out of scope: the product defers decoding of base64, hex and nested encoded carriers; a raw encoded run under a non-credential name claims nothing. Stays a scope fact, not a product defect', evidence: [ADR_DECODING, 'core #1199 (13 SendGrid) and #1200 (34 generic-token) classification tables; published beta.13, beta.12 and pre-fix main give identical findings', 'core #1205 classification (11 SendGrid base64/hex projections): findings identical on published beta.13 and core main'], links: [L.i1199, L.i1200, L.pr1202, L.b622, ...CORE_1205_LINKS] });
const fragmentedCredential = (): Decision => ({ classification: 'unsupported-or-feature-scope', status: 'settled', rule: 'fragmented-credential', ledger: null, disposition: 'out of the raw-input contract: a credential cut by a line break, continuation, literal join, markdown or escaped text is not reconstructed (no source-language evaluation). The scorer encloses a fragmented expected span, so the product match is partial by contract', evidence: [ADR_FRAGMENT, 'core #1199 classification table (16 cases)', 'core #1205 classification: the four key-split cases redact an incidental first fragment (incidental, not a claim)'], links: [L.i1199, L.pr1202, L.b622, ...CORE_1205_LINKS] });

/** Decide one root cause. `seedKinds` maps a seed case id to the decision of its core (non-assertion, non-peer) root cause. */
export function decideRootCause(r: RootCause, ctx: TriageContext, seedDecisions: Map<string, Decision>): Decision {
  const open = (rule: string, disposition: string, links: string[] = []): Decision => ({ classification: null, disposition, status: 'open', rule, evidence: [], links, ledger: r.kind === 'gate-peer-differential-unsettled' ? { proposal: 'open', basis: disposition } : null });
  const issueLink = ctx.openCoreIssue ? [ctx.openCoreIssue] : [];

  if (r.kind === 'gate-peer-differential-unsettled') {
    const o = r.occurrences[0]?.observed ?? {};
    if (isPending(o.reference) || r.tier === 'T0') return { classification: null, disposition: 'expectation unresolved (T0 pending): not assertable, in no denominator; the decided class differential.t0-pending-fixture applies (docs/decisions/2026-09-22-settle-differential-disagreements-on-pending-fixtures.md)', status: 'settled', rule: 'gate-peer.t0-pending', evidence: ['the case is pending (T0): the release records no assertable expectation'], links: [], ledger: { proposal: 'not-assertable', basis: 'T0 pending fixture' } };
    const seed = seedDecisions.get(r.seedCase);
    if (!matches(o.reference)) {
      const product = core1203(r.seedCase, ctx, { proposal: 'open', basis: 'the reference itself deviates from the evidence on this case; the occurrence follows the product\'s #1203 reading of the base case' });
      if (product) return { ...product, rule: `gate-peer.follows-${product.rule}` };
      const byScope = r.seedCase.startsWith('base64-hex-representation-projections--') ? encodedCarrier() : r.seedCase.startsWith('line-break-and-fragment-authored--key-') ? fragmentedCredential() : null;
      if (byScope) return { ...byScope, rule: `gate-peer.follows-${byScope.rule}`, ledger: { proposal: 'open', basis: 'the reference itself deviates from the evidence on this case (a peer reads what the product by contract does not); the occurrence follows the product\'s scope reading. No decision settles the occurrence: the family stays provisional' } };
      if (seed) return { ...seed, rule: 'gate-peer.follows-core-root-cause', ledger: { proposal: 'open', basis: 'the reference itself deviates from the evidence on this case; the occurrence follows the core root cause of the seed case' }, evidence: [...seed.evidence], links: seed.links };
      return open('gate-peer.reference-deviates', 'the reference deviates from the evidence on this case and no core root cause covers it yet; stays open', issueLink);
    }
    // The reference matches the evidence's own expectation exactly (every expected span EXACT, or a control left clear): the divergence is the peer's.
    return {
      classification: 'justified-peer-divergence', status: 'settled', rule: 'gate-peer.reference-matches-evidence',
      disposition: `justified by the evidence, not by peer acceptance: the reference matches the case's expected ${o.reference?.measurement?.type === 'positive' ? 'spans exactly' : 'outcome (control left clear)'} while ${r.peer} ${r.disagreement}; no product action`,
      evidence: [`reference: ${JSON.stringify(o.reference?.measurement)}`, `${r.peer}: ${JSON.stringify(o.peer?.measurement)}`], links: [],
      ledger: { proposal: 'resolved', basis: `authored-expectation-correct: the reference matches the evidence's expected result; ${r.peer} (${r.disagreement}) differs${r.restsOnMaintainerOnlyDecision ? '; the expectation is a maintainer-only record, not independently reviewed' : ''}` },
    };
  }

  if (r.seedCase === AMQP) {
    const fixed = ctx.candidate?.fixed.includes(AMQP);
    return { classification: 'in-contract-product-bug', status: fixed ? 'fixed-in-candidate' : 'open', rule: 'amqp-userinfo-quote', ledger: null,
      disposition: fixed ? `fixed in core PR #1202 (merge ${ctx.candidate?.commit}); the unpublished candidate replays this case as fixed; unreleased, so it stays failing on published beta.13 until a release carries it` : 'in-contract bug fixed in core PR #1202 (unpublished); not yet verified on a candidate replay',
      evidence: ['core #1201 classification table: an unencoded `\'` in userinfo ended the authority (password bytes 14-31 missed on beta.13 and pre-fix main)'], links: [L.i1201, L.pr1202] };
  }
  if (r.seedCase.startsWith('base64-hex-representation-projections--')) return encodedCarrier();
  if (r.seedCase.startsWith('line-break-and-fragment-authored--key-')) return fragmentedCredential();

  const product = core1203(r.seedCase, ctx, null);
  if (product) return product;

  const core = r.kind.startsWith('core-');
  if (core && (NO_DECLARED_SEED.test(r.seedCase) || r.seedCase === 'http-auth-carriers-authored--basic-token-split-by-space') && !r.kind.endsWith('flagged')) {
    return { classification: 'unsupported-or-feature-scope', status: 'settled', rule: 'no-declared-family', ledger: null, disposition: 'scope reading confirmed by the repository owner (Milo Kang, 2026-10-05) as the owner\'s product-scope decision (#622), based on the product\'s own documentation: it documents no detector family or supported context for this carrier (checked in docs/support-matrix.md and docs/specs/detector-families.md at core 0ecf3e59), so the miss or partial match is a scope fact. It is the owner\'s decision on the product\'s docs, not a statement of the core maintainers beyond core #1203/#1204', evidence: ['no netrc, kubeconfig, HTTP session cookie, generic signed-URL or SAS-in-config family in the product docs at core 0ecf3e59', 'owner decision of 2026-10-05 (#680, #622): the 13 provisional product-scope statements are confirmed'], links: [L.b622, ...issueLink] };
  }
  if (UNCLASSIFIED_PREFIXES.some(p => r.seedCase.startsWith(p)) || (core && r.kind.endsWith('flagged')))
    return open('unclassified-by-core', 'core #1199 to #1201 do not classify this family; open with a linked core classification request', issueLink);

  if (r.kind === 'reference-assertion-failure') {
    const seed = seedDecisions.get(r.seedCase);
    if (seed) return { ...seed, rule: `assertion.follows-seed:${seed.rule}`, evidence: [...seed.evidence], ledger: null, disposition: `follows the seed case's root cause (${seed.rule}): ${seed.disposition}` };
    return open('assertion.no-seed-root-cause', 'the reference fails this assertion but its plain measurement of the seed case is exact; no core classification covers the generated variants', issueLink);
  }
  return open('no-rule', 'no rule matches this root cause; it stays open');
}

export function decideAll(rootCauses: RootCause[], ctx: TriageContext): Array<RootCause & { decision: Decision }> {
  const seedDecisions = new Map<string, Decision>();
  const order = (r: RootCause) => (r.kind.startsWith('core-') ? 0 : 1);
  const sorted = [...rootCauses].sort((a, b) => order(a) - order(b));
  const out = new Map<string, Decision>();
  for (const r of sorted) {
    const d = decideRootCause(r, ctx, seedDecisions);
    out.set(r.id, d);
    if (r.kind.startsWith('core-') && !seedDecisions.has(r.seedCase)) seedDecisions.set(r.seedCase, d);
  }
  return rootCauses.map(r => ({ ...r, decision: out.get(r.id)! }));
}
