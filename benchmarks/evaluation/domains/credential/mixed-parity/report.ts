/**
 * The #381 credential mixed-document parity report, built from one observation (scripts/measure-credential-mixed-parity.mjs).
 *
 * Units: the documents and their targets are the independent samples. Line-ending variants, chunk partitions, byte
 * streams, operations and surfaces are checks on the same documents; they are counted as checks, never as samples.
 * The reference for cross-surface parity is the Node addon's whole-input `scanAndRedact` on the same document variant.
 */
import { scoreFindings, render, sha256, signature, variantOf, VARIANTS, type MaterializedDocument, type ObservedFinding, type TargetOutcome } from './parity.ts';

export const SURFACES = ['node-addon', 'node-wasm', 'browser-wasm', 'python', 'rust', 'cli'] as const;
export const REFERENCE_SURFACE = 'node-addon';

interface Op { status: string; errorCode?: string | null; findings?: ObservedFinding[] | null; outputSha256?: string | null; valueLeft?: string[]; rangeUnitErrors?: number; emittedLeaks?: string[] }
interface SurfaceCase { scan: Op; redact: Op; scanAndRedact: Op; partitions: Record<string, string>; streams: Record<string, string> | null; signatures: Record<string, Op>;
  wholeLimits: Array<{ id: string; scan: { status: string; count?: number; errorCode?: string }; redact: { status: string; outputSha256?: string; errorCode?: string }; scanAndRedact: { status: string; outputSha256?: string; errorCode?: string } }> | null;
  incrementalFailures: Array<{ id: string; status: string; errorCode: string | null; emittedBytes: number; emittedLeaks: string[] }> | null }
interface SurfaceObservation { surface: string; status: string; reason?: string; unit?: string; runtime?: string | null; notApplicable?: Record<string, string> | null;
  identity?: Record<string, unknown>; cases?: Record<string, SurfaceCase> }

const REPLACING = new Set(['redact', 'block']);

export function buildCredentialParityReport(observation: { surfaces: SurfaceObservation[]; target: Record<string, unknown>; plan: unknown; benchmark: unknown }, documents: MaterializedDocument[]) {
  const shaped = new Map<string, MaterializedDocument>();
  for (const document of documents) for (const variant of VARIANTS) shaped.set(`${document.id}/${variant}`, variantOf(document, variant));
  const observed = observation.surfaces.filter(s => s.status === 'observed' && s.cases);
  const reference = observed.find(s => s.surface === REFERENCE_SURFACE);
  if (!reference) throw new Error('the reference surface was not observed');
  const discrepancies: Array<Record<string, unknown>> = [];
  const targets = new Map<string, { id: string; family: string; kind: string; document: string; fixture: string | null; wrap: string | null; outcomes: Record<string, TargetOutcome[]>; leaked: Record<string, number> }>();
  for (const document of documents) for (const t of document.targets) {
    const line = document.lines[t.line];
    const planLine = line?.fixture ?? null;
    targets.set(t.id, { id: t.id, family: t.family, kind: t.kind, document: document.id, fixture: planLine, wrap: null, outcomes: {}, leaked: {} });
  }
  const collateral: Array<Record<string, unknown>> = [];
  const surfaceSummary = [];
  for (const surface of observed) {
    let checks = 0, incrementalDiverge = 0, streamDiverge = 0, crossDiverge = 0, internalInconsistent = 0, rangeUnitErrors = 0, limitIssues = 0, prefixLeaks = 0;
    const declaredLimit: Record<string, number> = {};
    for (const [key, row] of Object.entries(surface.cases!)) {
      const document = shaped.get(key)!;
      const whole = row.scanAndRedact.status === 'ok' ? row.scanAndRedact : null;
      const findings = row.scan.status === 'ok' ? row.scan.findings ?? null : null;
      rangeUnitErrors += (row.scan.rangeUnitErrors ?? 0) + (row.scanAndRedact.rangeUnitErrors ?? 0);
      if (findings) {
        const scored = scoreFindings(document, findings);
        for (const [id, outcome] of Object.entries(scored.outcome)) { const t = targets.get(id)!; (t.outcomes[surface.surface] ??= []).push(outcome); }
        for (const u of scored.unexpected) collateral.push({ surface: surface.surface, case: key, ...u });
        // Internal consistency: the whole output must be the input with exactly the replacing findings replaced.
        if (whole?.outputSha256 && whole.findings) {
          const expected = sha256(render(document.input, whole.findings.filter(f => REPLACING.has(f.action)).map(f => ({ start: f.start, end: f.end, action: f.action }))));
          checks += 1;
          if (expected !== whole.outputSha256) { internalInconsistent += 1; discrepancies.push({ kind: 'output-not-render-of-findings', surface: surface.surface, case: key }); }
        }
      }
      for (const id of whole?.valueLeft ?? []) { const t = targets.get(id)!; t.leaked[surface.surface] = (t.leaked[surface.surface] ?? 0) + 1; }
      // redact(scan) must equal scanAndRedact.
      if (row.redact.status === 'ok' && whole) { checks += 1; if (row.redact.outputSha256 !== whole.outputSha256) { internalInconsistent += 1; discrepancies.push({ kind: 'redact-vs-scanAndRedact', surface: surface.surface, case: key }); } }
      // Incremental partitions and byte streams against the same surface's whole-input result.
      const wholeFindingsSig = whole?.findings ? signature({ status: 'ok', findings: whole.findings, outputSha256: whole.outputSha256 }) : null;
      // A value the whole-input output also leaves in place (warn-only, missed) is not a new leak of the operation.
      const newLeaks = (ids: string[] = []) => ids.filter(id => !(whole?.valueLeft ?? []).includes(id));
      const compare = (id: string, op: Op, bucket: 'partition' | 'stream') => {
        checks += 1;
        // A declared incremental limit (token, buffer) that fails closed without emitting a value the whole-input
        // result redacts is the documented bounded behaviour, reported apart from divergences.
        if (op.status === 'error' && /LIMIT_EXCEEDED$/.test(op.errorCode ?? '') && !newLeaks(op.emittedLeaks).length) {
          const k = `${bucket}:${op.errorCode}`; declaredLimit[k] = (declaredLimit[k] ?? 0) + 1; return;
        }
        const sameOutput = op.status === 'ok' && op.outputSha256 === whole?.outputSha256;
        const sameFindings = op.findings === null || op.findings === undefined || wholeFindingsSig === null
          || signature({ status: 'ok', findings: op.findings, outputSha256: whole?.outputSha256 }) === wholeFindingsSig;
        if (!sameOutput || !sameFindings) {
          if (bucket === 'partition') incrementalDiverge += 1; else streamDiverge += 1;
          discrepancies.push({ kind: `${bucket}-vs-whole`, surface: surface.surface, case: key, id, status: op.status, errorCode: op.errorCode ?? null,
            sameOutput, sameFindings, newLeaks: newLeaks(op.valueLeft ?? op.emittedLeaks ?? []) });
        }
      };
      for (const [id, key] of Object.entries(row.partitions)) compare(id, row.signatures[key], 'partition');
      for (const [id, key] of Object.entries(row.streams ?? {})) compare(id, row.signatures[key], 'stream');
      // Whole-input limits: the exact limit behaves like no limit; one byte under fails closed.
      for (const limit of row.wholeLimits ?? []) {
        checks += 3;
        const ok = limit.id === 'input-exact'
          ? limit.scanAndRedact.status === 'ok' && limit.scanAndRedact.outputSha256 === whole?.outputSha256 && limit.redact.status === 'ok'
          : limit.scan.status === 'error' && limit.redact.status === 'error' && limit.scanAndRedact.status === 'error';
        if (!ok) { limitIssues += 1; discrepancies.push({ kind: 'whole-limit', surface: surface.surface, case: key, id: limit.id, scan: limit.scan, scanAndRedact: { status: limit.scanAndRedact.status, errorCode: limit.scanAndRedact.errorCode ?? null } }); }
      }
      // Incremental limits: one unit under the input fails closed and emits no target value before failing.
      for (const failure of row.incrementalFailures ?? []) {
        checks += 1;
        if (failure.status !== 'error') { limitIssues += 1; discrepancies.push({ kind: 'incremental-limit-did-not-fail', surface: surface.surface, case: key, id: failure.id }); }
        const leaked = newLeaks(failure.emittedLeaks);
        if (leaked.length) { prefixLeaks += 1; discrepancies.push({ kind: 'incremental-limit-emitted-target', surface: surface.surface, case: key, id: failure.id, targets: leaked }); }
      }
      // Cross-surface parity of the whole-input result (findings in UTF-8 and output digest) against the reference.
      if (surface !== reference) {
        const ref = reference.cases![key].scanAndRedact, refScan = reference.cases![key].scan;
        checks += 2;
        const outputDiffers = whole?.outputSha256 !== ref.outputSha256;
        const findingsDiffer = Boolean(findings && refScan.findings) && signature({ status: 'ok', findings, outputSha256: null }, { findings: true, output: false })
          !== signature({ status: 'ok', findings: refScan.findings, outputSha256: null }, { findings: true, output: false });
        if (outputDiffers || findingsDiffer) { crossDiverge += 1; discrepancies.push({ kind: 'cross-surface', surface: surface.surface, case: key, outputDiffers, findingsDiffer }); }
      }
    }
    surfaceSummary.push({ surface: surface.surface, runtime: surface.runtime ?? null, unit: surface.unit, checks, crossSurfaceDivergences: crossDiverge,
      partitionDivergences: incrementalDiverge, streamDivergences: streamDiverge, declaredLimitFailClosed: declaredLimit, internalInconsistencies: internalInconsistent, rangeUnitErrors, limitIssues, prefixLeaks,
      notApplicable: surface.notApplicable ?? null });
  }
  const targetRows = [...targets.values()].map(t => {
    const ref = t.outcomes[REFERENCE_SURFACE] ?? [];
    const agree = Object.values(t.outcomes).every(list => list.join() === ref.join());
    return { ...t, referenceOutcome: [...new Set(ref)], agreeAcrossSurfaces: agree, leakedOnReference: (t.leaked[REFERENCE_SURFACE] ?? 0) > 0 };
  });
  const byOutcome = (kind: string) => targetRows.filter(t => t.kind === kind).reduce<Record<string, number>>((acc, t) => {
    const key = t.referenceOutcome.length === 1 ? t.referenceOutcome[0] : t.referenceOutcome.join('|'); acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
  // A replacing finding on a twin line is co-detection unless it carries the twin's own family (scored as a twin
  // failure elsewhere); on a control, filler or outside a positive's span it is collateral.
  const onReference = collateral.filter(c => c.surface === REFERENCE_SURFACE);
  const replacingCollateral = onReference.filter(c => c.replacing && c.role !== 'twin');
  const twinCoDetection = onReference.filter(c => c.replacing && c.role === 'twin');
  return {
    schemaVersion: 1, reportType: 'credential-mixed-parity-report', supportClaims: false, target: observation.target, plan: observation.plan, benchmark: observation.benchmark,
    units: { documents: documents.length, targets: targetRows.length, mustRedactTargets: targetRows.filter(t => t.kind === 'must-redact').length,
      policyTargets: targetRows.filter(t => t.kind === 'policy').length, note: 'documents and targets are the independent samples; variants, partitions, streams, operations and surfaces are checks' },
    surfaces: observation.surfaces.map(s => ({ surface: s.surface, status: s.status, reason: s.reason ?? null, identity: s.identity ?? null })),
    surfaceSummary,
    targets: { mustRedact: byOutcome('must-redact'), policy: byOutcome('policy'),
      leakedOnReference: targetRows.filter(t => t.leakedOnReference).map(t => ({ id: t.id, family: t.family, kind: t.kind, fixture: t.fixture, outcome: t.referenceOutcome })),
      notExactOnReference: targetRows.filter(t => t.referenceOutcome.some(o => o !== 'exact')).map(t => ({ id: t.id, family: t.family, kind: t.kind, fixture: t.fixture, outcome: t.referenceOutcome })),
      disagreeAcrossSurfaces: targetRows.filter(t => !t.agreeAcrossSurfaces).map(t => ({ id: t.id, family: t.family, outcomes: t.outcomes })) },
    collateral: { replacingOnReference: replacingCollateral, twinCoDetectionOnReference: twinCoDetection, warnOnlyOnReference: onReference.filter(c => !c.replacing) },
    discrepancies,
    acceptance: {
      exactSpansAgreeAcrossSurfaces: surfaceSummary.every(s => s.crossSurfaceDivergences === 0 && s.rangeUnitErrors === 0),
      incrementalAndStreamsAgreeWithWhole: surfaceSummary.every(s => s.partitionDivergences === 0 && s.streamDivergences === 0),
      outputsConsistentWithFindings: surfaceSummary.every(s => s.internalInconsistencies === 0),
      limitsFailClosedWithoutLeak: surfaceSummary.every(s => s.limitIssues === 0 && s.prefixLeaks === 0),
      mustRedactLeaks: targetRows.filter(t => t.kind === 'must-redact' && t.leakedOnReference).length,
      policyLeaks: targetRows.filter(t => t.kind === 'policy' && t.leakedOnReference).length,
      replacingCollateralOnReference: replacingCollateral.length,
    },
  };
}
