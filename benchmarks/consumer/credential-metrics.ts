/** Presentation accounting over engine-authored observations, never raw-range evaluation (#868). */
import type { AccountingConfig } from '../shared/accounting-types.ts';
import { INSUFFICIENT_EVIDENCE, INSUFFICIENT_COVERAGE, floorFor, proportion, ratio, validateMechanicalAccounting, assertCompatibleIdentities, type AccountingArtifactIdentity, type MechanicalPublished } from '../shared/statistical-primitives.ts';
import { credentialIdentity } from './credential-identity.ts';
export const ACCOUNTING_VERSION = '1.1';
export const DOMAIN_ACCOUNTING_VERSION = credentialIdentity.domainAccountingVersion;
export const credentialAccountingIdentity = (evaluationProfile: 'measurement-v4' | 'evaluation-v1'): AccountingArtifactIdentity => ({
  domain: credentialIdentity.domain,
  evaluationProfile,
  domainAccountingVersion: DOMAIN_ACCOUNTING_VERSION,
});

/** Missing envelopes are historical credential artifacts, never generic or cross-domain evidence. */
export function readCredentialAccountingIdentity(value: Record<string, unknown>, legacyProfile: 'measurement-v4' | 'evaluation-v1'): AccountingArtifactIdentity {
  const fields = [value.domain, value.evaluationProfile, value.domainAccountingVersion];
  if (fields.every(field => field === undefined)) return credentialAccountingIdentity(legacyProfile);
  if (fields.some(field => typeof field !== 'string')) throw new Error('Incomplete accounting identity envelope');
  const identity = { domain: String(value.domain), evaluationProfile: String(value.evaluationProfile), domainAccountingVersion: String(value.domainAccountingVersion) };
  assertCredentialAccountingIdentities([identity], legacyProfile);
  return identity;
}

export function assertCredentialAccountingIdentities(identities: AccountingArtifactIdentity[], profile: 'measurement-v4' | 'evaluation-v1') {
  const identity = assertCompatibleIdentities(identities);
  const expected = credentialAccountingIdentity(profile);
  if (identity.domain !== expected.domain || identity.evaluationProfile !== expected.evaluationProfile ||
      identity.domainAccountingVersion !== expected.domainAccountingVersion)
    throw new Error(`Unsupported credential accounting identity: ${identity.domain}/${identity.evaluationProfile}/${identity.domainAccountingVersion}`);
  return identity;
}

export type Published = MechanicalPublished;
export type Rate = Exclude<MechanicalPublished, string | null>;
export type CredentialOutcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
export interface RecordedCredentialRow {
  id: string; kind?: 'must-redact' | 'must-not-flag' | 'policy'; tier?: 'T0' | 'T1' | 'T2' | 'T3'; twinOf?: string;
  expected: { start: number; end: number; role?: 'secret' | 'companion'; envelope?: { start: number; end: number } }[];
  spanOutcomes?: CredentialOutcome[]; leakedBytes?: number; collateralBytes?: number;
  flagged?: boolean; findings?: number; coDetected?: boolean;
}
interface RecordedGroupCounts {
  files: number; spans?: number; secretBytes?: number; outcomes?: Record<string, number>;
  flaggedFiles?: number; findings?: number; leakedSpans?: number; leakedBytes?: number; collateralBytes?: number;
  twins?: { positives: number; pairs: number; discriminated: number; coDetected: number };
  diagnostics?: { exact: { tp?: number; fp: number; fn?: number; tn?: number }; comparable: boolean };
}
export interface AccountedGroup {
  files: number; scored?: boolean; candidateKinds?: Record<string, number>;
  spans?: number; secretBytes?: number; outcomes?: Record<string, number>;
  pendingFiles?: number; measurableShare?: Published; envelopeWidth?: { spans: number; bytes: number };
  flaggedFiles?: number; findings?: number; falseAlarmRate?: Published; meanFindingsPerFlagged?: Published;
  leakedSpans?: number; leakedSpanRate?: Published; leakedBytes?: number; leakedByteRate?: Published;
  collateralBytes?: number; collateralRatio?: Published;
  twins?: { positives: number; pairs: number; discriminated: number; coDetected: number; coverage: Published; rate: Published | 'insufficient-coverage' };
  diagnostics?: { exact: { tp?: number; fp: number; fn?: number; tn?: number }; comparable: boolean };
}
export const SUMMARY_SCHEMA_VERSION = 1;
export interface SummaryScanner { id: string; name: string; version: string | null; mode: string; status: string; completeSuites: number }
export interface RunSummary {
  schemaVersion: typeof SUMMARY_SCHEMA_VERSION; accountingVersion: string; runId: string; generatedAt: string;
  domain: string; evaluationProfile: string; domainAccountingVersion: string;
  categories: string[]; accounting: AccountingConfig; scanners: SummaryScanner[];
  overall: Record<string, Record<string, AccountedGroup>>;
  byDetector: Record<string, Record<string, Record<string, AccountedGroup>>>;
}
export function validateAccounting(value: unknown): AccountingConfig {
  const a = value as AccountingConfig;
  validateMechanicalAccounting(value);
  const unit = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;
  const floor = (f: unknown) => unit(f) || (!!f && typeof f === 'object' && unit((f as Record<string, number>).default) && Object.values(f).every(unit));
  if (!a || a.version !== ACCOUNTING_VERSION || !Number.isInteger(a.minDenominator) || a.minDenominator < 1 ||
      !floor(a.resolvedRateFloor) || !floor(a.measurableShareFloor) || !floor(a.twinCoverageFloor) ||
      !Number.isInteger(a.replays) || a.replays < 2 || !(a.intervalZ > 0) ||
      !Number.isInteger(a.intervalPrecision) || a.intervalPrecision < 1 || a.intervalPrecision > 12)
    throw new Error('Invalid accounting configuration');
  return a;
}

export const groupKey = (kind: string | undefined, tier: string | undefined) => tier === 'T0' ? 'pending/T0' : `${kind}/${tier}`;
const OUTCOMES: CredentialOutcome[] = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
const isLeaked = (outcome: CredentialOutcome) => outcome === 'PARTIAL' || outcome === 'MISS';

function recordedCounts(rows: RecordedCredentialRow[]): Record<string, RecordedGroupCounts> {
  const groups: Record<string, RecordedGroupCounts> = {};
  const byId = new Map(rows.map(row => [row.id, row]));
  if (byId.size !== rows.length) throw new Error('Duplicate credential observation id');
  const twins = new Map<string, RecordedCredentialRow[]>();
  for (const row of rows) {
    if (!['T0', 'T1', 'T2', 'T3'].includes(row.tier ?? '') || !['must-redact', 'must-not-flag', 'policy'].includes(row.kind ?? '')) throw new Error('Invalid credential observation stratum');
    if (row.tier !== 'T0') {
      if (row.kind === 'must-not-flag') {
        if (typeof row.flagged !== 'boolean' || !Number.isInteger(row.findings) || Number(row.findings) < 0) throw new Error('Invalid recorded control observation');
      } else {
        const secretSpans = row.expected.filter(span => (span.role ?? 'secret') === 'secret');
        if (!Array.isArray(row.spanOutcomes) || row.spanOutcomes.some(outcome => !OUTCOMES.includes(outcome)) ||
            !Number.isFinite(row.leakedBytes) || Number(row.leakedBytes) < 0 || !Number.isFinite(row.collateralBytes) || Number(row.collateralBytes) < 0 ||
            secretSpans.some(span => !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start)) throw new Error('Invalid recorded positive observation');
      }
    }
    const positive = row.twinOf && row.tier !== 'T0' ? byId.get(row.twinOf) : undefined;
    if (positive && positive.kind !== 'must-not-flag' && positive.tier !== 'T0') {
      if (!twins.has(positive.id)) twins.set(positive.id, []);
      twins.get(positive.id)!.push(row);
    }
  }
  for (const row of rows) {
    const key = groupKey(row.kind, row.tier);
    const g = groups[key] ??= row.tier === 'T0' ? { files: 0 } : row.kind === 'must-not-flag' ? { files: 0, flaggedFiles: 0, findings: 0 } : {
      files: 0, spans: 0, secretBytes: 0, outcomes: Object.fromEntries(OUTCOMES.map(outcome => [outcome, 0])),
      leakedSpans: 0, leakedBytes: 0, collateralBytes: 0, twins: { positives: 0, pairs: 0, discriminated: 0, coDetected: 0 },
    };
    g.files++;
    if (row.tier === 'T0') continue;
    if (row.kind === 'must-not-flag') { g.findings! += row.findings!; if (row.flagged) g.flaggedFiles!++; continue; }
    g.spans! += row.spanOutcomes!.length;
    g.secretBytes! += row.expected.filter(span => (span.role ?? 'secret') === 'secret').reduce((n, span) => n + span.end - span.start, 0);
    for (const outcome of row.spanOutcomes!) { g.outcomes![outcome]++; if (isLeaked(outcome)) g.leakedSpans!++; }
    g.leakedBytes! += row.leakedBytes!; g.collateralBytes! += row.collateralBytes!;
    g.twins!.positives++;
    for (const twin of twins.get(row.id) ?? []) { g.twins!.pairs++; if (twin.coDetected) g.twins!.coDetected++; }
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)));
}

export function accountRecordedGroups(rows: RecordedCredentialRow[], config: AccountingConfig): Record<string, AccountedGroup> {
  validateAccounting(config);
  const groups = accountRecordedCounts(rows, config, recordedCounts(rows));
  for (const group of Object.values(groups)) delete group.diagnostics;
  return groups;
}

const secretsOf = (row: RecordedCredentialRow) => row.expected.filter(e => (e.role ?? 'secret') === 'secret');
const acceptable = (outcome: string) => outcome === 'EXACT' || outcome === 'COVERED';

/**
 * v1.1 groups. Counts are identical to `aggregateGroups` (the v1.0 scorer)
 * except `twins.discriminated`, which follows the absolute assertion:
 * an OVERBROAD positive has not demonstrated discrimination (§3).
 */
export function accountRecordedCounts(rows: RecordedCredentialRow[], config: AccountingConfig, v10: Record<string, RecordedGroupCounts>): Record<string, AccountedGroup> {
  const byId = new Map(rows.map(r => [r.id, r]));
  // The candidate kind of a T0 row is the kind its assessment already carries.
  const pending: Record<string, number> = {};
  for (const r of rows) if (r.tier === 'T0' && r.kind) pending[r.kind] = (pending[r.kind] ?? 0) + 1;
  const strict: Record<string, number> = {}, envelopes: Record<string, { spans: number; bytes: number }> = {};
  for (const twin of rows) {
    const positive = twin.twinOf && twin.tier !== 'T0' ? byId.get(twin.twinOf) : undefined;
    if (!positive || positive.kind === 'must-not-flag' || positive.tier === 'T0') continue;
    const key = groupKey(positive.kind, positive.tier);
    strict[key] ??= 0;
    if (positive.spanOutcomes!.every(acceptable) && !twin.flagged) strict[key]++;
  }
  for (const r of rows) {
    if (r.tier === 'T0' || r.kind === 'must-not-flag') continue;
    const e = (envelopes[groupKey(r.kind, r.tier)] ??= { spans: 0, bytes: 0 });
    for (const s of secretsOf(r)) if (s.envelope) { e.spans++; e.bytes += (s.envelope.end - s.envelope.start) - (s.end - s.start); }
  }
  const groups: Record<string, AccountedGroup> = {};
  for (const [key, g] of Object.entries(v10)) {
    if (key === 'pending/T0') { groups[key] = { files: g.files, scored: false, candidateKinds: Object.fromEntries(Object.entries(pending).sort(([a], [b]) => a.localeCompare(b))) }; continue; }
    if (key.startsWith('must-not-flag/')) {
      groups[key] = { files: g.files, flaggedFiles: g.flaggedFiles, findings: g.findings,
        falseAlarmRate: proportion(g.flaggedFiles!, g.files, 'upper', config),
        meanFindingsPerFlagged: ratio(g.findings!, g.flaggedFiles!, config, g.files),
        diagnostics: g.diagnostics };
      continue;
    }
    const kind = key.split('/')[0], twins = g.twins!;
    const pendingFiles = pending[kind] ?? 0;
    const measurableShare = proportion(g.files, g.files + pendingFiles, 'lower', config);
    const measurable = g.files / (g.files + pendingFiles) >= floorFor(config.measurableShareFloor, kind);
    const withheld = <T>(rate: T) => (measurable ? rate : INSUFFICIENT_EVIDENCE);
    const coverage = proportion(twins.pairs, twins.positives, 'lower', config);
    const covered = twins.positives > 0 && twins.pairs / twins.positives >= floorFor(config.twinCoverageFloor, kind);
    const discriminated = strict[key] ?? 0;
    groups[key] = {
      files: g.files, spans: g.spans, secretBytes: g.secretBytes, outcomes: g.outcomes,
      pendingFiles, measurableShare, envelopeWidth: envelopes[key] ?? { spans: 0, bytes: 0 },
      leakedSpans: g.leakedSpans, leakedSpanRate: withheld(proportion(g.leakedSpans!, g.spans!, 'upper', config)),
      leakedBytes: g.leakedBytes, leakedByteRate: withheld(proportion(g.leakedBytes!, g.secretBytes!, 'upper', config, g.spans!)),
      collateralBytes: g.collateralBytes, collateralRatio: withheld(ratio(g.collateralBytes!, g.secretBytes!, config, g.spans!)),
      twins: { positives: twins.positives, pairs: twins.pairs, discriminated, coDetected: twins.coDetected, coverage,
        rate: !twins.pairs ? null : !measurable ? INSUFFICIENT_EVIDENCE : !covered ? INSUFFICIENT_COVERAGE
          : proportion(discriminated, twins.pairs, 'lower', config) },
      diagnostics: g.diagnostics,
    };
  }
  return groups;
}

type SuiteRow = RecordedCredentialRow & { category: string };

/**
 * Groups of the selected fixtures for one scanner, accounted exactly as the
 * site's per-selection view always has (src/model.mjs summarize): a group is
 * accounted over the suites that hold it, and within those suites a positive's
 * twin and the selection's pending (T0) rows travel with it. Pending rows that
 * live only in other suites do not consume this group's measurable share;
 * whether they should is an accounting question, not one this module settles.
 */
export function selectionGroups<T extends SuiteRow>(all: T[], selected: Set<string>, config: AccountingConfig, account: (rows: T[], config: AccountingConfig) => Record<string, AccountedGroup> = accountRecordedGroups): Record<string, AccountedGroup> {
  const mine = all.filter(r => selected.has(r.id));
  const pending = new Set(mine.filter(r => r.tier === 'T0').map(r => r.id));
  const groups: Record<string, AccountedGroup> = {};
  for (const key of [...new Set(mine.map(r => groupKey(r.kind, r.tier)))].sort()) {
    const members = mine.filter(r => groupKey(r.kind, r.tier) === key);
    const own = new Set(members.map(r => r.id)), suites = new Set(members.map(r => r.category));
    const group = account(all.filter(r => suites.has(r.category) && (own.has(r.id) || pending.has(r.id) || (r.twinOf != null && own.has(r.twinOf)))), config)[key];
    if (group) groups[key] = group;
  }
  return groups;
}
