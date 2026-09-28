/**
 * Score a #427 mixed-document parity observation. Deterministic: the committed observation re-scores to the committed
 * report byte for byte, from the frozen plan and the regenerated credential fixtures, without installing anything.
 *
 * Accounting rules: PII and credential outcomes are counted in separate domains and never combined. Documents and
 * their targets are the only independent units; variants, partitions, selections, operations and surfaces are checks.
 */
import {
  SELECTIONS, VARIANTS, loadPlan, materialize, planCommitment, scoreOperation, signature, variantOf,
  type MaterializedDocument, type ObservedOperation, type Selection,
} from './parity.ts';

export const SURFACES = ['node-addon', 'node-wasm', 'browser-wasm', 'python', 'rust', 'cli'];
export const EXPECTED_UNITS: Record<string, string> = {
  'node-addon': 'utf16-code-units', 'node-wasm': 'utf16-code-units', 'browser-wasm': 'utf16-code-units', python: 'unicode-code-points', rust: 'utf8-bytes', cli: 'utf8-bytes',
};

type Op = ObservedOperation & { state?: string | null };
interface CaseObservation {
  scan: Op; redact: Op; scanAndRedact: Op; incremental: { partitions: Record<string, string>; signatures: Record<string, Op> };
  wholeLimits: Array<{ id: string; scan: Op & { count?: number }; redact: Op; scanAndRedact: Op }> | { status: 'not-applicable'; reason?: string };
  incrementalFailures: Array<{ id: string; status: string; errorCode: string | null; state: string | null; emittedIsPrefixOfWholeOutput: boolean | null; emittedLeaks: string[] }>
    | { status: 'not-applicable'; reason?: string };
}
interface SurfaceObservation {
  surface: string; status: string; reason?: string; unit?: string; runtime?: string | null; notApplicable?: Record<string, string> | null;
  selections?: Record<Selection, { identity: { rangeUnit: string | null; version: string | null; artifact: string | null; piiActivation: string | null }; cases: Record<string, CaseObservation> }>;
}
export interface MixedParityObservation {
  schemaVersion: 1; reportType: 'pii-mixed-parity-observation'; issue: string; plan: { path: string; frozenAt: string; commitment: string };
  benchmark: { commit: string; harnessDirty: boolean }; target: Record<string, unknown>; platform: string; node: string;
  incrementalLimits: Record<string, number>; surfaces: SurfaceObservation[];
}

const LIMIT_EXPECTATIONS: Record<string, string | null> = { 'input-exact': null, 'input-under': 'INPUT_LIMIT_EXCEEDED', 'findings-exact': null, 'findings-under': 'FINDING_LIMIT_EXCEEDED' };
const normalCode = (code: string | null | undefined) => (code ?? '').toUpperCase().replace(/-/g, '_');
const ratio = (rows: Array<boolean | null>) => { const scored = rows.filter(row => row !== null); return { passed: scored.filter(Boolean).length, total: scored.length }; };

export function buildMixedParityReport(observation: MixedParityObservation) {
  if (observation.reportType !== 'pii-mixed-parity-observation' || observation.schemaVersion !== 1) throw new Error('not a #427 parity observation');
  const plan = loadPlan(observation.plan.path);
  if (observation.plan.commitment !== planCommitment(plan)) throw new Error('observation was taken on a different #427 plan');
  const documents = materialize(plan);
  const shaped = new Map<string, MaterializedDocument>(documents.flatMap(document => VARIANTS.map(variant => [`${document.id}/${variant}`, variantOf(document, variant)] as const)));
  const lineRole = new Map<string, string>(plan.documents.flatMap(document => document.lines.map(line => [line.id, line.role] as const)));
  const observed = observation.surfaces.filter(surface => surface.status === 'observed');

  // Per-operation scores, kept for every later view.
  type Scored = { surface: string; selection: Selection; key: string; op: string; observed: Op; score: ReturnType<typeof scoreOperation> };
  const scored: Scored[] = [];
  for (const surface of observed) for (const selection of SELECTIONS) for (const [key, row] of Object.entries(surface.selections![selection].cases)) {
    const document = shaped.get(key)!;
    for (const op of ['scan', 'redact', 'scanAndRedact'] as const)
      if (row[op].status !== 'not-applicable') scored.push({ surface: surface.surface, selection, key, op, observed: row[op], score: scoreOperation(document, selection, row[op]) });
    for (const [partition, signatureKey] of Object.entries(row.incremental.partitions)) {
      const op = row.incremental.signatures[signatureKey];
      scored.push({ surface: surface.surface, selection, key, op: `incremental:${partition}`, observed: op, score: scoreOperation(document, selection, op) });
    }
  }
  const ok = (row: Scored) => row.score.status === 'ok' ? row.score as Extract<ReturnType<typeof scoreOperation>, { status: 'ok' }> : null;
  const expectationMet = (row: Scored) => {
    const score = ok(row); if (!score) return false;
    const incrementalState = row.op.startsWith('incremental:') && row.observed.state && row.observed.state !== 'finalized' ? false : true;
    return score.findingsCorrect !== false && score.outputCorrect !== false && score.rangeUnitErrors === 0 && incrementalState;
  };

  // Surface summary (per selection).
  const surfaceSummary = observation.surfaces.flatMap((surface): Array<Record<string, unknown>> => {
    if (surface.status !== 'observed') return [{ surface: surface.surface, status: surface.status, reason: surface.reason ?? null }];
    return SELECTIONS.map(selection => {
      const rows = scored.filter(row => row.surface === surface.surface && row.selection === selection);
      const identity = surface.selections![selection].identity;
      const whole = (op: string) => ratio(rows.filter(row => row.op === op).map(expectationMet));
      const incremental = rows.filter(row => row.op.startsWith('incremental:'));
      const cases = Object.entries(surface.selections![selection].cases);
      const limits = cases.flatMap(([, row]) => Array.isArray(row.wholeLimits) ? row.wholeLimits.flatMap(limit => (['scan', 'redact', 'scanAndRedact'] as const).map(op => {
        const expected = LIMIT_EXPECTATIONS[limit.id];
        return expected ? limit[op].status === 'error' && normalCode(limit[op].errorCode) === expected : limit[op].status === 'ok';
      })) : []);
      const failures = cases.flatMap(([, row]) => Array.isArray(row.incrementalFailures) ? row.incrementalFailures.map(failure =>
        failure.status === 'error' && normalCode(failure.errorCode) === 'INPUT_LIMIT_EXCEEDED' && failure.state === 'failed'
        && failure.emittedIsPrefixOfWholeOutput === true && failure.emittedLeaks.length === 0) : []);
      const notApplicable = surface.notApplicable ?? {};
      const outputRows = rows.filter(row => ok(row)?.outputCorrect !== null && ok(row)?.outputCorrect !== undefined);
      return {
        surface: surface.surface, selection, status: 'observed', runtime: surface.runtime ?? null,
        rangeUnit: { declared: identity.rangeUnit, expected: EXPECTED_UNITS[surface.surface], agrees: identity.rangeUnit === EXPECTED_UNITS[surface.surface] },
        version: identity.version, artifact: identity.artifact, piiActivation: identity.piiActivation,
        scan: whole('scan'), redact: notApplicable.redact ? { notApplicable: notApplicable.redact } : whole('redact'), scanAndRedact: whole('scanAndRedact'),
        incremental: { partitionsRun: incremental.length, expectationMet: incremental.filter(expectationMet).length,
          ...(notApplicable.partitions ? { scope: notApplicable.partitions } : {}) },
        output: { correct: outputRows.filter(row => ok(row)!.outputCorrect).length, total: outputRows.length,
          sanitizedSuccess: outputRows.filter(row => ok(row)!.sanitized).length,
          warnRetainedOperations: outputRows.filter(row => ok(row)!.warnRetained.length > 0).length,
          valueLeftAfterReplacement: outputRows.filter(row => ok(row)!.valueLeftAfterReplacement.length > 0).length },
        wholeInputLimits: notApplicable.wholeLimits ? { notApplicable: notApplicable.wholeLimits } : ratio(limits),
        incrementalLimitFailure: notApplicable.incrementalFailures ? { notApplicable: notApplicable.incrementalFailures } : ratio(failures),
        rangeUnitErrors: rows.reduce((sum, row) => sum + (ok(row)?.rangeUnitErrors ?? 0), 0),
      };
    });
  });

  // Target outcomes (independent units), per selection, across every surface, operation and variant.
  const targetOutcomes = documents.flatMap(document => document.targets.map(target => {
    const bySelection = Object.fromEntries(SELECTIONS.filter(selection => target.domain === 'credential' || selection === 'pii-on').map(selection => {
      const outcomes: Record<string, string[]> = {};
      for (const row of scored.filter(entry => entry.selection === selection && entry.key.startsWith(`${document.id}/`))) {
        const score = ok(row); if (!score || score.findingsCorrect === null) continue;
        const domain = target.domain === 'pii' ? score.pii : score.credential;
        const outcome = target.optional ? (score.chosenOptional.includes(target.id) ? 'present' : domain.wrong.includes(target.id) ? 'wrong' : 'absent')
          : domain.missing.includes(target.id) ? 'missing' : domain.wrong.includes(target.id) ? 'wrong' : 'matched';
        (outcomes[outcome] ??= []).push(`${row.surface}:${row.op}:${row.key.split('/')[1]}`);
      }
      return [selection, { outcomes: Object.fromEntries(Object.entries(outcomes).map(([key, members]) => [key, members.length])),
        consistent: Object.keys(outcomes).length === 1,
        ...(Object.keys(outcomes).length > 1 ? { minority: Object.entries(outcomes).sort((a, b) => a[1].length - b[1].length)[0][1].slice(0, 12) } : {}) }];
    }));
    return { id: target.id, domain: target.domain, family: target.family ?? null, role: lineRole.get(target.id.split('/').slice(0, 2).join('/')) ?? null,
      optional: target.optional, action: target.action ?? 'replacing', knownDefect: target.knownDefect ?? null, envelope: target.envelope ?? null, bySelection };
  }));

  // Cross-surface parity: one findings signature and one output signature per (selection, case) across every operation.
  const parity = SELECTIONS.flatMap(selection => [...shaped.keys()].map(key => {
    const rows = scored.filter(row => row.selection === selection && row.key === key);
    const group = (include: { findings: boolean; output: boolean }, filter: (row: Scored) => boolean) => {
      const groups: Record<string, string[]> = {};
      for (const row of rows.filter(filter)) (groups[signature(row.observed, include)] ??= []).push(`${row.surface}:${row.op}`);
      return groups;
    };
    const findings = group({ findings: true, output: false }, row => row.observed.status !== 'ok' || (row.observed.findings !== null && row.observed.findings !== undefined));
    const output = group({ findings: false, output: true }, row => row.observed.status !== 'ok' || (row.observed.outputSha256 !== null && row.observed.outputSha256 !== undefined));
    const minority = (groups: Record<string, string[]>) => Object.values(groups).sort((a, b) => b.length - a.length).slice(1).flat();
    return { selection, case: key, findingSignatures: Object.keys(findings).length, outputSignatures: Object.keys(output).length,
      findingDisagreements: minority(findings).slice(0, 24), outputDisagreements: minority(output).slice(0, 24),
      surfacesCompared: new Set(rows.map(row => row.surface)).size, operationsCompared: rows.length };
  }));

  // PII-off invariance for credentials, per surface.
  const piiOff = observed.map(surface => {
    const on = surface.selections!['pii-on'].cases, off = surface.selections!['pii-off'].cases;
    const credentialFindings = (op: Op) => (op.findings ?? []).filter(row => !row.type.startsWith('pii_')).map(row => [row.type, row.detector, row.action, row.start, row.end]);
    const control = VARIANTS.map(variant => `ci-log-credentials-only/${variant}`);
    const controlIdentical = control.every(key => signature(on[key].scanAndRedact, { findings: on[key].scanAndRedact.findings !== null, output: true })
      === signature(off[key].scanAndRedact, { findings: off[key].scanAndRedact.findings !== null, output: true })
      && signature(on[key].scan, { findings: true, output: false }) === signature(off[key].scan, { findings: true, output: false }));
    const keys = Object.keys(on);
    const credentialSubsetEqual = keys.filter(key => on[key].scan.status === 'ok' && off[key].scan.status === 'ok'
      && JSON.stringify(credentialFindings(on[key].scan)) === JSON.stringify(credentialFindings(off[key].scan))).length;
    const piiFindingsWhileOff = keys.reduce((sum, key) => sum + (off[key].scan.findings ?? []).filter(row => row.type.startsWith('pii_')).length, 0);
    const offRows = scored.filter(row => row.surface === surface.surface && row.selection === 'pii-off');
    return { surface: surface.surface, credentialOnlyControlIdentical: controlIdentical,
      credentialFindingsEqualToPiiOn: `${credentialSubsetEqual}/${keys.length}`, piiFindingsWhileOff,
      piiOffExpectationMet: `${offRows.filter(expectationMet).length}/${offRows.length}` };
  });

  // Separate domain accounting over the whole-input scan (LF and CRLF) per surface and selection.
  const accounting = observed.flatMap(surface => SELECTIONS.map(selection => {
    const rows = scored.filter(row => row.surface === surface.surface && row.selection === selection && row.op === 'scan');
    const sum = (domain: 'pii' | 'credential', field: 'required' | 'matched' | 'unexpected') => rows.reduce((total, row) => {
      const score = ok(row); return total + (score ? (field === 'unexpected' ? score[domain].unexpected : score[domain][field]) : 0); }, 0);
    const list = (domain: 'pii' | 'credential', field: 'missing' | 'wrong') => [...new Set(rows.flatMap(row => ok(row)?.[domain][field] ?? []))].sort();
    return { surface: surface.surface, selection, operation: 'scan', variants: VARIANTS,
      pii: { required: sum('pii', 'required'), matched: sum('pii', 'matched'), missing: list('pii', 'missing'), wrong: list('pii', 'wrong'), unexpected: sum('pii', 'unexpected') },
      credential: { required: sum('credential', 'required'), matched: sum('credential', 'matched'), missing: list('credential', 'missing'), wrong: list('credential', 'wrong'), unexpected: sum('credential', 'unexpected') } };
  }));

  const targets = documents.flatMap(document => document.targets);
  const knownDefects = targetOutcomes.filter(row => row.knownDefect).map(row => ({ id: row.id, knownDefect: row.knownDefect, outcomes: row.bySelection['pii-on']?.outcomes ?? null }));
  const disagreeing = parity.filter(row => row.findingSignatures > 1 || row.outputSignatures > 1);
  const expectationFailures = scored.filter(row => !expectationMet(row));
  const failureGroups: Record<string, number> = {};
  for (const row of expectationFailures) {
    const score = ok(row);
    const reasons = !score ? [`${row.score.status}:${(row.score as { errorCode?: string }).errorCode ?? ''}`] : [
      ...score.pii.missing.map(id => `pii-missing:${id}`), ...score.pii.wrong.map(id => `pii-wrong:${id}`), ...score.credential.missing.map(id => `credential-missing:${id}`),
      ...score.credential.wrong.map(id => `credential-wrong:${id}`), ...(score.pii.unexpected ? [`pii-unexpected:${row.key.split('/')[0]}`] : []),
      ...(score.credential.unexpected ? [`credential-unexpected:${row.key.split('/')[0]}`] : []), ...(score.outputCorrect === false && score.findingsCorrect !== false ? [`output-mismatch:${row.key}`] : []),
      ...(score.rangeUnitErrors ? ['range-unit'] : []), ...(row.observed.state && row.observed.state !== 'finalized' ? [`state:${row.observed.state}`] : [])];
    for (const reason of reasons) failureGroups[`${row.selection}|${reason}`] = (failureGroups[`${row.selection}|${reason}`] ?? 0) + 1;
  }
  return {
    schemaVersion: 1, reportType: 'pii-mixed-parity-report', supportClaims: false, statusPromotion: false, issue: observation.issue,
    plan: observation.plan, benchmark: observation.benchmark, target: observation.target, platform: observation.platform, node: observation.node,
    independentUnits: {
      documents: documents.length, requiredPiiTargets: targets.filter(row => row.domain === 'pii' && !row.optional).length,
      warnPiiTargets: targets.filter(row => row.action === 'warn').length, optionalPiiTargets: targets.filter(row => row.optional).length,
      credentialTargets: targets.filter(row => row.domain === 'credential').length,
      piiLinesWithoutTarget: plan.documents.flatMap(document => document.lines).filter(line => ['pii-non-sensitive', 'pii-not-established'].includes(line.role)).length,
      knownDefectTargets: targets.filter(row => row.knownDefect).length,
    },
    checks: { note: 'checks on the same units; never independent cases', surfacesObserved: observed.length, selections: SELECTIONS.length, variants: VARIANTS.length,
      operationsScored: scored.length, incrementalPartitionsScored: scored.filter(row => row.op.startsWith('incremental:')).length },
    surfaces: observation.surfaces.map(surface => ({ surface: surface.surface, status: surface.status, reason: surface.reason ?? null, unit: surface.unit ?? null, runtime: surface.runtime ?? null })),
    surfaceSummary, accounting, piiOffInvariance: piiOff,
    parity: { casesCompared: parity.length, casesWithDisagreement: disagreeing.length, disagreements: disagreeing },
    expectationFailures: Object.entries(failureGroups).sort().map(([key, operations]) => { const [selection, reason] = key.split('|'); return { selection, reason, operations }; }),
    knownDefects, targets: targetOutcomes,
    acceptance: {
      declaredSurfacesAgree: disagreeing.length === 0,
      surfacesMeetExpectation: expectationFailures.length === 0,
      credentialOnlyUnchangedWhenPiiOff: piiOff.every(row => row.credentialOnlyControlIdentical && row.piiFindingsWhileOff === 0
        && row.credentialFindingsEqualToPiiOn.split('/')[0] === row.credentialFindingsEqualToPiiOn.split('/')[1]),
      unsupportedPaths: observation.surfaces.filter(surface => surface.status !== 'observed').map(surface => `${surface.surface}:${surface.status}`)
        .concat(observed.flatMap(surface => Object.keys(surface.notApplicable ?? {}).map(op => `${surface.surface}:${op}:not-applicable`))),
      combinedCredentialPiiScore: false,
    },
  };
}
