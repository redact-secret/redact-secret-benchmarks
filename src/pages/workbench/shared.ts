import { statusMark, escapeHtml as e, type StatusKind } from '../../components';
import type { ChangeRow, ChangeStatus, Gate, GateStatus } from '../../evaluation-model';

const CHANGE: Record<ChangeStatus, [StatusKind, string]> = {
  improved: ['pass', 'Improved'], regressed: ['fail', 'Regressed'], held: ['pass', 'Held'], check: ['review', 'Check'], policy: ['info', 'Policy'], new: ['info', 'New'], unscored: ['not-measured', 'Unscored'],
};
const GATE: Record<GateStatus, [StatusKind, string]> = { met: ['pass', 'Met'], 'not-met': ['fail', 'Not met'], watch: ['review', 'Watch'], 'not-measured': ['not-measured', 'Not measured'] };
const n = (value: number) => value.toLocaleString('en-US');

export function changeRow(row: ChangeRow, links = false): string {
  const [kind, word] = CHANGE[row.status];
  const value = row.of == null ? `${n(row.after)} row${row.after === 1 ? '' : 's'}` : `${row.before == null ? '' : `<s>${n(row.before)}</s> → `}${n(row.after)} / ${n(row.of)}`;
  const shown = links ? row.slugs.slice(0, 8) : [];
  const list = shown.length ? `<small>${shown.map(slug => `<a href="/fixture/${e(slug)}">${e(slug.split('--')[1] ?? slug)}</a>`).join(' · ')}${row.slugs.length > shown.length ? ` · and ${n(row.slugs.length - shown.length)} more` : ''}</small>` : '';
  return `<div class="chg">${statusMark(kind, word)}<span>${e(row.label)}<small>${e(row.detail)}</small>${list}</span><span class="d">${value}</span></div>`;
}
export function gateRow(gate: Gate): string {
  const [kind, word] = GATE[gate.status];
  return `<div class="gate-row" data-gate="${e(gate.id)}">${statusMark(kind, word)}<span>${e(gate.label)}<small>${e(gate.detail)}</small></span><span class="val">${e(gate.value)}</span></div>`;
}
export const gatesSentence = (gates: Gate[]) => {
  const met = gates.filter(g => g.status === 'met' || g.status === 'watch').length, unmeasured = gates.filter(g => g.status === 'not-measured').length;
  return `${met} of ${gates.length} floors met${unmeasured ? `, ${unmeasured} not measured` : ''}. Execution only, no support claims.`;
};
