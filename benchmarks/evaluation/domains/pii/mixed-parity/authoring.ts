import { piiFixtureCorrections } from '../current-inputs.ts';
/**
 * Authored truth for the #427 mixed-document parity plan (benchmarks #427, core #901).
 *
 * Every document is a sequence of lines. A line is one of:
 * - a reviewed family case (`source`), copied verbatim from the frozen #424/#425/#426 plans together with that
 *   case's own reviewed expectation (the source plan's commitment is bound, so a source edit fails the build);
 * - a reviewed credential fixture (`credential`), referenced by id and content SHA-256 only. Generated credential
 *   inputs must not be tracked (`fixtures:check`), so the value is materialized from the ensured generator output
 *   at run time and never appears in this plan;
 * - authored text (`text`) with its own authored expectation and contract basis.
 *
 * `pii-context/v1` associates context only on the same logical line (`association.sameLogicalLine`), so a reviewed
 * single-line case keeps its reviewed outcome when it becomes one line of a longer document. Lines that put two
 * candidates or fields on one line are exactly where the contract is literal-but-contested (#424 observation 3,
 * #425 finding 2) and where the parallel core repair batch may change behaviour; they carry an `optional`
 * envelope: the contract-v1-literal outcome (absent) and the revised outcome (the listed finding) are both
 * acceptable, every other outcome is wrong, and every surface must still agree with every other surface.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { materializeC3Case } from '../ssn-phone-stress.ts';

export const MIXED_PARITY_PLAN_FILE = 'benchmarks/evaluation/domains/pii/mixed-parity/mixed-parity-v1.json';
const PII_DIR = 'benchmarks/evaluation/domains/pii/';

export type SourcePlanId = 'email' | 'network' | 'card' | 'iban' | 'ssn' | 'phone';
export const SOURCE_PLANS: Record<SourcePlanId, { path: string; issue: string; kind: 'population' | 'stress' | 'c3' }> = {
  email: { path: `${PII_DIR}email-population-plan-v2.json`, issue: '#424', kind: 'population' },
  network: { path: `${PII_DIR}network-address-population-plan-v1.json`, issue: '#424', kind: 'population' },
  card: { path: `${PII_DIR}card-iban-stress/payment-card-stress-v1.json`, issue: '#425', kind: 'stress' },
  iban: { path: `${PII_DIR}card-iban-stress/iban-stress-v1.json`, issue: '#425', kind: 'stress' },
  ssn: { path: `${PII_DIR}us-ssn-stress-v2.json`, issue: '#426', kind: 'c3' },
  phone: { path: `${PII_DIR}phone-stress-v2.json`, issue: '#426', kind: 'c3' },
};
/** #426 reviewed corpus corrections: these frozen expectations are wrong, so the cases are never sourced here. */
export const C3_CORRECTIONS_FILE = 'evidence/901/426/pii-c3-reviewed-corrections-v1.json';
export const CREDENTIAL_SOURCE = { path: 'fixtures/generated/common-formats.json', generator: 'fixtures/generated/common-formats.mjs' } as const;

export const PII_ON_SELECTORS = ['pii:global', 'pii:us'] as const;
export const REPLACING_ACTIONS = ['redact', 'block'] as const;

export interface AuthoredTarget {
  /** UTF-8 byte offsets inside the line. */
  start: number; end: number;
  type: string; family: string; action: 'redact' | 'warn';
  basis: string; knownDefect?: string;
}
export interface OptionalTarget extends AuthoredTarget { envelope: string; ref: string }
export type LineSpec =
  | { source: SourcePlanId; caseId: string; role: LineRole; knownDefect?: string; optional?: OptionalTarget[]; crossFamilyBasis?: string }
  | { credential: string; role: 'credential' | 'credential-twin' }
  | { text: string; role: LineRole; targets?: AuthoredTarget[]; optional?: OptionalTarget[] };
export type LineRole = 'pii-sensitive' | 'pii-non-sensitive' | 'pii-not-established' | 'pii-envelope' | 'ordinary' | 'public-reference';
export interface DocumentSpec { id: string; title: string; languages: string[]; purpose: string; lines: LineSpec[] }

const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Optional-target helper: the target is the first occurrence of `value` inside the authored `text`. */
function at(text: string, value: string, rest: Omit<OptionalTarget, 'start' | 'end'>): OptionalTarget;
function at(text: string, value: string, rest: Omit<AuthoredTarget, 'start' | 'end'>): AuthoredTarget;
function at(text: string, value: string, rest: Record<string, unknown>) {
  const index = text.indexOf(value);
  if (index < 0) throw new Error('authored target value is not in its line');
  const start = byteLength(text.slice(0, index));
  return { start, end: start + byteLength(value), ...rest };
}

const PHONE = { type: 'pii_global_phone', family: 'pii:global:phone' } as const;
const CARD = { type: 'pii_global_payment_card', family: 'pii:global:payment-card' } as const;
const NET = { type: 'pii_global_network_address', family: 'pii:global:network-address' } as const;
const EMAIL = { type: 'pii_global_email', family: 'pii:global:email' } as const;

const LOCAL_PHONE_LINE = 'phone: 734-2291';
const LUHN_PHONE_LINE = 'phone: 4004251569';
const PERIOD_IP_LINE = 'WARN login failed for client ip: 10.61.3.7.';
const EQUIDISTANT_CARD_LINE = 'ip=203.0.113.9 card_number=4000000000425019';
const LOGFMT_EMAIL_LINE = '2026-09-28 12:00:03 user=42 email=sanna.berg@auth.v7c2x.synthetic action=login ok';
const DENSE_IP_LINE = 'src=10.1.1.5 dst=10.1.1.6 ip: 10.1.1.7';
const EMAIL_THEN_IP_LINE = 'user kim.ops@t4r8w.synthetic ip: 10.40.2.9';

const SAME_LINE = 'same-line-multi-field';
export const DOCUMENTS: DocumentSpec[] = [
  {
    id: 'support-ticket-en', title: 'Support ticket with a customer contact block', languages: ['en', 'ko'],
    purpose: 'Sensitive email and phone beside reserved/example controls, a warn-only local phone, a public reference and a credential.',
    lines: [
      { text: 'Subject: Re: account access request 4471', role: 'ordinary' },
      { text: 'Hi team, the customer below asked us to update their contact record.', role: 'ordinary' },
      { source: 'email', caseId: 'email-p-plain-label', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'qp-en-dash-phone', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'db-555-lower', role: 'pii-non-sensitive' },
      { source: 'email', caseId: 'email-r-example-com', role: 'pii-non-sensitive' },
      { text: LOCAL_PHONE_LINE, role: 'pii-sensitive', targets: [at(LOCAL_PHONE_LINE, '734-2291', { ...PHONE, action: 'warn',
        basis: 'phone-v1: local-only NXX-XXXX receives medium identity confidence; arbitration ADR: public confidence is the lower of identity and sensitivity confidence, and Medium warns. A warn finding is reported, not sanitized.' })] },
      { text: 'Public reference: NANPA reserves 555-0100 through 555-0199 for fictional use, see https://www.nanpa.com/numbering/555-line-numbers', role: 'public-reference' },
      { credential: 'github-token-ghp-plain', role: 'credential' },
      { text: 'Thanks, and sorry for the delay 🙏', role: 'ordinary' },
      { source: 'email', caseId: 'email-p-ko-customer-label', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'qp-ko-mobile-field', role: 'pii-sensitive' },
    ],
  },
  {
    id: 'app-log-logfmt', title: 'Application log with logfmt and access-log lines', languages: ['en'],
    purpose: 'Network addresses and emails in log grammar beside an AWS key pair and a JWT; contested same-line and trailing-period envelopes.',
    lines: [
      { source: 'network', caseId: 'net-s-logfmt', role: 'pii-sensitive' },
      { source: 'network', caseId: 'net-r-doc-192', role: 'pii-non-sensitive' },
      { source: 'email', caseId: 'email-p-logfmt-colon', role: 'pii-sensitive' },
      { text: LOGFMT_EMAIL_LINE, role: 'pii-envelope', optional: [at(LOGFMT_EMAIL_LINE, 'sanna.berg@auth.v7c2x.synthetic', { ...EMAIL, action: 'redact',
        basis: 'email-v1 whole-candidate rule: `=` is atext, so `email=address` is one candidate with no field label (#424 observation 1).',
        envelope: 'logfmt-email-equals', ref: 'redact-secret-benchmarks#424 observation 1; core repair batch (logfmt email=)' })] },
      { credential: 'aws-access-key-pair-plain', role: 'credential' },
      { source: 'network', caseId: 'net-o-access-log', role: 'pii-not-established' },
      { text: PERIOD_IP_LINE, role: 'pii-envelope', optional: [at(PERIOD_IP_LINE, '10.61.3.7', { ...NET, action: 'redact',
        basis: 'network-address contract is silent on a sentence-final period (#424 observation 6).',
        envelope: 'ip-before-sentence-final-period', ref: 'redact-secret-benchmarks#424 observation 6; core repair batch (IP before period)' })] },
      { text: DENSE_IP_LINE, role: 'pii-envelope', optional: [at(DENSE_IP_LINE, '10.1.1.7', { ...NET, action: 'redact',
        basis: 'pii-context/v1 equidistant rule counts the preceding candidate on a dense single-space line (#424 observation 3).',
        envelope: SAME_LINE, ref: 'redact-secret-benchmarks#424 observation 3; core repair batch (same-line multi-field labels)' })] },
      { text: EMAIL_THEN_IP_LINE, role: 'pii-envelope', optional: [at(EMAIL_THEN_IP_LINE, '10.40.2.9', { ...NET, action: 'redact',
        basis: 'a bare email just before `ip:` blocks the address under the literal equidistance rule (#424 observation 3).',
        envelope: SAME_LINE, ref: 'redact-secret-benchmarks#424 observation 3; core repair batch (same-line multi-field labels)' })] },
      { source: 'network', caseId: 'net-a-ipv6-compressed', role: 'pii-sensitive' },
      { credential: 'jwt-eddsa-plain', role: 'credential' },
      { text: '2026-09-28T12:00:05Z INFO request completed in 42 ms', role: 'ordinary' },
    ],
  },
  {
    id: 'payment-form', title: 'Checkout form dump', languages: ['en'],
    purpose: 'Card and IBAN positives beside official test values, collisions, documentation examples, the #922 same-range pair and a Slack token.',
    lines: [
      { text: 'Checkout session 7f3a summary', role: 'ordinary' },
      { source: 'card', caseId: 'card-pos-visa16-log-line', role: 'pii-sensitive' },
      { source: 'card', caseId: 'card-test-visa-spaced-layout', role: 'pii-non-sensitive' },
      { source: 'card', caseId: 'card-collision-order-number', role: 'pii-not-established' },
      { source: 'iban', caseId: 'iban-pos-gb22-beneficiary', role: 'pii-sensitive' },
      { source: 'iban', caseId: 'iban-pos-it27-print', role: 'pii-sensitive' },
      { source: 'iban', caseId: 'iban-doc-example-before', role: 'pii-non-sensitive' },
      { source: 'card', caseId: 'card-xfam-visa10-nanp-shaped-under-card-label', role: 'pii-sensitive', knownDefect: 'redact-secret/redact-secret#922' },
      { source: 'card', caseId: 'card-xfam-nearest-after-ip', role: 'pii-sensitive',
        crossFamilyBasis: '203.0.113.9 is RFC 5737 TEST-NET-3 documentation space, which the network-address contract keeps non-sensitive (reviewed #424 case net-r-doc-203), so the only finding is the card.' },
      { text: EQUIDISTANT_CARD_LINE, role: 'pii-envelope', optional: [at(EQUIDISTANT_CARD_LINE, '4000000000425019', { ...CARD, action: 'redact',
        basis: 'pii-context/v1: a label equidistant from two candidates associates with neither (#425 finding 2, contract-literal false negative).',
        envelope: SAME_LINE, ref: 'redact-secret-benchmarks#425 finding 2; core repair batch (same-line multi-field labels)' })] },
      { credential: 'slack-token-bot-plain', role: 'credential' },
      { text: 'Order total: 42.00 EUR, shipped via standard post.', role: 'ordinary' },
    ],
  },
  {
    id: 'hr-record', title: 'HR onboarding record', languages: ['en', 'ko'],
    purpose: 'US SSN and phone positives beside invalid-area twins, identifier collisions, 555 controls, extensions and the #922 Luhn-valid phone.',
    lines: [
      { text: 'Employee onboarding record (synthetic)', role: 'ordinary' },
      { source: 'ssn', caseId: 'qp-en-display-long-field', role: 'pii-sensitive' },
      { source: 'ssn', caseId: 'db-en-json-field', role: 'pii-sensitive' },
      { source: 'ssn', caseId: 'bh-en-employee-id', role: 'pii-not-established' },
      { source: 'ssn', caseId: 'qp-twin-area-666', role: 'pii-not-established' },
      { source: 'ssn', caseId: 'qp-ko-display-field', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'db-en-json-field', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'bh-555-plus-space', role: 'pii-non-sensitive' },
      { source: 'phone', caseId: 'qp-ext-dot-six-digits', role: 'pii-sensitive' },
      { text: LUHN_PHONE_LINE, role: 'pii-sensitive', targets: [at(LUHN_PHONE_LINE, '4004251569', { ...PHONE, action: 'redact', knownDefect: 'redact-secret/redact-secret#922',
        basis: 'phone-v1: NANP 400-425-1569 under the high-signal `phone` field; the arbitration ADR evaluates each same-range alternative under its own contract, so the Luhn-valid card alternative must not block it (#922).' })] },
      { credential: 'gitlab-token-pat-plain', role: 'credential' },
      { text: 'Reviewed by HR operations; no further action required.', role: 'ordinary' },
    ],
  },
  {
    id: 'config-export', title: 'Service configuration export', languages: ['en'],
    purpose: 'JSON-embedded PII of four families around a multi-line PEM private key (block action) and a credential near-miss twin.',
    lines: [
      { text: '# service configuration export', role: 'ordinary' },
      { source: 'network', caseId: 'net-a-json-event', role: 'pii-sensitive' },
      { credential: 'private-key-ed25519-plain', role: 'credential' },
      { source: 'email', caseId: 'email-p-json-field', role: 'pii-sensitive' },
      { source: 'card', caseId: 'card-pos-discover6011-json', role: 'pii-sensitive' },
      { source: 'iban', caseId: 'iban-pos-nl18-json', role: 'pii-sensitive' },
      { text: 'retries = 3', role: 'ordinary' },
      { credential: 'npm-token-access-plain-twin', role: 'credential-twin' },
    ],
  },
  {
    id: 'unicode-ko-record', title: 'Korean customer record with astral symbols', languages: ['ko', 'en'],
    purpose: 'UTF-16 surrogate pairs, Hangul and non-ASCII email local parts before candidates of five families, so byte, code-point and UTF-16 offsets all differ.',
    lines: [
      { text: '🧾 고객 상담 기록 — 2026년 9월 28일 ✅', role: 'ordinary' },
      { source: 'iban', caseId: 'iban-ko-pos-se24-astral-print', role: 'pii-sensitive' },
      { source: 'network', caseId: 'net-a-ko-ip-address', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'db-ko-field-space', role: 'pii-sensitive' },
      { source: 'ssn', caseId: 'db-ko-us-field-compact', role: 'pii-sensitive' },
      { source: 'card', caseId: 'card-ko-pos-mastercard-credit-card-number', role: 'pii-sensitive' },
      { source: 'email', caseId: 'email-u-cyrillic-local', role: 'pii-sensitive' },
      { source: 'email', caseId: 'email-u-ko-spaced-suffix', role: 'pii-sensitive' },
      { source: 'phone', caseId: 'db-ko-contact-ambiguous', role: 'pii-not-established' },
      { text: '𝒜𝓁𝓁 𝒹ℴ𝓃ℯ 🎉', role: 'ordinary' },
      { credential: 'anthropic-token-api03-plain', role: 'credential' },
    ],
  },
  {
    id: 'ai-tool-results', title: 'AI tool-call results', languages: ['en'],
    purpose: 'JSON tool results mixing a sensitive email with public DNS data, a dry-run example recipient and identifier collisions, beside a Docker token.',
    lines: [
      { source: 'email', caseId: 'email-p-tool-result', role: 'pii-sensitive' },
      { source: 'network', caseId: 'net-q-tool-dns', role: 'pii-not-established' },
      { source: 'email', caseId: 'email-r-tool-dry-run', role: 'pii-non-sensitive' },
      { source: 'ssn', caseId: 'bh-en-account-number', role: 'pii-not-established' },
      { source: 'card', caseId: 'card-collision-loyalty-number', role: 'pii-not-established' },
      { credential: 'docker-token-pat-plain', role: 'credential' },
      { text: '{"tool":"summarize","result":"3 records processed"}', role: 'ordinary' },
    ],
  },
  {
    id: 'ci-log-credentials-only', title: 'CI log with credentials and no PII', languages: ['en'],
    purpose: 'PII-off invariance control: no PII candidate at all, so the pii-on and pii-off outputs must be identical byte for byte.',
    lines: [
      { text: 'Run started on runner-7 (ubuntu-24.04)', role: 'ordinary' },
      { credential: 'github-token-ghp-plain-twin', role: 'credential-twin' },
      { credential: 'npm-token-access-plain', role: 'credential' },
      { credential: 'huggingface-token-user-plain', role: 'credential' },
      { text: 'Build finished: 128 tests passed, 0 failed.', role: 'ordinary' },
      { text: 'Reference: RFC 7468 describes textual encodings of PKIX structures.', role: 'public-reference' },
    ],
  },
];

/** Resolve one reviewed source case into its verbatim line and reviewed expectation. */
export function sourceCase(source: SourcePlanId, caseId: string, crossFamilyBasis?: string) {
  const spec = SOURCE_PLANS[source];
  const raw = readFileSync(spec.path, 'utf8');
  const file = JSON.parse(raw);
  const findingType: string = file.findingType ?? file.plan?.findingType;
  const family: string = file.family ?? file.plan?.family;
  if (spec.kind === 'c3') {
    const corrected = new Set(piiFixtureCorrections.corrections.map((row: { caseId: string }) => row.caseId));
    if (corrected.has(caseId)) throw new Error(`${source}:${caseId} carries a reviewed #426 correction; it cannot be sourced`);
    const row = file.cases.find((entry: { id: string }) => entry.id === caseId);
    if (!row) throw new Error(`unknown ${source} case ${caseId}`);
    const built = materializeC3Case(row);
    return { planSha256: sha256(raw), family, findingType, input: built.input,
      target: row.expected.publicFinding ? { ...built.range, action: 'redact' as const } : null, sensitivity: row.oracle.sensitivity as string };
  }
  const cases = spec.kind === 'population' ? file.plan.cases : file.cases;
  const row = cases.find((entry: { id: string }) => entry.id === caseId);
  if (!row) throw new Error(`unknown ${source} case ${caseId}`);
  if (row.crossFamily && row.crossFamily !== 'none-expected' && !crossFamilyBasis) throw new Error(`${source}:${caseId} has no authored cross-family truth`);
  const expected = row.expected;
  if (expected.publicFinding && (typeof expected.start !== 'number' || typeof expected.end !== 'number')) throw new Error(`${source}:${caseId} has no range`);
  // Card and IBAN stress plans state no action; payment-card-v1 and iban-v1 take `redact` from the substrate's high-confidence policy.
  const action = expected.action ?? 'redact';
  if (expected.publicFinding && action !== 'redact') throw new Error(`${source}:${caseId} has an unexpected action`);
  return { planSha256: sha256(raw), family, findingType, input: row.input as string,
    target: expected.publicFinding ? { start: expected.start as number, end: expected.end as number, action: 'redact' as const } : null,
    sensitivity: (row.oracle?.sensitivity ?? (expected.sensitive ? 'sensitive' : 'not-sensitive')) as string };
}

/** Build the frozen plan. Credential values are never written; only their fixture id and content digest. */
export function buildMixedParityPlan(credentialFixtures: Map<string, { content: string; expected: Array<{ start: number; end: number }> }>) {
  const sourceDigests = new Map<SourcePlanId, string>();
  const documents = DOCUMENTS.map(document => {
    const lines = document.lines.map((spec, index) => {
      const id = `${document.id}/L${String(index + 1).padStart(2, '0')}`;
      if ('credential' in spec) {
        const fixture = credentialFixtures.get(spec.credential);
        if (!fixture) throw new Error(`unknown credential fixture ${spec.credential}`);
        const content = fixture.content.replace(/\n+$/, '');
        if (!/^[\x20-\x7e\n]*$/.test(content)) throw new Error(`credential fixture ${spec.credential} is not printable ASCII`);
        if (spec.role === 'credential' && !fixture.expected.length) throw new Error(`credential fixture ${spec.credential} expects nothing`);
        if (spec.role === 'credential-twin' && fixture.expected.length) throw new Error(`credential twin ${spec.credential} expects a finding`);
        return { id, role: spec.role, credentialFixture: spec.credential, contentSha256: sha256(content), byteLength: byteLength(content),
          targets: fixture.expected.map((span, n) => ({ id: `${id}/C${n + 1}`, domain: 'credential', start: span.start, end: span.end,
            actions: [...REPLACING_ACTIONS], basis: `reviewed must-redact fixture ${spec.credential} (T1 common-formats); any replacing action` })),
          optional: [] };
      }
      if ('source' in spec) {
        const resolved = sourceCase(spec.source, spec.caseId, spec.crossFamilyBasis);
        sourceDigests.set(spec.source, resolved.planSha256);
        if ((spec.role === 'pii-sensitive') !== Boolean(resolved.target)) throw new Error(`${id} role disagrees with its reviewed expectation`);
        return { id, role: spec.role, source: { plan: spec.source, caseId: spec.caseId, sensitivity: resolved.sensitivity,
          ...(spec.crossFamilyBasis ? { crossFamilyBasis: spec.crossFamilyBasis } : {}) }, text: resolved.input,
          targets: resolved.target ? [{ id: `${id}/P1`, domain: 'pii', family: resolved.family, type: resolved.findingType, start: resolved.target.start,
            end: resolved.target.end, action: resolved.target.action, basis: `reviewed ${SOURCE_PLANS[spec.source].issue} case ${spec.source}:${spec.caseId}`,
            ...(spec.knownDefect ? { knownDefect: spec.knownDefect } : {}) }] : [],
          optional: (spec.optional ?? []).map((target, n) => ({ id: `${id}/O${n + 1}`, domain: 'pii', ...target })) };
      }
      return { id, role: spec.role, text: spec.text,
        targets: (spec.targets ?? []).map((target, n) => ({ id: `${id}/P${n + 1}`, domain: 'pii', ...target })),
        optional: (spec.optional ?? []).map((target, n) => ({ id: `${id}/O${n + 1}`, domain: 'pii', ...target })) };
    });
    return { id: document.id, title: document.title, languages: document.languages, purpose: document.purpose, lines };
  });
  return {
    schemaVersion: 1, reportType: 'pii-mixed-parity-plan', planVersion: 1, supportClaims: false,
    issue: 'redact-secret/redact-secret-benchmarks#427', productIssue: 'redact-secret/redact-secret#901',
    parentLedger: { path: 'evidence/901/pii-gap-ledger-v1.json', contentCommitment: '7fcbba702d93849ce1452ee5a9adf3d20e493179107ec0c6bbda36cb9e5fd116' },
    profile: { id: 'pii-v1', path: 'qualification/pii-v1.json' },
    contracts: { repository: 'redact-secret/redact-secret', commit: 'af7f863f29f9fe482dd233c8b7bc5b77dc427314',
      files: ['docs/contracts/pii/pii-context-v1.json', 'docs/contracts/pii/email-v1.md', 'docs/contracts/pii/phone-v1.md', 'docs/contracts/pii/payment-card-v1.md',
        'docs/contracts/pii/iban-v1.md', 'docs/contracts/pii/us-ssn-v1.md', 'docs/decisions/2026-09-26-define-the-pii-domain-scope-arbitration-and-activation-contract.md'] },
    selections: { 'pii-on': [...PII_ON_SELECTORS], 'pii-off': [] },
    canonicalOffsetUnit: 'utf8-byte',
    placeholder: { formatter: 'default', form: '<SECRET_n>', numbering: 'one-based over replacing (redact/block) findings in input order' },
    accounting: {
      domains: ['pii', 'credential'], combinedScore: false,
      independentUnits: 'documents and their targets; LF/CRLF variants, partitions, selections, operations and surfaces are checks on the same units and never add independent cases',
      warn: 'a warn finding keeps its text: it is reported but never counted as sanitized success',
      optional: 'an optional target may be present (exactly as listed) or absent; everything else outside the required targets must be absent',
    },
    sources: {
      plans: Object.fromEntries([...sourceDigests.entries()].sort().map(([key, digest]) => [key, { path: SOURCE_PLANS[key].path, sha256: digest }])),
      corrections: { path: C3_CORRECTIONS_FILE, sha256: piiFixtureCorrections.source.sha256 },
      credentials: { ...CREDENTIAL_SOURCE, stored: 'id and content SHA-256 only; values are regenerated by fixtures:generate --ensure' },
    },
    documents,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Plan v2 (after redact-secret#930): the v1 plan stays frozen; v2 is derived from it and changes only the envelopes.
// ---------------------------------------------------------------------------------------------------------------

export const MIXED_PARITY_PLAN_V2_FILE = 'benchmarks/evaluation/domains/pii/mixed-parity/mixed-parity-v2.json';
export const MIXED_PARITY_PLAN_FILES = { 1: MIXED_PARITY_PLAN_FILE, 2: MIXED_PARITY_PLAN_V2_FILE } as const;
const V2_CONTRACT_COMMIT = '79c0a66119fb72931fda9adddbe2973a52bb4833';

/**
 * Each v1 envelope the merged contracts now decide, with the contract text that decides it. A promoted target keeps
 * its v1 id so the two plans stay comparable target by target.
 */
export const V2_PROMOTIONS: Record<string, { basis: string; ref: string }> = {
  'app-log-logfmt/L04/O1': { ref: 'redact-secret/redact-secret#926',
    basis: 'email-v1 (at 79c0a66): in `key=local@domain`, a key that is a reviewed high-signal email label (`email`) and its `=` are a label, and the candidate starts after the `=`; `user=42` holds no candidate.' },
  'app-log-logfmt/L07/O1': { ref: 'redact-secret/redact-secret#925',
    basis: 'detector-families network-address row (at 79c0a66): one `.` directly after an address and followed by a line end or whitespace is a right boundary outside the range; `client ip` is the field label in front.' },
  'app-log-logfmt/L08/O1': { ref: 'redact-secret/redact-secret#924',
    basis: 'pii-context/v2 `association.fieldLabel.equidistanceAmong: following-candidates`: the `ip:` label counts only candidates after it, so the earlier unlabelled addresses no longer make it equidistant; `src=`/`dst=` are not labels, so those stay absent.' },
  'app-log-logfmt/L09/O1': { ref: 'redact-secret/redact-secret#924',
    basis: 'pii-context/v2 forward-only field-label equidistance: the preceding unlabelled email does not block `ip:`; `user` is not an email label, so the email stays absent.' },
  'payment-form/L10/O1': { ref: 'redact-secret/redact-secret#924',
    basis: 'pii-context/v2 forward-only field-label equidistance: `card_number=` associates with the following PAN; 203.0.113.9 is RFC 5737 documentation space and stays absent under `ip=`.' },
};

type PlanV1 = ReturnType<typeof buildMixedParityPlan>;
/** Derive plan v2 from the frozen v1 plan (expectations stripped), promoting every envelope the merged contracts decide. */
export function buildMixedParityPlanV2(v1: PlanV1, v1Commitment: string) {
  const used = new Set<string>();
  const documents = v1.documents.map(document => ({ ...document, lines: document.lines.map(line => {
    const promoted = line.optional.filter(target => V2_PROMOTIONS[target.id]);
    promoted.forEach(target => used.add(target.id));
    if (!promoted.length) return line;
    return { ...line, role: line.role === 'pii-envelope' ? 'pii-sensitive' as const : line.role,
      targets: [...line.targets, ...promoted.map(target => {
        const { envelope, ref: _ref, basis: _basis, ...rest } = target as typeof target & { envelope: string; ref: string };
        return { ...rest, basis: V2_PROMOTIONS[target.id].basis, promotedFrom: { planVersion: 1, envelope, ref: V2_PROMOTIONS[target.id].ref } };
      })],
      optional: line.optional.filter(target => !V2_PROMOTIONS[target.id]) };
  }) }));
  const missing = Object.keys(V2_PROMOTIONS).filter(id => !used.has(id));
  if (missing.length) throw new Error(`v2 promotions do not match v1 envelopes: ${missing.join(', ')}`);
  return {
    ...v1, planVersion: 2,
    supersedes: { path: MIXED_PARITY_PLAN_FILE, planVersion: 1, commitment: v1Commitment, frozenAt: '163f4ecbfc11fe679000353e305e4379fe45cee0' },
    contextVocabulary: 'pii-context/v2',
    contracts: { repository: 'redact-secret/redact-secret', commit: V2_CONTRACT_COMMIT,
      files: ['docs/contracts/pii/pii-context-v2.json', 'docs/decisions/2026-09-28-version-the-pii-context-vocabulary-as-v2.md', 'docs/contracts/pii/email-v1.md',
        'docs/contracts/pii/phone-v1.md', 'docs/contracts/pii/payment-card-v1.md', 'docs/contracts/pii/iban-v1.md', 'docs/contracts/pii/us-ssn-v1.md',
        'docs/specs/detector-families.md', 'docs/decisions/2026-09-26-define-the-pii-domain-scope-arbitration-and-activation-contract.md'] },
    accounting: { ...v1.accounting,
      optional: 'no optional target remains: every v1 envelope is decided by the merged contracts and is required; everything outside the required targets must be absent' },
    documents,
  };
}

export type MixedParityPlan = ReturnType<typeof buildMixedParityPlan> & { planVersion: number; supersedes?: unknown; contextVocabulary?: string };
