/**
 * The scanner-selection identity of an acceptance package (#773, building on #763 and #812). `scripts/prepare-acceptance-package.mjs` assembles the owner's package from the
 * control replay's archive: the recorded runs, the registry-format archive, the derived inputs, the candidate view and the parity report. Each of those carries the scanner set the
 * control measured, in its own shape; this module is the ONE place that reads that set from the control and checks every surface against it. Pure: no file, process or network access,
 * so the checks run on bounded fixtures (tests/acceptance-package-roster.test.mjs) and on the retained run 37630100920 shape (the four required scanners, OpenRedaction omitted).
 *
 * What it refuses, with what to do:
 *  - a control whose scanner set is not the roster the package is prepared for (the default is the REQUIRED scanners only; the optional OpenRedaction default needs `--include-openredaction`);
 *  - a control that lacks a required scanner, names an unknown one, or contradicts its own record (`scannerSelection` against the case counts it recorded);
 *  - a STALE control: its run records (in the archive the record names) disagree with the adoption record on digests, configuration, engine, revision or evidence;
 *  - a recorded run, an archive, a derived-input receipt, a view or a parity report of another roster, configuration or run than the control's.
 *
 * It decides nothing for the owner and writes nothing: the OWNER-TO-SET fields and the authority are outside it.
 */
import { controlRosterProblems, controlScannerIds, effectiveScannerIds } from './official-run-selection.mjs';

const sortedList = list => [...list].sort();
const same = (a, b) => sortedList(a ?? []).join(',') === sortedList(b ?? []).join(',');
const listText = list => (list.length ? list.join(', ') : 'none');

/** The surfaces a prepared package reconciles, in the order they are produced. */
export const RECONCILED_SURFACES = ['control-records', 'recorded-runs', 'archive', 'derived-inputs', 'view', 'parity'];

/**
 * The scanner selection the control replay measured, checked against the roster the package is prepared for. `replay` is `evidenceCandidate.replay`; `registryScanners` the
 * registry's scanner list (the scanners an official configuration can run). Returns `{ selection, problems }`; no selection when there is a problem.
 */
export function packageSelection({ replay, roster, registryScanners, includeOpenRedaction = false }) {
  const entry = roster.runClasses.official;
  const registryIds = registryScanners.map(s => s.id);
  const measured = controlScannerIds(replay);
  if (!measured) return { selection: null, problems: ['the control replay records no scanner set (recordedRuns[].caseCounts, one set for every run): record it again with scripts/run-evidence-replay.mjs'] };
  const problems = [];
  const known = new Set([...entry.required, ...entry.optional]);
  const missing = entry.required.filter(id => !measured.includes(id));
  if (missing.length) problems.push(`the control replay lacks the required scanner(s) ${missing.join(', ')}: a required scanner is always measured, so this control cannot back a package`);
  const unknown = measured.filter(id => !known.has(id));
  if (unknown.length) problems.push(`the control replay measured ${unknown.join(', ')}, which the scanner roster (benchmarks/support/scanner-roster.json) does not name`);
  const decided = entry.optional.filter(id => registryIds.includes(id));
  const notOfficial = measured.filter(id => entry.optional.includes(id) && !decided.includes(id));
  if (notOfficial.length) problems.push(`the control replay measured ${notOfficial.join(', ')}, which is in no official configuration`);
  // The roster this package is prepared for: the registry's scanners without the optional ones, unless the OpenRedaction default is explicitly opted in.
  const wanted = effectiveScannerIds(registryScanners, roster, includeOpenRedaction ? decided : []);
  if (!problems.length) problems.push(...controlRosterProblems({ control: measured, selected: wanted, roster, controlLabel: 'the recorded control replay' }).map(p => `${p}${includeOpenRedaction ? '' : ' (prepare-acceptance-package.mjs prepares the default four-scanner package unless --include-openredaction is given.)'}`));
  const included = decided.filter(id => measured.includes(id));
  const omitted = decided.filter(id => !measured.includes(id));
  const recorded = replay.scannerSelection;
  if (recorded) {
    if (!same(recorded.scanners ?? [], measured)) problems.push(`the control replay's scannerSelection names ${listText(recorded.scanners ?? [])}, its runs recorded case counts for ${listText(measured)}: the record contradicts itself`);
    if (!same(recorded.includedOptionalScanners ?? [], included)) problems.push(`the control replay's scannerSelection includes ${listText(recorded.includedOptionalScanners ?? [])}, its runs measured ${listText(included)}`);
    if (!same(recorded.omittedOptionalScanners ?? [], omitted)) problems.push(`the control replay's scannerSelection omits ${listText(recorded.omittedOptionalScanners ?? [])}, its runs left out ${listText(omitted)}`);
  }
  if (problems.length) return { selection: null, problems };
  return {
    problems,
    selection: {
      basis: recorded ? 'recorded' : 'derived-from-case-counts',
      policy: included.length ? 'explicit-include-optional' : 'default-omit-optional',
      scanners: sortedList(measured), required: sortedList(entry.required),
      includedOptionalScanners: sortedList(included), omittedOptionalScanners: sortedList(omitted),
    },
  };
}

const runIdOf = record => `${record.population}${record.kind === 'methods' ? '+methods' : ''}@${record.platform}`;

/** What a run record (or a registry run) says about the scanners it measured and left out, compared with the selection. */
function recordSelectionProblems(at, record, selection) {
  const problems = [];
  const ran = (record.scanners ?? []).map(s => s.id);
  if (!same(ran, selection.scanners)) problems.push(`${at}: measured ${listText(sortedList(ran))}, the package's roster is ${listText(selection.scanners)}`);
  const omitted = record.omittedOptionalScanners ?? [];
  if (!same(omitted, selection.omittedOptionalScanners)) problems.push(`${at}: omittedOptionalScanners is ${listText(omitted)}, the package leaves out ${listText(selection.omittedOptionalScanners)}`);
  const sel = record.scannerSelection;
  if (sel) {
    if (!same(sel.scanners ?? [], selection.scanners)) problems.push(`${at}: scannerSelection names ${listText(sel.scanners ?? [])}, the package's roster is ${listText(selection.scanners)}`);
    if (!same(sel.includedOptionalScanners ?? [], selection.includedOptionalScanners)) problems.push(`${at}: scannerSelection includes ${listText(sel.includedOptionalScanners ?? [])}, the package includes ${listText(selection.includedOptionalScanners)}`);
    if (!same(sel.omittedOptionalScanners ?? [], selection.omittedOptionalScanners)) problems.push(`${at}: scannerSelection omits ${listText(sel.omittedOptionalScanners ?? [])}, the package leaves out ${listText(selection.omittedOptionalScanners)}`);
    if (sel.configHash !== undefined && sel.configHash !== record.configHash) problems.push(`${at}: scannerSelection configHash ${sel.configHash} is not the run's configHash ${record.configHash}`);
  }
  return problems;
}

/**
 * The control is not stale: the run records inside the archive the adoption record names (`records`: `{ rel, record }` as read from the fetched archive) are exactly the runs
 * `evidenceCandidate.replay` recorded, on the candidate's engine, evidence and replay commit.
 */
export function controlRecordProblems({ ec, tag, selection, records }) {
  const replay = ec.replay;
  const problems = [];
  const wanted = new Map((replay.recordedRuns ?? []).map(r => [r.id, r]));
  const seen = new Set();
  for (const { rel, record } of records) {
    const id = runIdOf(record);
    seen.add(id);
    const control = wanted.get(id);
    if (!control) { problems.push(`${rel}: the run ${id} is not among the runs the adoption record's control replay recorded (${[...wanted.keys()].join(', ')}): stale or foreign archive`); continue; }
    if (record.artifact?.semanticDigest !== control.semanticDigest) problems.push(`${rel}: semantic digest ${record.artifact?.semanticDigest} differs from the recorded ${control.semanticDigest}: stale control`);
    if (record.artifact?.digest !== control.byteDigest) problems.push(`${rel}: byte digest ${record.artifact?.digest} differs from the recorded ${control.byteDigest}: stale control`);
    if (record.configHash !== control.configHash) problems.push(`${rel}: configuration hash ${record.configHash} differs from the recorded ${control.configHash}: another scanner configuration than the control's`);
    if (JSON.stringify(record.caseCounts ?? null) !== JSON.stringify(control.caseCounts ?? null)) problems.push(`${rel}: case counts differ from the recorded ones: another scanner set or population`);
    if (record.engine?.revision !== ec.engine?.revision) problems.push(`${rel}: engine ${record.engine?.revision} is not the candidate's ${ec.engine?.revision}`);
    if (record.benchmarkRevision !== replay.benchmarkRevision) problems.push(`${rel}: benchmark revision ${record.benchmarkRevision} is not the control's ${replay.benchmarkRevision}`);
    if (record.population === 'public-evidence-snapshot' && record.evidence?.release?.tag !== tag) problems.push(`${rel}: measured evidence ${record.evidence?.release?.tag}, not ${tag}`);
    if (record.productCandidate) problems.push(`${rel}: a product candidate run is not the control`);
    problems.push(...recordSelectionProblems(rel, record, selection));
  }
  for (const id of wanted.keys()) if (!seen.has(id)) problems.push(`the archive holds no run record for ${id}, which the adoption record's control replay recorded`);
  for (const [population, digest] of Object.entries(replay.semanticDigests ?? {})) {
    const control = wanted.get(`${population}@linux-x64`);
    if (control && control.semanticDigest !== digest) problems.push(`the control replay's semanticDigests.${population} differs from its recordedRuns entry`);
  }
  return problems;
}

/** The registry runs the package records (`runs`: the tree's `benchmarks/official-runs.json` runs) are the control's, of the package's roster. */
export function recordedRunProblems({ selection, replay, runs }) {
  const problems = [];
  const control = new Map((replay.recordedRuns ?? []).map(r => [r.id, r]));
  const have = new Map(runs.map(r => [r.id, r]));
  for (const id of control.keys()) if (!have.has(id)) problems.push(`benchmarks/official-runs.json records no ${id} from the control replay`);
  for (const [id, run] of have) {
    const c = control.get(id);
    if (!c) { problems.push(`benchmarks/official-runs.json records ${id}, which the control replay did not run: a stale run kept after the repin`); continue; }
    if (run.artifact?.semanticDigest !== c.semanticDigest) problems.push(`${id}: the recorded semantic digest differs from the control's`);
    if (run.artifact?.byteDigest !== c.byteDigest) problems.push(`${id}: the recorded byte digest differs from the control's`);
    if (run.configHash !== c.configHash) problems.push(`${id}: the recorded configuration hash differs from the control's`);
    problems.push(...recordSelectionProblems(id, run, selection));
  }
  return problems;
}

/** The registry-format archive binds the control's CI run, in a release named for it, and (when it names a roster) the package's. */
export function archiveProblems({ archive, runId, selection }) {
  const problems = [];
  if (String(archive.source?.ciRun) !== String(runId)) problems.push(`the archive file names CI run ${archive.source?.ciRun}, the control replay is run ${runId}`);
  if (archive.release?.tag !== `official-runs-registry-${runId}`) problems.push(`the archive release ${archive.release?.tag} is not official-runs-registry-${runId}`);
  if (archive.release?.asset !== `official-runs-${runId}.tar.gz`) problems.push(`the archive asset ${archive.release?.asset} is not official-runs-${runId}.tar.gz`);
  const named = archive.source?.scannerSelection;
  if (named && (!same(named.scanners ?? [], selection.scanners) || !same(named.omittedOptionalScanners ?? [], selection.omittedOptionalScanners))) problems.push(`the archive file's scannerSelection (${listText(named.scanners ?? [])}) is not the package's roster (${listText(selection.scanners)})`);
  return problems;
}

/** The derived-input receipt was derived from the control's plain and methods artifacts (their semantic digests), not from another run. */
export function derivedInputProblems({ receipt, replay }) {
  const problems = [];
  const digest = id => (replay.recordedRuns ?? []).find(r => r.id === id)?.semanticDigest;
  const plain = receipt?.artifacts?.plain, methods = receipt?.artifacts?.methods;
  if (!plain) problems.push('the derived-input receipt names no plain run: the derivation must read the control\'s plain artifact');
  else if (plain.semanticDigest !== digest('public-evidence-snapshot@linux-x64')) problems.push(`the derived inputs were derived from a plain run with semantic digest ${plain.semanticDigest}, the control's is ${digest('public-evidence-snapshot@linux-x64')}`);
  if (!methods) problems.push('the derived-input receipt names no methods run');
  else if (methods.semanticDigest !== digest('public-evidence-snapshot+methods@linux-x64')) problems.push(`the derived inputs were derived from a methods run with semantic digest ${methods.semanticDigest}, the control's is ${digest('public-evidence-snapshot+methods@linux-x64')}`);
  return problems;
}

/** The candidate view measured the control's scanners, states every omitted optional scanner as not measured, and was built from the control's artifacts. */
export function viewProblems({ view, selection, replay }) {
  const problems = [];
  if (!same(view.scanners ?? [], selection.scanners)) problems.push(`the candidate view lists the scanners ${listText(view.scanners ?? [])}, the package's roster is ${listText(selection.scanners)}`);
  const roster = view.scannerRoster;
  if (!roster) problems.push('the candidate view carries no scannerRoster: the scanner set is not stated in it');
  else {
    if (!same(roster.measured ?? [], selection.scanners)) problems.push(`the view's scannerRoster.measured is ${listText(roster.measured ?? [])}, the package's roster is ${listText(selection.scanners)}`);
    const notMeasured = (roster.notMeasured ?? []).map(n => n.scanner);
    for (const id of selection.omittedOptionalScanners) if (!notMeasured.includes(id)) problems.push(`the view does not state ${id} as not measured: a silently dropped optional scanner`);
    for (const id of selection.scanners) if (notMeasured.includes(id)) problems.push(`the view states ${id} as not measured, but the control measured it`);
  }
  for (const control of (replay.recordedRuns ?? []).filter(r => !r.id.includes('+methods'))) {
    const population = control.id.replace(/@.*$/, '');
    const entry = (view.populations ?? []).find(p => p.population === population);
    if (!entry) { problems.push(`the candidate view has no population ${population}`); continue; }
    if (entry.artifact?.artifactDigest !== control.byteDigest) problems.push(`the view's ${population} was built from artifact ${entry.artifact?.artifactDigest}, the control's is ${control.byteDigest}`);
    if (entry.artifact?.configHash !== control.configHash) problems.push(`the view's ${population} configuration hash differs from the control's`);
  }
  return problems;
}

/** The parity report compares the control's scanners (strict: nothing unexplained) and names the same runs. */
export function parityProblems({ parity, selection, replay }) {
  const problems = [];
  const scanners = Object.keys(parity.identities?.new?.scanners ?? {});
  if (!same(scanners, selection.scanners)) problems.push(`the parity report's new side lists the scanners ${listText(scanners)}, the package's roster is ${listText(selection.scanners)}`);
  if ((parity.summary?.unexplained ?? 1) !== 0) problems.push(`the parity report has ${parity.summary?.unexplained} unexplained difference(s): the package is strict`);
  const control = new Map((replay.recordedRuns ?? []).map(r => [r.id, r]));
  for (const p of parity.identities?.new?.populations ?? []) {
    const c = control.get(p.run);
    if (!c) problems.push(`the parity report names the run ${p.run}, which is not a run of the control replay`);
    else {
      if (p.semanticDigest !== c.semanticDigest) problems.push(`the parity report's ${p.run} has semantic digest ${p.semanticDigest}, the control's is ${c.semanticDigest}`);
      if (p.configHash !== c.configHash) problems.push(`the parity report's ${p.run} has configuration hash ${p.configHash}, the control's is ${c.configHash}`);
    }
  }
  for (const id of selection.omittedOptionalScanners) if (scanners.includes(id)) problems.push(`the parity report lists the omitted optional scanner ${id} on the new side`);
  return problems;
}

/** What the prepared acceptance records of the scanner selection: identity, never a result. */
export function acceptanceSelection({ selection, replay, archive, runId }) {
  return {
    basis: selection.basis, policy: selection.policy,
    scanners: selection.scanners, required: selection.required,
    includedOptionalScanners: selection.includedOptionalScanners, omittedOptionalScanners: selection.omittedOptionalScanners,
    configHashes: Object.fromEntries((replay.recordedRuns ?? []).map(r => [r.id, r.configHash]).sort(([a], [b]) => (a < b ? -1 : 1))),
    controlRun: String(runId),
    archive: { release: archive.release.tag, asset: archive.release.asset },
    reconciled: RECONCILED_SURFACES,
    note: 'The scanner set the control replay measured, bound to the recorded runs, the registry-format archive, the derived inputs, the candidate view and the parity report by scripts/prepare-acceptance-package.mjs (scripts/acceptance-roster.mjs). Identity only: it moves no status and no owner field.',
  };
}

/**
 * `adoption:check` side of the binding (no I/O): the scanner selection a prepared acceptance records is the one the adoption record's control replay measured, so a hand-edit
 * of either, or a package prepared for another control, is refused. Absent on a package prepared before #773, which is accepted as it was.
 */
export function acceptanceSelectionProblems(acceptance, replay, roster) {
  const sel = acceptance?.scannerSelection;
  if (!sel) return [];
  const problems = [];
  const measured = controlScannerIds(replay);
  if (!replay || !measured) return ['acceptance.scannerSelection is recorded, but the evidence candidate has no control replay with a scanner set to bind it to'];
  if (!same(sel.scanners ?? [], measured)) problems.push(`acceptance.scannerSelection.scanners (${listText(sel.scanners ?? [])}) is not what the control replay measured (${listText(measured)})`);
  const entry = roster?.runClasses?.official;
  if (entry) {
    const missing = entry.required.filter(id => !(sel.scanners ?? []).includes(id));
    if (missing.length) problems.push(`acceptance.scannerSelection lacks the required scanner(s) ${missing.join(', ')}`);
    if (!same(sel.required ?? [], entry.required)) problems.push('acceptance.scannerSelection.required is not the roster\'s required scanners');
  }
  const optionalIn = (sel.scanners ?? []).filter(id => entry?.optional?.includes(id));
  if (!same(sel.includedOptionalScanners ?? [], optionalIn)) problems.push(`acceptance.scannerSelection.includedOptionalScanners (${listText(sel.includedOptionalScanners ?? [])}) is not the optional scanners it measured (${listText(optionalIn)})`);
  for (const id of sel.omittedOptionalScanners ?? []) if ((sel.scanners ?? []).includes(id)) problems.push(`acceptance.scannerSelection both measures and omits ${id}`);
  for (const r of replay.recordedRuns ?? []) if (sel.configHashes?.[r.id] !== r.configHash) problems.push(`acceptance.scannerSelection.configHashes.${r.id} is not the control's configuration hash`);
  if (replay.scannerSelection && !same(replay.scannerSelection.omittedOptionalScanners ?? [], sel.omittedOptionalScanners ?? [])) problems.push('acceptance.scannerSelection.omittedOptionalScanners differs from the control replay\'s scannerSelection');
  const runId = String(replay.ciRun ?? '').split('/').pop();
  if (sel.controlRun !== runId) problems.push(`acceptance.scannerSelection.controlRun ${sel.controlRun} is not the control replay's run ${runId}`);
  return problems;
}
