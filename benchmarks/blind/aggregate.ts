import Ajv from 'ajv';
import schema from '../../schemas/blind-aggregate-v1.json';
import { OUTCOMES, isLeaked, scoreRow } from '../lib/lattice.ts';
import { BlindError } from './storage.ts';
import type { BlindAggregate, PrivateFixture, Rate, WithheldReason } from './types.ts';

/** Strata with fewer fixtures than this are never released on their own. */
export const MINIMUM_STRATUM_FIXTURES = 5;
const Z = 1.959963984540054;
const round = (x: number) => Math.round(x * 10_000) / 10_000;

/** Wilson score interval at 95%: well-behaved at 0 and n for the small counts a blind corpus has. */
export function wilson(count: number, of: number): Rate {
  if (!of) return { count, of, value: null, interval: null };
  const p = count / of, denominator = 1 + Z * Z / of;
  const centre = (p + Z * Z / (2 * of)) / denominator;
  const half = Z * Math.sqrt(p * (1 - p) / of + Z * Z / (4 * of * of)) / denominator;
  return { count, of, value: round(p), interval: [round(Math.max(0, centre - half)), round(Math.min(1, centre + half))] };
}

/** One fixture's in-memory observation. It never leaves process memory. */
export type Observation =
  | { fixture: PrivateFixture; status: 'measured'; findings: { start: number; end: number }[] }
  | { fixture: PrivateFixture; status: 'withheld'; reason: WithheldReason };

interface Tally { fixtures: number; spans: number; leakedSpans: number; controls: number; flaggedControls: number }
const tally = (): Tally => ({ fixtures: 0, spans: 0, leakedSpans: 0, controls: 0, flaggedControls: 0 });

/** Reduce observations to counts. Only counts survive; no row, range or label beyond a stratum name. */
export function summarize(observations: Observation[]) {
  const withheldReasons: Record<WithheldReason, number> = { 'unstable-across-replays': 0, 'scan-error': 0 };
  const outcomes = Object.fromEntries(OUTCOMES.map(o => [o, 0])) as BlindAggregate['leakage']['outcomes'];
  const total = tally(), strata = new Map<string, Tally>();
  let measurable = 0, positives = 0;
  for (const o of observations) {
    if (o.status === 'withheld') { withheldReasons[o.reason]++; continue; }
    measurable++;
    const s = o.fixture.stratum ? (strata.get(o.fixture.stratum) ?? strata.set(o.fixture.stratum, tally()).get(o.fixture.stratum)!) : undefined;
    const add = (key: keyof Tally, n = 1) => { total[key] += n; if (s) s[key] += n; };
    add('fixtures');
    const score = scoreRow(o.fixture.expected.map(e => ({ ...e, role: 'secret' as const })), o.findings);
    if (o.fixture.kind === 'must-not-flag') {
      add('controls');
      if (score.flagged) add('flaggedControls');
      continue;
    }
    positives++;
    for (const outcome of score.spanOutcomes!) {
      outcomes[outcome as keyof typeof outcomes]++;
      add('spans');
      if (isLeaked(outcome)) add('leakedSpans');
    }
  }
  // Disclosure control: small strata are suppressed. If what is suppressed is
  // itself small, every stratum is withheld, so no small stratum can be
  // recovered by subtracting the released ones from the totals.
  const released = [...strata.entries()].filter(([, t]) => t.fixtures >= MINIMUM_STRATUM_FIXTURES);
  const suppressedFixtures = total.fixtures - released.reduce((n, [, t]) => n + t.fixtures, 0);
  const strataStatus: BlindAggregate['strata']['status'] = !strata.size ? 'none'
    : suppressedFixtures > 0 && suppressedFixtures < MINIMUM_STRATUM_FIXTURES ? 'suppressed' : 'released';
  const rows = strataStatus === 'released'
    ? released.sort(([a], [b]) => a.localeCompare(b)).map(([label, t]) => ({ label, ...t })) : [];
  return {
    measurability: { fixtures: observations.length, measurable, share: observations.length ? round(measurable / observations.length) : null,
      withheld: observations.length - measurable, withheldReasons },
    instability: wilson(withheldReasons['unstable-across-replays'], observations.length),
    leakage: { fixtures: positives, spans: total.spans, leakedSpans: wilson(total.leakedSpans, total.spans), outcomes },
    falseAlarms: { controls: total.controls, flaggedControls: wilson(total.flaggedControls, total.controls) },
    strata: { status: strataStatus, minimumFixtures: MINIMUM_STRATUM_FIXTURES, rows },
  };
}

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

/** Schema whitelist (no extra field anywhere) plus internal arithmetic consistency. */
export function validateAggregate(report: unknown): BlindAggregate {
  if (!validate(report)) throw new BlindError(`aggregate-schema-violation:${(validate.errors ?? []).map(e => `${e.instancePath || '/'}:${e.keyword}`).join(',')}`);
  const r = report as unknown as BlindAggregate;
  const withheld = Object.values(r.measurability.withheldReasons).reduce((a, b) => a + b, 0);
  if (r.measurability.measurable + r.measurability.withheld !== r.measurability.fixtures || withheld !== r.measurability.withheld ||
      r.corpus.fixtures !== r.measurability.fixtures ||
      Object.values(r.leakage.outcomes).reduce((a, b) => a + b, 0) !== r.leakage.spans || r.leakage.leakedSpans.of !== r.leakage.spans ||
      r.leakage.outcomes.PARTIAL + r.leakage.outcomes.MISS !== r.leakage.leakedSpans.count ||
      r.falseAlarms.flaggedControls.of !== r.falseAlarms.controls || r.leakage.fixtures + r.falseAlarms.controls !== r.measurability.measurable ||
      r.strata.rows.some(row => row.fixtures < r.strata.minimumFixtures) || (r.strata.status !== 'released' && r.strata.rows.length) ||
      Date.parse(r.finishedAt) < Date.parse(r.startedAt))
    throw new BlindError('aggregate-inconsistent');
  return r;
}

function* constants(node: unknown): Generator<string> {
  if (Array.isArray(node)) for (const v of node) yield* constants(v);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
    if (k === 'const' && typeof v === 'string') yield v;
    else if (k === 'enum' && Array.isArray(v)) yield* v.filter((x): x is string => typeof x === 'string');
    else yield* constants(v);
  }
}
/** Strings the schema itself fixes: they cannot carry custodian data. */
const SCHEMA_CONSTANTS = [...constants(schema)];

function* strings(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const v of value) yield* strings(v);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) yield* strings(v);
}

/**
 * Defence in depth behind the schema: no string in the aggregate may equal a
 * fixture id or path, or contain a credential-shaped content token (8+
 * characters with a digit, capital or underscore). Stratum labels and the
 * fixed wording the runner itself writes are exempt. Keys are fixed by the
 * schema and never carry data.
 */
export function assertNoPrivateDetail(report: BlindAggregate, fixtures: PrivateFixture[], fixed: string[] = []) {
  const identities = new Set(fixtures.flatMap(f => [f.id, f.path]));
  const tokens = new Set(fixtures.flatMap(f => f.content.split(/[\s"'`=:,;(){}[\]<>]+/).filter(t => t.length >= 8 && /[0-9A-Z_]/.test(t))));
  const exempt = new Set([...report.strata.rows.map(r => r.label), ...SCHEMA_CONSTANTS, ...fixed]);
  for (const s of strings(report)) {
    if (exempt.has(s)) continue;
    if (identities.has(s)) throw new BlindError('aggregate-contains-fixture-identity');
    for (const token of tokens) if (s.includes(token)) throw new BlindError('aggregate-contains-fixture-content');
  }
}
