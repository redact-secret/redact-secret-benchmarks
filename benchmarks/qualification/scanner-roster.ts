/**
 * The scanner roster of the evaluation contract (#763): which scanners a run class MUST measure and which it MAY leave unmeasured.
 *
 * An OPTIONAL scanner is an explicit, manual measurement. A run that does not include it is still complete: the view says what was not measured, why, and
 * which earlier run holds its last measurement. It never invents a zero detection, never drops the scanner silently, and never changes the status of another
 * scanner or of the ledger. A REQUIRED scanner that is absent or not complete refuses the view, exactly as before. A scanner that is measured in some
 * populations of a view and not in others is refused: an optional scanner is in the whole view or in none of it, never a partial splice.
 *
 * The roster is read from benchmarks/support/scanner-roster.json. That file is deliberately not a component of the product policy revision (it names who is
 * measured, not what a status requires), so the roster moves no support status and not the revision. Spec: docs/specs/qualification-adapter.md,
 * "The scanner roster"; decision: docs/decisions/2026-10-06-make-the-openredaction-default-profile-an-optional-manual-measurement.md.
 */
import { readFileSync } from 'node:fs';

export const SCANNER_ROSTER_SCHEMA = 1;

export interface RosterEntry { required: string[]; optional: string[] }
export interface OptionalScanner {
  /** What the scanner is, in the words of the view: "OpenRedaction default". */
  label: string;
  /** The profile the entry stands for. The default profile is never spliced with another profile (#724). */
  profile: string;
  /** Why the measurement is optional, stated beside the absence. */
  reason: string;
  /** Per platform, the official run configuration (credential-eval `configs/official/`) of a run that leaves the scanner out. `engineRelease` is the first credential-eval release that ships them (informational, verified against the release's `configs/official/`, or 'pending'); it is NOT how a run decides: the driver asks the PINNED engine's checkout whether the file exists (scanner-selection.ts), so a repin that moves to an engine without them is refused, never assumed. Empty for a profile that is in no official configuration (nothing to leave out). */
  withoutConfigs: Record<string, string>;
  engineRelease: 'pending' | string;
  /** What the profile detects, in the words of the page (#764). */
  detects?: string;
  /** The scanner this entry is a profile of: both are the same package under different configurations, never one history. */
  profileOf?: string;
  /** The configuration-effect disclosure shown beside a profile: results differ by configuration, no accuracy claim. */
  disclosure?: string;
  /** Replaces the contract sentence for a scanner that has never had an official measurement (#764). */
  statement?: string;
  /** The identity of the profile: adapter, package, pattern count, scanner configuration hash and the run configuration with its hash. Facts about the configuration, never a result. */
  identity?: { adapter: { id: string; version: string }; package: string; patterns?: number; scannerConfigurationHash: string; runConfig?: string; runConfigHash?: string };
  /** The decision record of the entry. */
  decision?: string;
  /** What stands between the entry and its official measurement, when there is no recorded one. */
  officialMeasurement?: string;
  /** Earlier official measurements that `official-runs.json` no longer lists, newest last (#763). The registry's `runs[]` and `historicalRuns[]` win when they hold one. */
  retainedMeasurements?: RetainedMeasurement[];
}
/**
 * One earlier official measurement of an optional scanner that the run registry no longer lists (#763). A repin moves its runs out of `runs[]` and may not
 * keep them as `historicalRuns[]`; without this record the view would say "no earlier measurement is recorded" about a scanner that has one. Every field is a
 * fact about a retained run (identity, digests, where its artifacts are archived), never a result: the pointer shows no count and no outcome.
 */
export interface RetainedMeasurement {
  recordedOn: string;
  engine: { version: string; revision: string };
  /** Why the registry does not list the runs, and where they are. */
  note?: string;
  /** The immutable release asset that holds the runs' artifacts, and the CI run that made them. */
  archive: { release: string; asset: string; ciRun: string };
  /** Whether the runs carry native labels / scope accounting: `unavailable` is a legacy engine (counts are Unknown on a page, never zero). */
  nativeLabels?: 'unavailable' | 'available';
  runs: { id: string; configHash: string; semanticDigest: string; byteDigest: string; scannerVersion: string | null; scannerConfigurationHash: string | null }[];
}
export interface ScannerRoster {
  schemaVersion: number;
  id: string;
  runClasses: Record<string, RosterEntry & { populations?: Record<string, RosterEntry> }>;
  optionalScanners: Record<string, OptionalScanner>;
}

/** The pointer to an earlier measurement of a scanner: what the registry recorded, never recomputed. */
export interface LastMeasurement {
  recordedOn: string;
  engine: { version: string; revision: string };
  /** Where the pointer was read: the active runs, the superseded receipts, or the roster's own record of a retained run (#763). */
  registry: 'runs' | 'historicalRuns' | 'retained';
  runs: { id: string; configHash: string; scannerVersion: string | null; scannerConfigurationHash: string | null }[];
  /** For a retained measurement: the immutable archive release that holds the artifacts, and whether the runs carry native labels. */
  archive?: { release: string; asset: string; ciRun: string };
  nativeLabels?: 'unavailable' | 'available';
}

interface HistoryRecord {
  id: string; recordedOn: string; configHash: string;
  engine: { version: string; revision: string };
  scanners: { id: string; version?: string | null; configurationHash?: string | null }[];
}
export interface MeasurementHistory { runs?: HistoryRecord[]; historicalRuns?: HistoryRecord[] }

export interface RosterView {
  id: string;
  runClass: string;
  required: string[];
  optional: string[];
  measured: string[];
  notMeasured: {
    scanner: string; profile: string; optional: true; label: string;
    statement: string; reason: string;
    /** Null when no recorded run measured it: the view then says so rather than point at nothing. */
    lastMeasurement: LastMeasurement | null;
    officialMeasurement?: string; decision?: string;
  }[];
  /** Every optional scanner of the roster, measured or not, with what it detects and which scanner it is a profile of (#764): the pages label the profiles separately. */
  profiles: { scanner: string; label: string; profile: string; measured: boolean; detects?: string; profileOf?: string; disclosure?: string; identity?: OptionalScanner['identity']; decision?: string }[];
}

export const readScannerRoster = (url = new URL('../support/scanner-roster.json', import.meta.url)): ScannerRoster => validateRoster(JSON.parse(readFileSync(url, 'utf8')));

const unique = (xs: string[]) => new Set(xs).size === xs.length;

export function validateRoster(roster: ScannerRoster): ScannerRoster {
  const problems: string[] = [];
  if (roster?.schemaVersion !== SCANNER_ROSTER_SCHEMA || !roster.id || typeof roster.runClasses !== 'object' || typeof roster.optionalScanners !== 'object') throw new Error('Invalid scanner roster');
  const entries: [string, RosterEntry][] = [];
  for (const [cls, e] of Object.entries(roster.runClasses)) {
    entries.push([cls, e]);
    for (const [pop, p] of Object.entries(e.populations ?? {})) entries.push([`${cls}/${pop}`, p]);
  }
  for (const [where, e] of entries) {
    if (!Array.isArray(e.required) || !Array.isArray(e.optional) || !e.required.length) problems.push(`${where}: needs a non-empty required list and an optional list`);
    else {
      if (!unique([...e.required, ...e.optional])) problems.push(`${where}: a scanner is listed twice (required and optional are disjoint)`);
      for (const id of e.optional) if (!roster.optionalScanners[id]) problems.push(`${where}: optional scanner ${id} has no entry in optionalScanners (label, reason, profile)`);
    }
  }
  // A profile is its own scanner and its own history: labels and profiles are distinct, and a profile names a scanner of the roster it is a profile of (#764).
  const specs = Object.entries(roster.optionalScanners);
  const SHA = /^sha256:[0-9a-f]{64}$/;
  for (const [id, o] of specs) {
    (o.retainedMeasurements ?? []).forEach((m, i) => {
      const at = `optionalScanners.${id}.retainedMeasurements[${i}]`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.recordedOn ?? '') || !m.engine?.version || !m.engine?.revision) problems.push(`${at}: needs recordedOn (YYYY-MM-DD) and the engine version and revision`);
      if (!m.archive?.release || !m.archive?.asset || !/^\d+$/.test(m.archive?.ciRun ?? '')) problems.push(`${at}: needs the archive release, asset and CI run that hold the artifacts`);
      if (!Array.isArray(m.runs) || m.runs.length === 0) problems.push(`${at}: names no run`);
      for (const r of m.runs ?? []) if (!r.id || !SHA.test(r.configHash ?? '') || !SHA.test(r.semanticDigest ?? '') || !SHA.test(r.byteDigest ?? '')) problems.push(`${at}: run ${r.id ?? '?'} needs an id and sha256 config, semantic and byte digests`);
    });
  }
  if (!unique(specs.map(([, o]) => o.label))) problems.push('optionalScanners: two entries share a label; a profile is labelled separately from the default');
  if (!unique(specs.map(([id, o]) => `${o.profileOf ?? id}/${o.profile}`))) problems.push('optionalScanners: two entries are the same profile of the same scanner');
  for (const [id, o] of specs) if (o.profileOf !== undefined && (o.profileOf === id || !roster.optionalScanners[o.profileOf])) problems.push(`optionalScanners.${id}: profileOf ${o.profileOf} is not another optional scanner`);
  if (problems.length) throw new Error(`Invalid scanner roster: ${problems.join('; ')}`);
  return roster;
}

/** The roster of one run class, with the population's own entry when the roster gives one. */
export function rosterFor(roster: ScannerRoster, runClass: string, population?: string): RosterEntry {
  const cls = roster.runClasses[runClass];
  if (!cls) throw new Error(`The scanner roster has no run class ${runClass}`);
  return (population && cls.populations?.[population]) || { required: cls.required, optional: cls.optional };
}

/** The statement of the view: what was not measured, in one sentence the pages show verbatim. */
export const notMeasuredStatement = (label: string) => `${label}: not measured in this run (optional)`;

/** The latest recorded measurement of a scanner: the newest `recordedOn` among the active runs, else among the historical ones. Null when none recorded it. */
export function lastMeasurementOf(scanner: string, history: MeasurementHistory, retained: RetainedMeasurement[] = []): LastMeasurement | null {
  for (const registry of ['runs', 'historicalRuns'] as const) {
    const hits = (history[registry] ?? []).filter(r => r.scanners.some(s => s.id === scanner));
    if (!hits.length) continue;
    const latest = hits.map(r => r.recordedOn).sort().at(-1)!;
    const same = hits.filter(r => r.recordedOn === latest).sort((a, b) => (a.id < b.id ? -1 : 1));
    return {
      recordedOn: latest, engine: { version: same[0].engine.version, revision: same[0].engine.revision }, registry,
      runs: same.map(r => { const s = r.scanners.find(x => x.id === scanner)!; return { id: r.id, configHash: r.configHash, scannerVersion: s.version ?? null, scannerConfigurationHash: s.configurationHash ?? null }; }),
    };
  }
  // The registry holds none (a repin drops superseded runs): the roster's own record of a retained measurement, never a guess.
  const kept = [...retained].sort((a, b) => (a.recordedOn < b.recordedOn ? -1 : a.recordedOn > b.recordedOn ? 1 : 0)).at(-1);
  if (kept) {
    return {
      recordedOn: kept.recordedOn, engine: { version: kept.engine.version, revision: kept.engine.revision }, registry: 'retained',
      runs: [...kept.runs].sort((a, b) => (a.id < b.id ? -1 : 1)).map(r => ({ id: r.id, configHash: r.configHash, scannerVersion: r.scannerVersion ?? null, scannerConfigurationHash: r.scannerConfigurationHash ?? null })),
      archive: { ...kept.archive }, ...(kept.nativeLabels ? { nativeLabels: kept.nativeLabels } : {}),
    };
  }
  return null;
}

export interface PopulationScanners { population: string; scanners: { id: string; status: string }[] }

/**
 * Judge the scanners each population's artifact carries against the roster. Returns the problems that refuse the view and, when there are none, the roster
 * section of the view. A required scanner missing or not complete, or an optional scanner measured in some populations only, is a problem; an optional scanner
 * in none is reported as not measured, with the pointer to its last measurement.
 */
export function assessRoster({ roster, runClass, populations, history = {} }: { roster: ScannerRoster; runClass: string; populations: PopulationScanners[]; history?: MeasurementHistory }):
  { problems: string[]; view: RosterView | null } {
  const problems: string[] = [];
  const required = new Set<string>(), optional = new Set<string>();
  for (const p of populations) {
    const entry = rosterFor(roster, runClass, p.population);
    entry.required.forEach(id => required.add(id)); entry.optional.forEach(id => optional.add(id));
    const present = new Map(p.scanners.map(s => [s.id, s.status]));
    for (const id of entry.required) {
      if (!present.has(id)) problems.push(`population ${p.population}: required scanner ${id} is absent from the artifact; a run is complete without an optional scanner only`);
      else if (present.get(id) !== 'complete') problems.push(`population ${p.population}: required scanner ${id} is ${present.get(id)}`);
    }
  }
  const measured = new Set(populations.flatMap(p => p.scanners.map(s => s.id)));
  const notMeasured: RosterView['notMeasured'] = [];
  for (const id of [...optional].sort()) {
    const where = populations.filter(p => p.scanners.some(s => s.id === id)).map(p => p.population);
    if (where.length && where.length < populations.length)
      problems.push(`optional scanner ${id} is measured in ${where.join(', ')} only: an optional scanner is measured in every population of a view or in none, never a partial splice`);
    if (where.length) continue;
    const spec = roster.optionalScanners[id];
    notMeasured.push({
      scanner: id, profile: spec.profile, optional: true, label: spec.label, statement: spec.statement ?? notMeasuredStatement(spec.label), reason: spec.reason,
      lastMeasurement: lastMeasurementOf(id, history, spec.retainedMeasurements),
      ...(spec.officialMeasurement ? { officialMeasurement: spec.officialMeasurement } : {}), ...(spec.decision ? { decision: spec.decision } : {}),
    });
  }
  const profiles: RosterView['profiles'] = [...optional].sort().map(id => {
    const spec = roster.optionalScanners[id];
    return { scanner: id, label: spec.label, profile: spec.profile, measured: measured.has(id),
      ...(spec.detects ? { detects: spec.detects } : {}), ...(spec.profileOf ? { profileOf: spec.profileOf } : {}), ...(spec.disclosure ? { disclosure: spec.disclosure } : {}),
      ...(spec.identity ? { identity: spec.identity } : {}), ...(spec.decision ? { decision: spec.decision } : {}) };
  });
  if (problems.length) return { problems, view: null };
  return {
    problems,
    view: { id: roster.id, runClass, required: [...required].sort(), optional: [...optional].sort(), measured: [...measured].sort(), notMeasured, profiles },
  };
}
