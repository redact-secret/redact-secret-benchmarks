/**
 * External adversarial fixture intake and provenance (#139, part of #138).
 *
 * A pack enters as `submitted`, passes a `safety-review`, has its
 * `frozen-first-run` recorded against every evaluated scanner, and ends
 * `accepted`, `rejected` with a reason, or `converted-to-maintainer-regression`
 * after material project edits. `schemas/adversarial-intake-v1.json` is the
 * structural contract; this module enforces the rules a JSON Schema cannot:
 *
 * - real, live, revoked, real-derived or unknown-provenance credential
 *   material is a rejection ground, never an accepted pack;
 * - expectations are committed (by digest) at submission, before any scanner
 *   runs, and a pack whose author consulted scanner output is rejected;
 * - the first run is a separate file pinned by SHA-256 and by the submitted
 *   expectations digest, so later fixes cannot rewrite it;
 * - any material maintainer edit removes `externally-authored`.
 *
 * Validation never echoes fixture content: problems name ids and fields only.
 */
import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import intakeSchema from '../../schemas/adversarial-intake-v1.json';
import firstRunSchema from '../../schemas/adversarial-first-run-v1.json';

export type IntakeStatus =
  | 'submitted'
  | 'safety-review'
  | 'frozen-first-run'
  | 'accepted'
  | 'rejected'
  | 'converted-to-maintainer-regression';
export type Qualification = 'externally-authored' | 'maintainer-regression';
export type CredentialStatus = 'synthetic' | 'revoked' | 'live' | 'real-derived' | 'unknown';
export type RejectionReason =
  | 'real-credential-material'
  | 'scanner-derived-expectations'
  | 'no-redistribution-permission'
  | 'failed-safety-review'
  | 'incomplete-record'
  | 'other';

type Range = { start: number; end: number };

export interface IntakeFixture {
  id: string;
  path: string;
  content: string;
  action: 'must-redact' | 'must-not-flag';
  expected: Range[];
  threatCategories: string[];
  credentialStatus: CredentialStatus;
  rationale: string;
}

export interface MaintainerEdit { at: string; by: string; material: boolean; summary: string; fixtures: string[] }

export interface IntakeRecord {
  schemaVersion: 1;
  id: string;
  title: string;
  sample: boolean;
  status: IntakeStatus;
  qualification: Qualification;
  author: { attribution: string; attributionKind: string; affiliation: 'external' | 'project-maintainer' | 'project-contributor'; contact: string };
  implementationExposure: { inspectedDetectorImplementation: boolean; detail: string };
  provenance: { credentialStatus: CredentialStatus; construction: string };
  license: { spdx: string; redistribution: boolean; grant: string };
  threatCategories: string[];
  expectations: { authoring: string; scannerOutputConsulted: boolean; digest: string };
  fixtures: IntakeFixture[];
  submittedAt: string;
  safetyReview?: { reviewer: string; reviewedAt: string; outcome: 'passed' | 'failed'; notes: string };
  firstRun?: { path: 'first-run.json'; sha256: string };
  rejection?: { reason: RejectionReason; detail: string };
  history: { status: IntakeStatus; at: string; by: string }[];
  maintainerEdits: MaintainerEdit[];
}

export interface FirstRunRecord {
  schemaVersion: 1;
  packId: string;
  expectationsDigest: string;
  recordedAt: string;
  benchmarkCommit: string;
  scanners: { name: string; version: string; configuration: string; artifactDigest: string }[];
  results: { fixtureId: string; scanner: string; status: 'complete' | 'failed'; findings: Range[] }[];
}

/** Allowed lifecycle edges. `rejected` and `converted-to-maintainer-regression` are terminal. */
export const TRANSITIONS: Record<IntakeStatus, readonly IntakeStatus[]> = {
  submitted: ['safety-review', 'rejected'],
  'safety-review': ['frozen-first-run', 'rejected'],
  'frozen-first-run': ['accepted', 'rejected', 'converted-to-maintainer-regression'],
  accepted: ['converted-to-maintainer-regression'],
  rejected: [],
  'converted-to-maintainer-regression': [],
};

const AFTER_FIRST_RUN: readonly IntakeStatus[] = ['frozen-first-run', 'accepted', 'converted-to-maintainer-regression'];

const ajv = new Ajv({ strict: true, allErrors: true });
const validIntakeShape = ajv.compile(intakeSchema);
const validFirstRunShape = ajv.compile(firstRunSchema);

const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** JSON with object keys sorted at every depth, so a digest does not depend on key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The digest of everything a scanner result could be compared against: each
 * fixture's id, path, content, action and expected ranges. Committed in the
 * intake record at submission and copied into the first-run record.
 */
export function expectationsDigest(fixtures: readonly IntakeFixture[]): string {
  return sha256(canonicalJson(fixtures.map(({ id, path, content, action, expected }) => ({ id, path, content, action, expected }))));
}

export const fileDigest = (bytes: string | Uint8Array) => sha256(bytes);

/** `externally-authored` only for an externally affiliated author whose pack carries no material maintainer edit. */
export function derivedQualification(record: Pick<IntakeRecord, 'author' | 'maintainerEdits' | 'status'>): Qualification {
  if (record.author.affiliation !== 'external') return 'maintainer-regression';
  if (record.status === 'converted-to-maintainer-regression') return 'maintainer-regression';
  if (record.maintainerEdits.some(edit => edit.material)) return 'maintainer-regression';
  return 'externally-authored';
}

/** Grounds that force `rejected`, whatever status the record currently claims. */
export function rejectionGrounds(record: IntakeRecord): { reason: RejectionReason; detail: string }[] {
  const grounds: { reason: RejectionReason; detail: string }[] = [];
  const nonSynthetic = [
    ...(record.provenance.credentialStatus === 'synthetic' ? [] : [`pack provenance is ${record.provenance.credentialStatus}`]),
    ...record.fixtures.filter(f => f.credentialStatus !== 'synthetic').map(f => `fixture ${f.id} is ${f.credentialStatus}`),
  ];
  if (nonSynthetic.length) {
    grounds.push({
      reason: 'real-credential-material',
      detail: `only synthetic credential material is accepted; revoked, live, real-derived and unknown provenance are all rejected (${nonSynthetic.join('; ')})`,
    });
  }
  if (record.expectations.scannerOutputConsulted) {
    grounds.push({ reason: 'scanner-derived-expectations', detail: 'the author consulted scanner output while authoring expected ranges or actions' });
  }
  if (!record.license.redistribution) {
    grounds.push({ reason: 'no-redistribution-permission', detail: 'the license grant does not permit public redistribution' });
  }
  if (record.safetyReview?.outcome === 'failed') {
    grounds.push({ reason: 'failed-safety-review', detail: 'the safety review did not pass' });
  }
  return grounds;
}

function utf8Boundaries(content: string): { bytes: number; boundaries: Set<number> } {
  const boundaries = new Set<number>([0]);
  let offset = 0;
  for (const char of content) {
    offset += Buffer.byteLength(char, 'utf8');
    boundaries.add(offset);
  }
  return { bytes: offset, boundaries };
}

function rangeProblems(label: string, ranges: readonly Range[], content: string): string[] {
  const { bytes, boundaries } = utf8Boundaries(content);
  const problems: string[] = [];
  let previousEnd = -1;
  for (const [index, range] of ranges.entries()) {
    if (!(range.start < range.end) || range.end > bytes || !boundaries.has(range.start) || !boundaries.has(range.end)) {
      problems.push(`${label}[${index}] is not a non-empty UTF-8 byte range inside the fixture`);
    }
    if (range.start < previousEnd) problems.push(`${label}[${index}] overlaps or precedes the previous range`);
    previousEnd = range.end;
  }
  return problems;
}

function fixtureProblems(record: IntakeRecord): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  const used = new Set<string>();
  for (const fixture of record.fixtures) {
    if (ids.has(fixture.id)) problems.push(`fixture id ${fixture.id} is duplicated`);
    if (paths.has(fixture.path)) problems.push(`fixture ${fixture.id} reuses path ${fixture.path}`);
    ids.add(fixture.id);
    paths.add(fixture.path);
    if (fixture.action === 'must-not-flag' && fixture.expected.length) problems.push(`fixture ${fixture.id} is must-not-flag but expects ranges`);
    if (fixture.action === 'must-redact' && !fixture.expected.length) problems.push(`fixture ${fixture.id} is must-redact but expects no range`);
    problems.push(...rangeProblems(`fixture ${fixture.id} expected`, fixture.expected, fixture.content));
    for (const category of fixture.threatCategories) {
      used.add(category);
      if (!record.threatCategories.includes(category)) problems.push(`fixture ${fixture.id} covers ${category}, which the pack does not declare`);
    }
  }
  for (const category of record.threatCategories) {
    if (!used.has(category)) problems.push(`pack declares threat category ${category} but no fixture covers it`);
  }
  return problems;
}

function historyProblems(record: IntakeRecord): string[] {
  const problems: string[] = [];
  const [first] = record.history;
  if (first.status !== 'submitted' || first.at !== record.submittedAt) problems.push('history must start with submitted at submittedAt');
  for (let index = 1; index < record.history.length; index++) {
    const from = record.history[index - 1];
    const to = record.history[index];
    if (!TRANSITIONS[from.status].includes(to.status)) problems.push(`history transition ${from.status} -> ${to.status} is not allowed`);
    if (to.at < from.at) problems.push(`history entry ${index} (${to.status}) predates the entry before it`);
  }
  if (record.history.at(-1)!.status !== record.status) problems.push(`status ${record.status} does not match the last history entry`);
  return problems;
}

function firstRunProblems(record: IntakeRecord, firstRunBytes: string | null | undefined): string[] {
  if (!record.firstRun) return [];
  if (firstRunBytes == null) return [`first-run record ${record.firstRun.path} is missing`];
  const problems: string[] = [];
  if (fileDigest(firstRunBytes) !== record.firstRun.sha256) {
    problems.push('first-run.json does not match the SHA-256 pinned in the intake record; the first run is immutable, record later fixes separately');
  }
  let run: FirstRunRecord;
  try {
    run = JSON.parse(firstRunBytes);
  } catch {
    return [...problems, 'first-run.json is not valid JSON'];
  }
  if (!validFirstRunShape(run)) {
    return [...problems, ...(validFirstRunShape.errors ?? []).map(error => `first-run${error.instancePath || '/'} ${error.message}`)];
  }
  if (run.packId !== record.id) problems.push(`first-run packId ${run.packId} does not name this pack`);
  if (run.expectationsDigest !== record.expectations.digest) {
    problems.push('first-run expectationsDigest differs from the digest committed at submission; expectations must be frozen before any scanner runs');
  }
  if (run.recordedAt < record.submittedAt) problems.push('first run predates submission; expectations must be committed first');
  if (record.safetyReview && run.recordedAt < record.safetyReview.reviewedAt) problems.push('first run predates the safety review');
  const frozen = record.history.find(entry => entry.status === 'frozen-first-run');
  if (frozen && frozen.at < run.recordedAt) problems.push('frozen-first-run history entry predates the first run it freezes');

  const scanners = new Set<string>();
  for (const scanner of run.scanners) {
    if (scanners.has(scanner.name)) problems.push(`first-run scanner ${scanner.name} is listed twice`);
    scanners.add(scanner.name);
  }
  const unedited = !record.maintainerEdits.some(edit => edit.material);
  const fixtures = new Map(record.fixtures.map(fixture => [fixture.id, fixture]));
  const seen = new Set<string>();
  for (const result of run.results) {
    const key = `${result.fixtureId}\u0000${result.scanner}`;
    if (seen.has(key)) problems.push(`first-run result for ${result.fixtureId} × ${result.scanner} is duplicated`);
    seen.add(key);
    if (!scanners.has(result.scanner)) problems.push(`first-run result names unlisted scanner ${result.scanner}`);
    const fixture = fixtures.get(result.fixtureId);
    if (!fixture) {
      if (unedited) problems.push(`first-run result names unknown fixture ${result.fixtureId}`);
      continue;
    }
    if (result.status === 'failed' && result.findings.length) problems.push(`first-run result ${result.fixtureId} × ${result.scanner} failed but carries findings`);
    if (unedited) problems.push(...rangeProblems(`first-run ${result.fixtureId} × ${result.scanner} finding`, result.findings, fixture.content));
  }
  if (unedited) {
    for (const fixture of record.fixtures) {
      for (const scanner of scanners) {
        if (!seen.has(`${fixture.id}\u0000${scanner}`)) problems.push(`first run has no result for ${fixture.id} × ${scanner}`);
      }
    }
  }
  return problems;
}

/**
 * Every problem with one intake record and its first-run bytes, or `[]`.
 * `firstRunBytes` is the exact text of the pack's `first-run.json`, or null
 * when the pack has none.
 */
export function validateIntake(record: IntakeRecord, firstRunBytes?: string | null): string[] {
  if (!validIntakeShape(record)) {
    return (validIntakeShape.errors ?? []).map(error => `intake${error.instancePath || '/'} ${error.message}`);
  }
  const problems: string[] = [];
  const grounds = rejectionGrounds(record);

  if (record.status === 'rejected') {
    if (!record.rejection) problems.push('a rejected pack must record rejection.reason and rejection.detail');
    else if (grounds.length && !grounds.some(ground => ground.reason === record.rejection!.reason)) {
      problems.push(`rejection.reason ${record.rejection.reason} omits the ground that forced rejection (${grounds.map(g => g.reason).join(', ')})`);
    }
  } else {
    if (record.rejection) problems.push(`only a rejected pack may carry a rejection (status is ${record.status})`);
    for (const ground of grounds) problems.push(`must be rejected with reason ${ground.reason}: ${ground.detail}`);
  }

  if (AFTER_FIRST_RUN.includes(record.status)) {
    if (record.safetyReview?.outcome !== 'passed') problems.push(`status ${record.status} requires a passed safety review`);
    if (!record.firstRun) problems.push(`status ${record.status} requires the frozen first-run record`);
  } else if (record.firstRun && record.status !== 'rejected') {
    problems.push(`status ${record.status} cannot carry a first run; freeze it with frozen-first-run`);
  }
  if (record.status === 'submitted' && record.safetyReview) problems.push('a submitted pack has no safety review yet; move it to safety-review');

  const material = record.maintainerEdits.filter(edit => edit.material);
  if (record.status === 'converted-to-maintainer-regression' && !material.length) {
    problems.push('converted-to-maintainer-regression requires at least one material maintainer edit');
  }
  if (material.length && record.status !== 'converted-to-maintainer-regression' && record.status !== 'rejected') {
    problems.push(`a material maintainer edit removes the externally-authored qualification; status must become converted-to-maintainer-regression (is ${record.status})`);
  }
  for (const [index, edit] of record.maintainerEdits.entries()) {
    if (edit.at < record.submittedAt) problems.push(`maintainerEdits[${index}] predates submission`);
    if (edit.material && !edit.fixtures.length) problems.push(`maintainerEdits[${index}] is material but names no fixture`);
  }

  const expected = derivedQualification(record);
  if (record.qualification !== expected) problems.push(`qualification must be ${expected}, not ${record.qualification}`);

  if (expectationsDigest(record.fixtures) !== record.expectations.digest && !material.length) {
    problems.push('fixtures differ from the expectations digest committed at submission, and no material maintainer edit records the change');
  }

  problems.push(...fixtureProblems(record), ...historyProblems(record), ...firstRunProblems(record, firstRunBytes));
  return problems;
}

/**
 * A first run may be added, never rewritten. Given the pinned digest of each
 * pack's first run at a base revision (absent when the base had none), report
 * every pack whose first run changed or disappeared since.
 */
export function firstRunImmutabilityProblems(
  current: ReadonlyMap<string, string | undefined>,
  base: ReadonlyMap<string, string | undefined>,
): string[] {
  const problems: string[] = [];
  for (const [pack, digest] of base) {
    if (digest === undefined) continue;
    const now = current.get(pack);
    if (now === undefined) problems.push(`${pack}: frozen first run was removed; first runs are immutable`);
    else if (now !== digest) problems.push(`${pack}: frozen first run changed since the base revision; record later fixes separately`);
  }
  return problems;
}
