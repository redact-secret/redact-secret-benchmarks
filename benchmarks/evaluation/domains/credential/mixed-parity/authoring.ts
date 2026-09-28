/**
 * Authored truth for the #381 credential mixed-document parity plan (Beta.11 E, parent #376).
 *
 * A document is a sequence of lines. A line is either
 * - a reviewed credential fixture (`fixture`: `<category>--<id>`) from a generated corpus, bound by the SHA-256 of
 *   its content: the generated corpora are never tracked (`fixtures:check`), so values are rebuilt from their public
 *   synthetic seeds at run time and never appear in the plan. Its secret spans, envelopes and companions come from
 *   the fixture's own reviewed `expected` ranges; a `wrap` re-frames the fixture (JSON string escaping, Unicode
 *   neighbours) and the spans move with it mechanically; or
 * - authored filler (`text`): ordinary prose and logs, public identifiers (commit SHAs, request ids, URLs,
 *   placeholders and `${VAR}` references), with no credential in it.
 *
 * The families are the #377 ledger selection (docs/reports/2026-09-28/beta-11-family-axis-ledger.json) and the #860
 * families of #434/#436 (registry detectors or scored arrival families since the 1127bf9 re-pin). Per family the
 * plan takes, by a fixed rule, two positives on different context axes, one twin and one benign control from the
 * family's own corpus. Only documents and their targets are independent units; line-ending variants, chunk
 * partitions, operations and surfaces are checks on the same documents and are never counted as samples.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const CREDENTIAL_MIXED_PARITY_PLAN_FILE = 'benchmarks/evaluation/domains/credential/mixed-parity/credential-mixed-parity-v1.json';
export const FAMILY_LEDGER_FILE = 'docs/reports/2026-09-28/beta-11-family-axis-ledger.json';

/** Families of #860 (#434 Tier A and #436 Tier B), in corpus order, with the generated category that carries them. */
export const NEW_FAMILIES: Array<[string, string]> = [
  ['doppler-token', 'beta8-434a'], ['doppler-personal-token', 'beta8-434a'], ['doppler-cli-token', 'beta8-434a'],
  ['doppler-service-account-token', 'beta8-434a'], ['doppler-service-account-identity-token', 'beta8-434a'],
  ['doppler-scim-token', 'beta8-434a'], ['doppler-audit-token', 'beta8-434a'],
  ['trigger-dev-token', 'beta8-434b'], ['trigger-dev-personal-access-token', 'beta8-434b'], ['e2b-api-key', 'beta8-434c'],
  ['posthog-token', 'beta8-434d'], ['posthog-project-secret-api-key', 'beta8-434d'],
  ['helicone-api-key', 'beta8-434e'], ['helicone-write-api-key', 'beta8-434e'], ['firecrawl-api-key', 'beta8-434f'],
  ['composio-api-key', 'beta8-434g'], ['composio-org-api-key', 'beta8-434g'], ['composio-user-api-key', 'beta8-434g'],
  ['convex-deployment-key', 'beta8-436a'], ['onepassword-service-account-token', 'beta8-436b'], ['inngest-signing-key', 'beta8-436c'],
  ['resend-api-key', 'beta8-436d'], ['apify-api-token', 'beta8-436e'], ['wandb-api-key', 'beta8-436f'],
];
/** The #377 ledger families are evidenced in the #379 corpus. */
export const LEDGER_CATEGORY = 'beta8-379';

export type Wrap = 'plain' | 'line-unicode' | 'json-escaped' | 'adjacent-unicode' | 'long-line';
export type LineRole = 'positive' | 'twin' | 'control' | 'ordinary' | 'public-reference';
export interface PlanTarget {
  id: string; family: string; kind: 'must-redact' | 'policy';
  /** UTF-8 byte offsets inside the wrapped line. */
  start: number; end: number;
  envelope?: { start: number; end: number };
}
export interface PlanCompanion { start: number; end: number }
export type PlanLine =
  | { fixture: string; contentSha256: string; role: 'positive' | 'twin' | 'control'; family: string; wrap: Wrap;
    lineSha256: string; targets: PlanTarget[]; companions: PlanCompanion[]; contextAxis: string | null }
  | { text: string; role: 'ordinary' | 'public-reference' }
  /** `count` consecutive `oversizedFiller` lines starting at `from`, expanded at materialization so the plan stays small. */
  | { filler: 'oversized-log'; from: number; count: number; role: 'ordinary' };
export interface PlanDocument { id: string; title: string; purpose: string; lines: PlanLine[] }
export interface CredentialMixedParityPlan {
  schemaVersion: 1; issue: string; plan: 'credential-mixed-parity-v1'; families: string[];
  selection: { rule: string; ledger: string; ledgerSha256: string };
  documents: PlanDocument[];
}

const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

interface Range { start: number; end: number; role?: string; envelope?: { start: number; end: number } }
export interface GeneratedFixture {
  id: string; content: string; expected: Range[]; twinOf?: string; contextAxis?: string;
  detectors?: string[]; arrivalTargets?: string[]; assessment: { kind: string; contract?: string };
}
export type CorpusMap = Map<string, GeneratedFixture[]>;

/** Load the generated corpora the plan draws from (`npm run fixtures:generate` writes them). */
export function loadCorpora(categories = [LEDGER_CATEGORY, ...new Set(NEW_FAMILIES.map(([, category]) => category))]): CorpusMap {
  return new Map(categories.map(category => [category, JSON.parse(readFileSync(`fixtures/generated/${category}.json`, 'utf8')).fixtures]));
}

export function ledgerFamilies(file = FAMILY_LEDGER_FILE): string[] {
  return JSON.parse(readFileSync(file, 'utf8')).selection.map((row: { family: string }) => row.family);
}

const targetOf = (f: GeneratedFixture) => (f.arrivalTargets ?? f.detectors ?? [])[0];
const secretsOf = (f: GeneratedFixture) => f.expected.filter(r => (r.role ?? 'secret') === 'secret');

/**
 * The fixed per-family rule: the first positive in corpus order whose one secret span is not wrapped in an envelope,
 * then the first later positive on a different context axis (any envelope), the first twin and the first control.
 */
export function selectFamilyFixtures(corpus: GeneratedFixture[], family: string) {
  const own = corpus.filter(f => targetOf(f) === family);
  const positives = own.filter(f => !f.twinOf && secretsOf(f).length === 1 && f.assessment.kind !== 'must-not-flag');
  const first = positives.find(f => !secretsOf(f)[0].envelope && f.expected.length === 1) ?? positives[0];
  const second = positives.find(f => f !== first && f.contextAxis !== first?.contextAxis);
  const twin = own.find(f => f.twinOf);
  const control = own.find(f => !f.twinOf && !secretsOf(f).length);
  if (!first || !second || !control) throw new Error(`${family}: the corpus has no positive pair or no control for the parity rule`);
  return { positives: [first, second], twin, control };
}

/** Bare-value families whose value may be framed directly by non-ASCII punctuation without changing the contract. */
export function adjacentUnicodeEligible(contract: { pattern?: string; contextGated?: boolean; tier?: string } | undefined) {
  return Boolean(contract?.pattern && !contract.contextGated && (contract.tier === 'T1' || contract.tier === 'T2'));
}

const LINE_PREFIX = '💬 김민수 → チーム: ';
const LINE_SUFFIX = ' 🙏🏽 (é, ñ, ü, ✓)';
const OPEN = '「', CLOSE = '」';

/** Re-frame a fixture's content and move its ranges with it. Ranges are UTF-8 byte offsets. */
export function wrapFixture(fixture: GeneratedFixture, wrap: Wrap) {
  const content = fixture.content.replace(/\n+$/, '');
  const ranges = fixture.expected.map(r => ({ ...r }));
  if (wrap === 'plain') return { text: content, ranges };
  if (wrap === 'line-unicode') {
    const shift = byteLength(LINE_PREFIX);
    return { text: `${LINE_PREFIX}${content}${LINE_SUFFIX}`, ranges: ranges.map(r => ({ ...r, start: r.start + shift, end: r.end + shift,
      ...(r.envelope ? { envelope: { start: r.envelope.start + shift, end: r.envelope.end + shift } } : {}) })) };
  }
  if (wrap === 'long-line') {
    // The fixture follows a single minified JSON run longer than the 8 KiB incremental token limit, on the same line.
    const prefix = `{${longLineFiller(220)}} `;
    const shift = byteLength(prefix);
    return { text: `${prefix}${content}`, ranges: ranges.map(r => ({ ...r, start: r.start + shift, end: r.end + shift,
      ...(r.envelope ? { envelope: { start: r.envelope.start + shift, end: r.envelope.end + shift } } : {}) })) };
  }
  const bytes = Buffer.from(content, 'utf8');
  if (wrap === 'adjacent-unicode') {
    if (ranges.length !== 1 || ranges[0].envelope) throw new Error(`${fixture.id}: adjacent-unicode needs one bare secret span`);
    const [r] = ranges;
    const text = `${bytes.subarray(0, r.start).toString('utf8')}${OPEN}${bytes.subarray(r.start, r.end).toString('utf8')}${CLOSE}${bytes.subarray(r.end).toString('utf8')}`;
    const shift = byteLength(OPEN);
    return { text, ranges: [{ ...r, start: r.start + shift, end: r.end + shift }] };
  }
  // json-escaped: the whole fixture becomes one JSON string value; every range moves to its escaped position.
  const escapedPrefix = (offset: number) => byteLength(JSON.stringify(bytes.subarray(0, offset).toString('utf8')).slice(0, -1));
  const lead = '{"event":"paste","body":';
  const text = `${lead}${JSON.stringify(content)}}`;
  for (const r of ranges) {
    const value = bytes.subarray(r.start, r.end).toString('utf8');
    if (JSON.stringify(value) !== `"${value}"`) throw new Error(`${fixture.id}: a secret that JSON escaping changes cannot keep its bytes`);
  }
  const move = (offset: number) => byteLength(lead) + escapedPrefix(offset);
  return { text, ranges: ranges.map(r => ({ ...r, start: move(r.start), end: move(r.end),
    ...(r.envelope ? { envelope: { start: move(r.envelope.start), end: move(r.envelope.end) } } : {}) })) };
}

/** Authored filler: no credential, no credential-shaped value, only public identifiers and ordinary text. */
export const FILLER: Record<string, string[]> = {
  log: [
    '2026-09-28T10:14:03Z INFO deploy started for service=billing region=eu-west-1 attempt=1',
    '2026-09-28T10:14:05Z INFO fetched commit 3f9c2e1a7b4d5c6e8f901a2b3c4d5e6f7a8b9c0d from origin/main',
    '2026-09-28T10:14:07Z WARN retrying upstream GET https://status.example.com/health (503) in 2s',
    '2026-09-28T10:14:09Z INFO request_id=6f1d2c3b-4a59-4e7f-8a1b-2c3d4e5f6a7b completed in 184ms',
  ],
  markdown: [
    '## Rotation checklist',
    '- [ ] Revoke the old credential in the provider console, then update `${SERVICE_TOKEN}` in the vault.',
    '- [x] Confirm the placeholder `YOUR_API_KEY_HERE` is not committed anywhere.',
    '> Note: public dashboard ids such as `dash-12345` and project slugs are not secrets.',
  ],
  chat: [
    'Anna: can someone check why the nightly job failed? 😅',
    'Björn: looking now — it was the rotated key, see ticket OPS-4821 (https://tickets.example.com/OPS-4821)',
    'Chen 陈: 我已经更新了配置，请再试一次。',
  ],
  yaml: [
    'services:',
    '  worker:',
    '    image: registry.example.com/worker@sha256:9b2c1d0e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c',
    '    environment:',
    '      LOG_LEVEL: info',
    '      API_BASE_URL: https://api.example.com/v2',
  ],
};

/** A bounded oversized ordinary log: well over the 64 KiB incremental buffer, far under the 1 MiB input limit. */
export function oversizedFiller(lines: number) {
  return Array.from({ length: lines }, (_, index) =>
    `2026-09-28T11:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}Z INFO worker=${index % 7} batch=${index} processed 128 records in ${40 + (index % 17)}ms status=ok`);
}

/** A single minified line longer than the 8 KiB incremental token limit, carrying ordinary JSON members only. */
export function longLineFiller(members: number) {
  return Array.from({ length: members }, (_, index) => `"metric_${index}":{"p50":${index % 97},"p95":${(index * 7) % 311},"unit":"ms"}`).join(',');
}

const THEMES = ['log', 'markdown', 'chat', 'yaml'] as const;
const DOC_WRAPS: Wrap[] = ['line-unicode', 'json-escaped', 'adjacent-unicode', 'plain'];
export const SELECTION_RULE = 'per family: the first positive (one secret span, no envelope) and the first later positive on another context axis, the first twin and the first benign control, in corpus order; families in ledger order, then #434/#436 order, five per document';

/**
 * Build the plan from the generated corpora and the contracts. Deterministic: the same corpora and contracts give
 * the same plan, and the frozen JSON binds every fixture line by the SHA-256 of its content and of its wrapped line.
 */
export function buildCredentialMixedParityPlan(corpora: CorpusMap, contracts: Record<string, { pattern?: string; contextGated?: boolean; tier?: string }>,
  ledger = ledgerFamilies()): CredentialMixedParityPlan {
  const families: Array<[string, string]> = [...ledger.map(family => [family, LEDGER_CATEGORY] as [string, string]), ...NEW_FAMILIES];
  const picks = families.map(([family, category]) => {
    const corpus = corpora.get(category);
    if (!corpus) throw new Error(`${category} is not generated`);
    return { family, category, ...selectFamilyFixtures(corpus, family) };
  });
  const fixtureLine = (docId: string, index: number, category: string, family: string, fixture: GeneratedFixture, role: 'positive' | 'twin' | 'control', wrap: Wrap): PlanLine => {
    const effective: Wrap = wrap === 'adjacent-unicode' && !(role === 'positive' && adjacentUnicodeEligible(contracts[family]) && fixture.expected.length === 1 && !fixture.expected[0].envelope)
      ? 'line-unicode' : wrap;
    const { text, ranges } = wrapFixture(fixture, effective);
    const kind = fixture.assessment.kind === 'policy' ? 'policy' : 'must-redact';
    const targets = role === 'positive' ? ranges.filter(r => (r.role ?? 'secret') === 'secret').map((r, n) => ({
      id: `${docId}/L${index}/${family}${n ? `#${n}` : ''}`, family, kind: kind as 'must-redact' | 'policy', start: r.start, end: r.end,
      ...(r.envelope ? { envelope: r.envelope } : {}) })) : [];
    const companions = ranges.filter(r => r.role === 'companion').map(r => ({ start: r.start, end: r.end }));
    return { fixture: `${category}--${fixture.id}`, contentSha256: sha256(fixture.content), role, family, wrap: effective, lineSha256: sha256(text),
      targets, companions, contextAxis: fixture.contextAxis ?? null };
  };
  const documents: PlanDocument[] = [];
  for (let group = 0; group * 5 < picks.length; group += 1) {
    const members = picks.slice(group * 5, group * 5 + 5);
    const theme = THEMES[group % THEMES.length], wrap = DOC_WRAPS[group % DOC_WRAPS.length];
    const id = `mixed-${String(group + 1).padStart(2, '0')}-${theme}`;
    const lines: PlanLine[] = [];
    const filler = FILLER[theme];
    let f = 0;
    const fill = () => { const text = filler[f++ % filler.length]; lines.push({ text, role: /https?:|sha256:|commit|\$\{|YOUR_|dash-/.test(text) ? 'public-reference' : 'ordinary' }); };
    fill();
    for (const pick of members) {
      lines.push(fixtureLine(id, lines.length, pick.category, pick.family, pick.positives[0], 'positive', 'plain'));
      if (pick.twin) lines.push(fixtureLine(id, lines.length, pick.category, pick.family, pick.twin, 'twin', 'plain'));
      fill();
      lines.push(fixtureLine(id, lines.length, pick.category, pick.family, pick.positives[1], 'positive', wrap));
      lines.push(fixtureLine(id, lines.length, pick.category, pick.family, pick.control, 'control', theme === 'chat' ? 'line-unicode' : 'plain'));
    }
    fill();
    documents.push({ id, title: `Mixed ${theme} document ${group + 1}`, purpose: `${members.map(m => m.family).join(', ')}: two positives each (one ${wrap}), a twin and a control among ${theme} filler`, lines });
  }
  // Bounded oversized input: three positives at the start, the middle and the end of a ~90 KiB log.
  const byFamily = new Map(picks.map(p => [p.family, p]));
  // Line indices here are plan-line indices; a filler run is one plan line of `count` materialized lines.
  const oversized: PlanLine[] = [];
  const anchors: Array<[number, string]> = [[0, 'github-token'], [450, 'doppler-token'], [899, 'wandb-api-key']];
  let from = 0;
  for (const [at, family] of anchors) {
    if (at > from) { oversized.push({ filler: 'oversized-log', from, count: at - from, role: 'ordinary' }); from = at; }
    const p = byFamily.get(family)!;
    oversized.push(fixtureLine('bounded-oversized-log', oversized.length, p.category, p.family, p.positives[0], 'positive', 'plain'));
  }
  oversized.push({ filler: 'oversized-log', from, count: 900 - from, role: 'ordinary' });
  documents.push({ id: 'bounded-oversized-log', title: 'Bounded oversized log', purpose: 'three positives at the start, middle and end of a log over the 64 KiB incremental buffer and under the 1 MiB input limit', lines: oversized });
  // A positive after one minified run longer than the 8 KiB incremental token limit, on the same line.
  const longLine: PlanLine[] = [{ text: FILLER.log[0], role: 'ordinary' }];
  for (const family of ['stripe-token', 'resend-api-key']) { const p = byFamily.get(family)!; longLine.push(fixtureLine('long-minified-line', longLine.length, p.category, p.family, p.positives[0], 'positive', 'long-line')); }
  longLine.push({ text: FILLER.log[3], role: 'ordinary' });
  documents.push({ id: 'long-minified-line', title: 'Positive after an over-long minified token', purpose: 'a positive that follows, on the same line, a single run longer than the 8 KiB incremental token limit', lines: longLine });
  return { schemaVersion: 1, issue: 'redact-secret/redact-secret-benchmarks#381', plan: 'credential-mixed-parity-v1', families: families.map(([family]) => family),
    selection: { rule: SELECTION_RULE, ledger: FAMILY_LEDGER_FILE, ledgerSha256: sha256(readFileSync(FAMILY_LEDGER_FILE)) }, documents };
}
