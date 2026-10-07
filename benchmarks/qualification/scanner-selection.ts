/**
 * The effective scanner selection of an official run (#812): ONE policy shared by the workflow dispatch, the direct driver invocation, the execution plan, the
 * candidate/attribution/retry paths and the replay scripts.
 *
 * The roster (benchmarks/support/scanner-roster.json, #763) says which scanners the official run class must measure and which it may leave unmeasured. This module
 * turns that into what a run actually executes:
 *
 *  - DEFAULT (no input at all): every OPTIONAL scanner the pinned full configuration would run is omitted, and the run uses the engine's released
 *    without-optional configuration (credential-eval `configs/official/*.without-openredaction*.json`). Zero optional-scanner executions.
 *  - EXPLICIT OPT-IN (`include_openredaction` / `--include-optional openredaction`): the optional scanner is measured under the engine's full configuration. The run
 *    record names it (`scannerSelection.includedOptionalScanners`) with the configuration file and hash, so the result carries its own identity.
 *  - `omit_optional` / `--omit-optional` still work and are DEPRECATED: omitting is the default, so the input is accepted and changes nothing.
 *
 * Availability is derived from the pinned engine's checkout (does it ship the configuration?), never from a claim about a release. A pinned engine without the
 * configuration is refused plainly: the default never falls back to the full configuration, because that would run the expensive scanner by accident. A retry or a
 * missing artifact never changes the selection: a receipt of another scanner set or configuration is rejected (receipt-reuse.ts) and the stage measures under THIS
 * selection. Pure: no file or process access, so the policy is tested with bounded fixtures.
 */
import { rosterFor, type ScannerRoster } from './scanner-roster.ts';

export const SCANNER_SELECTION_SCHEMA = 'redact-secret-benchmarks/scanner-selection/v1';

export interface SelectionRequest {
  roster: ScannerRoster;
  /** The scanners the pinned full configuration runs (the registry's scanner list). */
  registryScannerIds: string[];
  platform: string;
  /** Positive opt-in: optional scanners to measure. */
  includeOptional?: string[];
  /** Deprecated explicit omission (#763): the default already omits. */
  omitOptional?: string[];
  /** The full configuration file for the platform (the registry's, or an attribution run's own). */
  fullConfig: string | undefined;
  /** An attribution run's own without-optional configurations by platform; absent for the accepted run and a candidate replay (the roster's apply). */
  withoutConfigs?: Record<string, string>;
  /** What this selection is for, in refusal messages: 'attribution core-beta.12'. */
  subject?: string;
  /** Does the pinned engine's checkout ship this `configs/official` file? */
  engineHasConfig: (file: string) => boolean;
  engineTag: string;
}

export interface ScannerSelection {
  schema: typeof SCANNER_SELECTION_SCHEMA;
  runClass: 'official';
  policy: 'default-omit-optional' | 'explicit-include-optional';
  /** The scanners the run measures, in the registry's order. */
  scanners: string[];
  required: string[];
  includedOptionalScanners: string[];
  omittedOptionalScanners: string[];
  /** Why each omitted scanner is omitted: the default, or the deprecated explicit input (which says the same). */
  omission: Record<string, 'default' | 'omit-optional-input'>;
  configFile: string;
  configKind: 'without-optional' | 'full';
  engineTag: string;
  platform: string;
  /** Notices the caller prints (deprecations). */
  notices: string[];
}

export function selectScanners(req: SelectionRequest): { selection: ScannerSelection | null; problems: string[] } {
  const problems: string[] = [];
  const notices: string[] = [];
  const entry = rosterFor(req.roster, 'official');
  const optional = new Set(entry.optional);
  const include = [...new Set(req.includeOptional ?? [])];
  const omit = [...new Set(req.omitOptional ?? [])];
  const subject = req.subject ?? 'the accepted official run';

  for (const id of include) {
    if (!optional.has(id)) problems.push(`--include-optional ${id}: not an optional scanner of the official run class (benchmarks/support/scanner-roster.json); a required scanner is always measured`);
    else if (!req.registryScannerIds.includes(id)) problems.push(`--include-optional ${id}: it is in no official configuration, so there is nothing to include (#764: the credential profile is measured only by its own profile-only run, pending the owner's approval)`);
  }
  for (const id of omit) {
    if (!optional.has(id)) problems.push(`--omit-optional ${id}: not an optional scanner of the official run class (benchmarks/support/scanner-roster.json); a required scanner cannot be omitted`);
    else if (!Object.keys(req.roster.optionalScanners[id].withoutConfigs).length) problems.push(`--omit-optional ${id}: it is in no official configuration, so there is nothing to leave out (#764: the credential profile is measured only by its own profile-only run, pending the owner's approval)`);
  }
  for (const id of include) if (omit.includes(id)) problems.push(`${id} is both included (include_openredaction / --include-optional) and omitted (omit_optional / --omit-optional): name one`);
  if (problems.length) return { selection: null, problems };

  // The optional scanners the full pinned configuration would run: the ones whose execution this policy decides.
  const decided = entry.optional.filter(id => req.registryScannerIds.includes(id));
  const included = decided.filter(id => include.includes(id));
  const omitted = decided.filter(id => !include.includes(id));
  const omission: ScannerSelection['omission'] = Object.fromEntries(omitted.map(id => [id, omit.includes(id) ? 'omit-optional-input' as const : 'default' as const]));
  for (const id of omit) notices.push(`--omit-optional ${id} is DEPRECATED (#812): omitting ${id} is the default, so it is accepted and changes nothing; use include_openredaction / --include-optional ${id} to measure it.`);

  let configFile: string | undefined;
  let configKind: ScannerSelection['configKind'];
  if (!omitted.length) {
    configKind = 'full';
    configFile = req.fullConfig;
    if (!configFile) problems.push(`no run configuration pinned for platform ${req.platform}`);
  } else if (omitted.length > 1) {
    configKind = 'without-optional';
    problems.push(`no engine configuration leaves out ${omitted.join(' and ')} together; name at most one omitted optional scanner (include the others explicitly)`);
  } else {
    configKind = 'without-optional';
    const id = omitted[0];
    configFile = req.withoutConfigs ? req.withoutConfigs[req.platform] : req.roster.optionalScanners[id].withoutConfigs[req.platform];
    if (!configFile) problems.push(req.withoutConfigs
      ? `${subject} pins no configuration without ${id} for platform ${req.platform}: the default measures the required scanners only and never falls back to the full configuration. Make the full-roster ${subject} explicitly (include_openredaction), or add the engine's without-${id} configuration to the registry entry`
      : `the scanner roster names no run configuration without ${id} for platform ${req.platform}`);
    else if (!req.engineHasConfig(configFile)) problems.push(`the pinned engine ${req.engineTag} has no configuration ${configFile}: the default run of ${subject} measures the required scanners only and needs an engine that ships it (it is never measured with ${id} by accident, and the pin moves only by the owner's repin). To measure ${id} on purpose use include_openredaction / --include-optional ${id}`);
  }
  if (problems.length || !configFile) return { selection: null, problems };

  return {
    problems,
    selection: {
      schema: SCANNER_SELECTION_SCHEMA, runClass: 'official',
      policy: included.length ? 'explicit-include-optional' : 'default-omit-optional',
      scanners: req.registryScannerIds.filter(id => !omitted.includes(id)),
      required: entry.required.filter(id => req.registryScannerIds.includes(id)),
      includedOptionalScanners: included, omittedOptionalScanners: omitted, omission,
      configFile, configKind, engineTag: req.engineTag, platform: req.platform, notices,
    },
  };
}

export interface SelectionContext {
  roster: ScannerRoster;
  population?: string;
  stage?: 'plain' | 'methods';
  /** Engine runs the stage makes (the determinism check repeats). */
  runs: number;
  /** The configuration hash, when known (after the run). */
  configHash?: string;
}

/** What the record, the dry-run and the job summary say about the selection, in data. The invocation counts are derived from the selection, not asserted. */
export function describeSelection(selection: ScannerSelection, ctx: SelectionContext) {
  const decided = [...selection.includedOptionalScanners, ...selection.omittedOptionalScanners].sort();
  const perScanner = (id: string) => {
    const spec = ctx.roster.optionalScanners[id];
    const included = selection.includedOptionalScanners.includes(id);
    return { scanner: id, label: spec.label, state: included ? 'included' as const : 'omitted' as const, basis: included ? 'explicit opt-in' : 'optional, omitted by default', scannerRuns: included ? ctx.runs : 0 };
  };
  return {
    schema: SCANNER_SELECTION_SCHEMA,
    policy: selection.policy,
    population: ctx.population ?? null, stage: ctx.stage ?? 'plain', platform: selection.platform, engine: selection.engineTag,
    configuration: { file: selection.configFile, kind: selection.configKind, ...(ctx.configHash ? { hash: ctx.configHash } : {}) },
    scanners: selection.scanners,
    required: selection.required,
    optional: decided.map(perScanner),
    engineRunsPerScanner: ctx.runs,
    scannerRuns: selection.scanners.length * ctx.runs,
    // The invocation count the issue asks for, by scanner id: every optional scanner the policy decides, 0 when omitted.
    optionalScannerRuns: Object.fromEntries(decided.map(id => [id, perScanner(id).scannerRuns])),
  };
}

export function renderSelection(selection: ScannerSelection, ctx: SelectionContext): string {
  const d = describeSelection(selection, ctx);
  const lines = [`### Scanner selection${ctx.population ? ` (${ctx.population}${d.stage === 'methods' ? ', methods' : ''})` : ''}`, '',
    `Policy: ${selection.policy === 'default-omit-optional' ? 'default (the required scanners; optional scanners are omitted)' : 'EXPLICIT opt-in (an optional scanner is measured on purpose)'}. Configuration: \`${d.configuration.file}\` (${d.configuration.kind === 'full' ? 'the engine\'s full configuration' : 'without the optional scanner'}) on ${d.engine}, ${d.platform}${d.configuration.hash ? `, hash ${d.configuration.hash}` : ''}.`,
    `Measured (${d.scanners.length}): ${d.scanners.join(', ')}. Required: ${d.required.join(', ')}.`];
  for (const o of d.optional) {
    if (o.state === 'omitted') lines.push(`- ${o.label}: OMITTED (${o.basis}); not measured in this run. ${o.scanner} scan invocations: 0 (of ${d.engineRunsPerScanner} engine run(s)). The view states it was not measured and points at its last measurement.`);
    else lines.push(`- ${o.label}: INCLUDED by ${o.basis} (include_openredaction). ${o.scanner} scan invocations: ${o.scannerRuns} (${d.engineRunsPerScanner} engine run(s)). Its result carries this selection and configuration in its run record; a retry never turns it on or off.`);
  }
  for (const n of selection.notices) lines.push(`- Notice: ${n}`);
  return `${lines.join('\n')}\n`;
}

/** The part of the selection a run record keeps: identity, never a result. */
export const selectionRecord = (selection: ScannerSelection, configHash?: string) => ({
  schema: SCANNER_SELECTION_SCHEMA, policy: selection.policy, configFile: selection.configFile, configKind: selection.configKind,
  ...(configHash ? { configHash } : {}),
  scanners: selection.scanners, includedOptionalScanners: selection.includedOptionalScanners, omittedOptionalScanners: selection.omittedOptionalScanners,
});
