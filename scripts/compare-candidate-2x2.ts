/**
 * The 2x2 of a product candidate on a changed evidence snapshot (#698): two corpora (the accepted one and the new one) and two products (the published control and the
 * unpublished candidate), keyed by semantic case ids, so the corpus effect, the product effect and their interaction are separated and nothing is attributed by position.
 *
 *            corpus OLD     corpus NEW
 *   control     A              C          corpus effect (control) = A to C
 *   candidate   B              D          corpus effect (candidate) = B to D
 *               product effect on OLD = A to B, on NEW = C to D, interaction = the two product effects compared on the cases both corpora measure
 *
 *   node --import tsx scripts/compare-candidate-2x2.ts --a <dir> --b <dir> --c <dir> --d <dir> --snapshot-old <file> --snapshot-new <file>
 *     --maintainer-only-ids <json array file, optional> --out-json <file> [--out-md <file>] [--strict]
 *
 * <dir> holds <population>/artifact.json (public-evidence-snapshot, regression-corpus, policy-corpus) and public-evidence-snapshot/methods/artifact.json. A case is
 * "common" when both snapshots carry it with identical content, expected spans, kind and grouping; "changed" when both carry it but the case differs; "added" when only
 * the new one does. Unexplained (the gate, `--strict` exits 1): a corpus effect on a common case, a product effect that differs between the corpora on a common case, a
 * product regression or an unlisted change of a peer. Nothing here asserts a product result: it measures and records.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const PRODUCT = 'redact-secret';
interface Finding { start: number; end: number; family?: string; action?: string }
interface Measurement { type?: string; span_outcomes?: string[]; flagged?: boolean; leaked_bytes?: number; collateral_bytes?: number; findings?: number }
interface CaseRow { case_id: string; actual?: Finding[]; measurement?: Measurement }
interface Assertion { case_id: string; method: string; variant?: string; baseline?: string; candidate?: string; assertion: string; status: string }
interface Scanner { scanner: string; cases: CaseRow[]; assertions?: Assertion[] }
const passes = (m?: Measurement): boolean | null => {
  if (!m) return null;
  if (m.type === 'positive') return (m.span_outcomes ?? []).length > 0 && (m.span_outcomes ?? []).every(o => o === 'EXACT');
  if (m.type === 'control') return m.flagged === false;
  return null;
};
const label = (m?: Measurement) => (!m ? 'absent' : m.type === 'positive' ? (m.span_outcomes ?? []).join('/') || 'positive' : m.type === 'control' ? (m.flagged ? 'flagged' : 'clear') : String(m.type));
const worse = (a?: Measurement, b?: Measurement) => {
  const pa = passes(a), pb = passes(b);
  if (pa === true && pb === false) return true;
  if (pa === false && pb === false) return (b?.leaked_bytes ?? 0) > (a?.leaked_bytes ?? 0) || (b?.collateral_bytes ?? 0) > (a?.collateral_bytes ?? 0) || (b?.findings ?? 0) > (a?.findings ?? 0);
  return pa === true && pb === true ? (b?.collateral_bytes ?? 0) > (a?.collateral_bytes ?? 0) : false;
};
// Both pass and the later one has fewer findings or less collateral, nothing lost: the scored outcome does not move, the findings do (an unexpected `warn`, an extra redaction beside exact spans).
const better = (a?: Measurement, b?: Measurement) => passes(a) === true && passes(b) === true && !worse(a, b) && ((b?.collateral_bytes ?? 0) < (a?.collateral_bytes ?? 0) || (b?.findings ?? 0) < (a?.findings ?? 0));
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

const dirs = { A: path.resolve(need('a')), B: path.resolve(need('b')), C: path.resolve(need('c')), D: path.resolve(need('d')) } as const;
type Cell = keyof typeof dirs;
const cellFile = (cell: Cell, rel: string) => path.join(dirs[cell], rel, 'artifact.json');
const art = (cell: Cell, rel: string, big = false) => { const f = cellFile(cell, rel); return existsSync(f) ? readRunArtifact(readFileSync(f), { forceBytes: big }) : null; };
const product = (a: NonNullable<ReturnType<typeof art>>) => (a.artifact.scanners as unknown as Scanner[]).find(s => s.scanner === PRODUCT)!;

// Corpus membership, from the snapshots.
type SnapCase = { id: string; [k: string]: unknown };
const snapOld = JSON.parse(readFileSync(need('snapshot-old'), 'utf8')).cases as SnapCase[], snapNew = JSON.parse(readFileSync(need('snapshot-new'), 'utf8')).cases as SnapCase[];
const oldById = new Map(snapOld.map(c => [c.id, c])), newById = new Map(snapNew.map(c => [c.id, c]));
const added = snapNew.filter(c => !oldById.has(c.id)).map(c => c.id).sort(), removed = snapOld.filter(c => !newById.has(c.id)).map(c => c.id).sort();
const changed = snapNew.filter(c => oldById.has(c.id) && !same(c, oldById.get(c.id))).map(c => c.id).sort();
const changedSet = new Set(changed), addedSet = new Set(added);
// A common positive whose twin the release changed: the mutation assertions that flip it to that twin read the changed case (for example a twin moved to T0, which no scanner is scored on).
const seedsWithChangedTwin = new Set(snapNew.filter(c => changedSet.has(c.id) && (c as { twin?: { twin_of?: string } }).twin?.twin_of).map(c => (c as { twin: { twin_of: string } }).twin.twin_of));
const common = snapNew.filter(c => oldById.has(c.id) && !changedSet.has(c.id)).map(c => c.id);
const maintainerOnly = new Set<string>(option('maintainer-only-ids') ? JSON.parse(readFileSync(option('maintainer-only-ids')!, 'utf8')) : []);
const seedOf = (id: string) => id.replace(/--(differential|metamorphic|mutation)(--.*)?$/, '').replace(/--(context-indent|context-unicode-prefix|encoding-crlf|canonical)$/, '');

interface Row { id: string; from: string; to: string; fromFindings?: string; toFindings?: string; maintainerOnly: boolean }
const fnd = (a?: Finding[]) => (a?.length ? a.map(f => `${f.start}-${f.end} ${f.family ?? ''} ${f.action ?? ''}`).join('; ') : 'none');
function casesOf(cell: Cell) { const a = art(cell, 'public-evidence-snapshot'); return a ? new Map(product(a).cases.map(c => [c.case_id, c])) : new Map<string, CaseRow>(); }
const cells = { A: casesOf('A'), B: casesOf('B'), C: casesOf('C'), D: casesOf('D') };
const row = (id: string, x: CaseRow | undefined, y: CaseRow | undefined): Row => ({ id, from: label(x?.measurement), to: label(y?.measurement), fromFindings: fnd(x?.actual), toFindings: fnd(y?.actual), maintainerOnly: maintainerOnly.has(id) });
const effect = (from: Map<string, CaseRow>, to: Map<string, CaseRow>, ids: string[]) => {
  const fixed: Row[] = [], regressed: Row[] = [], improved: Row[] = [], changedRows: Row[] = [];
  for (const id of ids) {
    const x = from.get(id), y = to.get(id);
    if (!x || !y || same({ a: x.actual, m: x.measurement }, { a: y.actual, m: y.measurement })) continue;
    (passes(x.measurement) === false && passes(y.measurement) === true ? fixed : worse(x.measurement, y.measurement) ? regressed : better(x.measurement, y.measurement) ? improved : changedRows).push(row(id, x, y));
  }
  return { fixed, regressed, improved, changed: changedRows };
};
const tally = (map: Map<string, CaseRow>, ids: string[]) => {
  const t = { cases: 0, pass: 0, fail: 0, pending: 0, notMeasured: 0, absent: 0 };
  for (const id of ids) { const c = map.get(id); t.cases++; if (!c) { t.absent++; continue; } const p = passes(c.measurement); if (p === true) t.pass++; else if (p === false) t.fail++; else if (c.measurement?.type === 'not-measured') t.notMeasured++; else t.pending++; }
  return t;
};
const newIds = snapNew.map(c => c.id);
const plain = {
  corpus: { oldCases: snapOld.length, newCases: snapNew.length, added: added.length, removed: removed.length, changed: changed.length, common: common.length },
  corpusEffectControl: { onCommon: effect(cells.A, cells.C, common), onChanged: effect(cells.A, cells.C, changed), addedOutcomes: tally(cells.C, added), addedFailing: added.filter(id => passes(cells.C.get(id)?.measurement) === false).map(id => row(id, undefined, cells.C.get(id))) },
  corpusEffectCandidate: { onCommon: effect(cells.B, cells.D, common), onChanged: effect(cells.B, cells.D, changed), addedOutcomes: tally(cells.D, added) },
  productEffectOld: effect(cells.A, cells.B, snapOld.map(c => c.id)),
  productEffectNew: effect(cells.C, cells.D, newIds),
  interaction: { onCommon: [] as Array<{ id: string; old: string; new: string }>, onlyOnNew: { changed: changed.length, added: added.length }, seedsWithChangedTwin: [...seedsWithChangedTwin].sort() },
};
// Interaction: on the common cases the product effect (control to candidate) must be the same on both corpora.
for (const id of common) {
  const o = [cells.A.get(id), cells.B.get(id)], n = [cells.C.get(id), cells.D.get(id)];
  const eo = same({ a: o[0]?.actual, m: o[0]?.measurement }, { a: o[1]?.actual, m: o[1]?.measurement }) ? 'unchanged' : `${label(o[0]?.measurement)}>${label(o[1]?.measurement)}`;
  const en = same({ a: n[0]?.actual, m: n[0]?.measurement }, { a: n[1]?.actual, m: n[1]?.measurement }) ? 'unchanged' : `${label(n[0]?.measurement)}>${label(n[1]?.measurement)}`;
  if (eo !== en) plain.interaction.onCommon.push({ id, old: eo, new: en });
}

// Peers: every other scanner's per-case results are the same across the product cells (the product build is the only difference).
const peerDiffs: Record<string, number> = {};
for (const [x, y, name] of [['A', 'B', 'old'], ['C', 'D', 'new']] as const) {
  const a = art(x, 'public-evidence-snapshot'), b = art(y, 'public-evidence-snapshot');
  if (!a || !b) continue;
  for (const sa of a.artifact.scanners as unknown as Scanner[]) {
    if (sa.scanner === PRODUCT) continue;
    const sb = (b.artifact.scanners as unknown as Scanner[]).find(s => s.scanner === sa.scanner);
    const mb = new Map((sb?.cases ?? []).map(c => [c.case_id, c]));
    peerDiffs[`${sa.scanner}@${name}`] = sa.cases.filter(c => !same({ a: c.actual, m: c.measurement }, { a: mb.get(c.case_id)?.actual, m: mb.get(c.case_id)?.measurement })).length;
  }
}

// Methods: assertions keyed by case, method, assertion, variant, baseline and candidate.
const methods: Record<string, unknown> = {};
{
  const ms = (['A', 'B', 'C', 'D'] as const).map(c => art(c, 'public-evidence-snapshot/methods', true));
  if (ms.every(Boolean)) {
    const key = (a: Assertion) => `${a.case_id}|${a.method}|${a.assertion}|${a.variant ?? ''}|${a.baseline ?? ''}|${a.candidate ?? ''}`;
    const maps = ms.map(m => new Map((product(m!).assertions ?? []).map(a => [key(a), a])));
    const [mA, mB, mC, mD] = maps;
    const commonSeed = new Set(common);
    const inCommon = (k: string) => commonSeed.has(seedOf(k.split('|')[0])) && !seedsWithChangedTwin.has(seedOf(k.split('|')[0]));
    const diff = (from: Map<string, Assertion>, to: Map<string, Assertion>, pick?: (k: string) => boolean) => {
      const fixed: string[] = [], regressed: string[] = [], absent: string[] = [];
      for (const [k, a] of from) { if (pick && !pick(k)) continue; const b = to.get(k); if (!b) absent.push(k); else if (a.status !== b.status) (a.status !== 'pass' && b.status === 'pass' ? fixed : regressed).push(k); }
      return { fixed, regressed, absentInTarget: absent };
    };
    const added = [...mC.keys()].filter(k => !mA.has(k));
    const failingAdded = added.filter(k => mC.get(k)!.status !== 'pass');
    const interaction = [...mA.keys()].filter(k => inCommon(k) && mB.has(k) && mC.has(k) && mD.has(k)).filter(k => (mA.get(k)!.status !== mB.get(k)!.status) !== (mC.get(k)!.status !== mD.get(k)!.status) || mB.get(k)!.status !== mD.get(k)!.status && mA.get(k)!.status === mC.get(k)!.status && mA.get(k)!.status === mB.get(k)!.status);
    methods['assertions'] = {
      counts: { A: mA.size, B: mB.size, C: mC.size, D: mD.size, addedByNewCorpus: added.length, addedFailingOnControl: failingAdded.length },
      corpusEffectControlOnCommon: diff(mA, mC, inCommon),
      productEffectOld: diff(mA, mB), productEffectNew: diff(mC, mD),
      interactionOnCommon: interaction,
    };
    const rq = (m: NonNullable<(typeof ms)[number]>) => new Set(((m.artifact as unknown as { review_queue: Array<Record<string, unknown>> }).review_queue ?? []).map(e => [e.case_id, e.peer, e.disagreement, e.variant, e.content_digest ?? e.contentDigest ?? '', e.method].join('|')));
    const [qA, qB, qC, qD] = ms.map(m => rq(m!));
    const delta = (x: Set<string>, y: Set<string>) => ({ added: [...y].filter(k => !x.has(k)).sort(), removed: [...x].filter(k => !y.has(k)).sort() });
    methods['reviewOccurrences'] = { sizes: { A: qA.size, B: qB.size, C: qC.size, D: qD.size }, productOld: delta(qA, qB), productNew: delta(qC, qD), corpusControl: delta(qA, qC) };
    methods['semanticDigests'] = Object.fromEntries((['A', 'B', 'C', 'D'] as const).map((c, i) => [c, ms[i]!.semanticDigest]));
  } else methods['skipped'] = 'a methods artifact is missing';
}

// The product-owned populations do not depend on the evidence snapshot: both corpus cells must read identically.
const populations: Record<string, unknown> = {};
for (const pop of ['regression-corpus', 'policy-corpus']) {
  const d = (['A', 'B', 'C', 'D'] as const).map(c => art(c, pop)?.semanticDigest ?? null);
  populations[pop] = { semanticDigests: { A: d[0], B: d[1], C: d[2], D: d[3] }, controlUnchangedAcrossCorpora: d[0] !== null && d[0] === d[2], candidateUnchangedAcrossCorpora: d[1] !== null && d[1] === d[3] };
}

const unexplained: string[] = [];
const cc = plain.corpusEffectControl.onCommon, cd = plain.corpusEffectCandidate.onCommon;
for (const [name, e] of [['control', cc], ['candidate', cd]] as const) for (const k of ['fixed', 'regressed', 'changed'] as const) for (const r of e[k]) unexplained.push(`corpus effect (${name}) on common case ${r.id}: ${r.from} to ${r.to}`);
for (const r of plain.productEffectOld.regressed) unexplained.push(`product regression on the old corpus: ${r.id}`);
for (const r of plain.productEffectNew.regressed) unexplained.push(`product regression on the new corpus: ${r.id}`);
for (const r of plain.productEffectOld.changed) unexplained.push(`product change (neither fixed nor worse) on the old corpus: ${r.id}`);
for (const r of plain.productEffectNew.changed) unexplained.push(`product change (neither fixed nor worse) on the new corpus: ${r.id}`);
for (const i of plain.interaction.onCommon) unexplained.push(`interaction on common case ${i.id}: ${i.old} on the old corpus, ${i.new} on the new`);
for (const [k, n] of Object.entries(peerDiffs)) if (n) unexplained.push(`peer ${k}: ${n} cases differ between the product cells`);
for (const [pop, p] of Object.entries(populations) as Array<[string, { controlUnchangedAcrossCorpora: boolean; candidateUnchangedAcrossCorpora: boolean }]>) if (!p.controlUnchangedAcrossCorpora || !p.candidateUnchangedAcrossCorpora) unexplained.push(`${pop} differs across the corpora although it does not read the snapshot`);
const ma = methods['assertions'] as { corpusEffectControlOnCommon: { fixed: string[]; regressed: string[] }; productEffectOld: { regressed: string[] }; productEffectNew: { regressed: string[] }; interactionOnCommon: string[] } | undefined;
if (ma) {
  for (const k of ma.corpusEffectControlOnCommon.fixed.concat(ma.corpusEffectControlOnCommon.regressed)) unexplained.push(`methods corpus effect (control) on a common case: ${k}`);
  for (const k of ma.productEffectOld.regressed) unexplained.push(`methods assertion regressed by the candidate on the old corpus: ${k}`);
  for (const k of ma.productEffectNew.regressed) unexplained.push(`methods assertion regressed by the candidate on the new corpus: ${k}`);
  for (const k of ma.interactionOnCommon) unexplained.push(`methods interaction on a common case: ${k}`);
}
const rest = (rows: Row[]) => ({ total: rows.length, maintainerOnly: rows.filter(r => r.maintainerOnly).length });
const report = {
  schema: 'redact-secret/candidate-2x2/v1',
  note: 'A measurement, not a decision: nothing here asserts a product result, moves a status or edits the evidence. Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): `maintainerOnly` marks a case the release records as maintainer-only (credential-evidence ADR 0020); none is independently reviewed.',
  cells: { A: 'control (published product) on the old corpus', B: 'candidate on the old corpus', C: 'control on the new corpus', D: 'candidate on the new corpus' },
  plain, peerCasesDifferingAcrossProductCells: peerDiffs, methods, populations,
  summary: {
    corpus: plain.corpus,
    productEffectOld: { fixed: plain.productEffectOld.fixed.map(r => r.id), improved: plain.productEffectOld.improved.map(r => r.id), regressed: plain.productEffectOld.regressed.length },
    productEffectNew: { fixed: plain.productEffectNew.fixed.map(r => r.id), improved: plain.productEffectNew.improved.map(r => r.id), regressed: plain.productEffectNew.regressed.length, changed: plain.productEffectNew.changed.length, maintainerOnly: rest(plain.productEffectNew.fixed) },
    addedCaseOutcomesOnControl: plain.corpusEffectControl.addedOutcomes, addedCaseOutcomesOnCandidate: plain.corpusEffectCandidate.addedOutcomes,
    interactionOnCommonCases: plain.interaction.onCommon.length, unexplained: unexplained.length,
  },
  unexplained,
};
writeFileSync(need('out-json'), `${JSON.stringify(report, null, 1)}\n`);
if (option('out-md')) {
  const s = report.summary, t = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ');
  const list = (rows: Row[]) => rows.length ? rows.map(r => `- \`${r.id}\`: ${r.from} to ${r.to}${r.maintainerOnly ? ' (maintainer-only evidence)' : ''}`).join('\n') : '- none';
  writeFileSync(option('out-md')!, [
    '# Product candidate on the old and the new evidence: the 2x2 (#698)', '',
    report.note, '',
    '| | old corpus | new corpus |', '| --- | --- | --- |', `| control (published) | A | C |`, `| candidate (unpublished) | B | D |`, '',
    `Corpus: ${plain.corpus.oldCases} to ${plain.corpus.newCases} cases (added ${plain.corpus.added}, removed ${plain.corpus.removed}, changed ${plain.corpus.changed}, common ${plain.corpus.common}).`, '',
    '## Corpus effect (control, A to C)', '',
    `On the ${plain.corpus.common} common cases: ${cc.fixed.length + cc.regressed.length + cc.changed.length} differ (fixed ${cc.fixed.length}, regressed ${cc.regressed.length}, changed ${cc.changed.length}).`,
    `On the ${plain.corpus.changed} changed cases: fixed ${plain.corpusEffectControl.onChanged.fixed.length}, regressed ${plain.corpusEffectControl.onChanged.regressed.length}, changed ${plain.corpusEffectControl.onChanged.changed.length}.`, '',
    `Added cases on the control: ${t(plain.corpusEffectControl.addedOutcomes)}; on the candidate: ${t(plain.corpusEffectCandidate.addedOutcomes)}. Pending and not-measured cases are in no denominator.`, '',
    '### Changed cases on the control', '', list([...plain.corpusEffectControl.onChanged.fixed, ...plain.corpusEffectControl.onChanged.regressed, ...plain.corpusEffectControl.onChanged.changed]), '',
    '### Added cases the control fails', '', list(plain.corpusEffectControl.addedFailing), '',
    '## Product effect (control to candidate)', '',
    `Old corpus (A to B): fixed ${plain.productEffectOld.fixed.length}, improved ${plain.productEffectOld.improved.length}, regressed ${plain.productEffectOld.regressed.length}, changed ${plain.productEffectOld.changed.length}.`, list(plain.productEffectOld.fixed), '', 'Improved (passing before and after, fewer unexpected findings or less collateral):', list(plain.productEffectOld.improved), '',
    `New corpus (C to D): fixed ${plain.productEffectNew.fixed.length}, improved ${plain.productEffectNew.improved.length}, regressed ${plain.productEffectNew.regressed.length}, changed ${plain.productEffectNew.changed.length}.`, list(plain.productEffectNew.fixed), '', 'Improved:', list(plain.productEffectNew.improved),
    ...(plain.productEffectNew.regressed.length ? ['', '### Regressions on the new corpus', '', list(plain.productEffectNew.regressed)] : []), '',
    '## Interaction', '', `On the common cases the product effect differs between the corpora in ${plain.interaction.onCommon.length} cases. Only on the new corpus (not separable from the corpus): ${plain.interaction.onlyOnNew.changed} changed and ${plain.interaction.onlyOnNew.added} added cases.`, '',
    '## Methods run', '', '```json', JSON.stringify(methods, (k, v) => (Array.isArray(v) && v.length > 12 ? [...v.slice(0, 12), `... ${v.length - 12} more`] : v), 1), '```', '',
    '## Unexplained', '', unexplained.length ? unexplained.map(u => `- ${u}`).join('\n') : 'none: every difference is an added or changed case, or the product change itself.', '',
  ].join('\n'));
}
console.error(`unexplained ${unexplained.length}; productEffectNew fixed ${plain.productEffectNew.fixed.length}, regressed ${plain.productEffectNew.regressed.length}; interaction ${plain.interaction.onCommon.length}`);
if (args.includes('--strict') && unexplained.length) process.exit(1);
