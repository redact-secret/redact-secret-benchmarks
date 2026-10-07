/**
 * The scripts' side of the scanner-selection policy (#812). The policy is benchmarks/qualification/scanner-selection.ts (the driver and the execution plan);
 * the dispatching and provisioning scripts are plain Node and cannot import TypeScript, so what they need is here: the same roster file, pure, no process or
 * network access, so the tests run it on bounded fixtures.
 *
 * With no input a full run measures the REQUIRED scanners only; an OPTIONAL scanner of the roster is measured on the explicit opt-in (include_openredaction).
 */

const optionalOf = roster => new Set(roster.runClasses.official.optional);

/** The scanner ids a full official run would measure: the registry's scanners, without the optional ones unless they are opted in. */
export function effectiveScannerIds(registryScanners, roster, include = []) {
  const optional = optionalOf(roster);
  return registryScanners.map(s => s.id).filter(id => !optional.has(id) || include.includes(id));
}

/** The executables to provision: an optional scanner's executable only on the explicit opt-in, so a default run never downloads a scanner it will not execute. */
export function provisionedExecutables(registryScanners, roster, include = []) {
  const ids = new Set(effectiveScannerIds(registryScanners, roster, include));
  return registryScanners.filter(s => s.kind === 'executable' && ids.has(s.id));
}

/** The scanner ids a recorded control replay measured (the keys of its recorded runs' case counts), or null when the record does not say or its runs disagree. */
export function controlScannerIds(replay) {
  const runs = replay?.recordedRuns ?? [];
  if (!runs.length || runs.some(r => !r.caseCounts || !Object.keys(r.caseCounts).length)) return null;
  const sets = runs.map(r => Object.keys(r.caseCounts).sort().join(','));
  return sets.every(s => s === sets[0]) ? sets[0].split(',') : null;
}

/**
 * A candidate (or attribution) run and its control must measure ONE scanner roster: the comparison is about the product build only. Returns the problems, with
 * what to do. It never splices an old observation in and never turns an optional scanner on to match.
 */
export function controlRosterProblems({ control, selected, roster, controlLabel = 'the control replay' }) {
  if (!control) return [`${controlLabel} records no scanner set (recordedRuns[].caseCounts), so its roster cannot be compared with this run's (${selected.join(', ')}); record the control again with scripts/run-evidence-replay.mjs`];
  if ([...control].sort().join(',') === [...selected].sort().join(',')) return [];
  const optional = optionalOf(roster);
  const onlyControl = control.filter(id => !selected.includes(id) && optional.has(id));
  const onlyRun = selected.filter(id => !control.includes(id) && optional.has(id));
  const head = `${controlLabel} measured ${control.join(', ')}; this run would measure ${selected.join(', ')}: incompatible scanner rosters, so the comparison is refused and no observation of one is spliced into the other.`;
  if (onlyControl.length) return [`${head} The control measured the optional scanner ${onlyControl.join(', ')} (an explicit opt-in). Either dispatch this run with include_openredaction (--include-openredaction) to match it, which is expensive and explicit, or create the default control (scripts/run-evidence-replay.mjs dispatch).`];
  if (onlyRun.length) return [`${head} This run would measure the optional scanner ${onlyRun.join(', ')} and the control did not. Dispatch without include_openredaction, or create the matching control explicitly (scripts/run-evidence-replay.mjs dispatch --include-openredaction).`];
  return [`${head} Create the matching control explicitly (scripts/run-evidence-replay.mjs).`];
}
