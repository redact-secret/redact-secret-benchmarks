#!/usr/bin/env node
/**
 * Render what an evidence CANDIDATE would change if the owner accepted it (#690, #773): the accepted view (built by `npm run qualification:view` from the
 * accepted official runs) against the candidate view (the `qualification-view` artifact of the control replay), family by family. It reads two views only; it
 * decides nothing, writes no pin, authority or acceptance, and every number is read from the views.
 *
 *   node scripts/render-view-effect.mjs --accepted <view.json> --candidate <view.json> --release <tag> --disclosure <text> --basis <text> \
 *     [--effects <json {family: effect text}>] --out-json <file> --out-md <file>
 *
 * The cause of a status or reason change (corpus, engine, roster) is NOT computed here: it is authored in `--effects` from the contrast of the same replay
 * (`snapshot-<tag>.contrast.md`); a family with no entry reads "cause: see the contrast".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const reasonText = r => (typeof r === 'string' ? r : r.reason ?? JSON.stringify(r)).split(' — ')[0];

/** Pure: the effect of the candidate view against the accepted one. */
export function viewEffect(accepted, candidate, { effects = {} } = {}) {
  const byFamily = view => new Map(view.families.map(f => [f.family, f]));
  const a = byFamily(accepted), c = byFamily(candidate);
  const statusChanges = [], reasonChangesWithoutStatusChange = [];
  for (const [family, after] of c) {
    const before = a.get(family);
    if (!before) continue;
    const ra = new Set(before.status.reasons.map(reasonText)), rc = new Set(after.status.reasons.map(reasonText));
    const added = [...rc].filter(x => !ra.has(x)).sort(), removed = [...ra].filter(x => !rc.has(x)).sort();
    if (before.status.value === after.status.value && !added.length && !removed.length) continue;
    const row = { family, before: before.status.value, after: after.status.value, reasonsAdded: added, reasonsRemoved: removed, effect: effects[family] ?? 'cause: see the contrast' };
    (before.status.value === after.status.value ? reasonChangesWithoutStatusChange : statusChanges).push(row);
  }
  const both = (key, f = x => x) => ({ accepted: f(accepted[key]), candidate: f(candidate[key]) });
  return {
    policyRevision: { accepted: accepted.policy.revision, candidate: candidate.policy.revision },
    distribution: both('distribution'),
    stableDistribution: both('stableDistribution'),
    families: both('families', x => x.length),
    unmappedFamilies: both('unmappedFamilies', x => x.length),
    undetected: both('undetected', x => x.length),
    knownGaps: both('knownGaps', x => x.length),
    statusChanges, reasonChangesWithoutStatusChange,
  };
}

const profile = d => `${d.documented} / ${d.empirical}`;
export function renderMarkdown({ release, disclosure, basis, effect: e, scannerRoster }) {
  const row = (...cells) => `| ${cells.join(' | ')} |`;
  const lost = e.statusChanges.filter(x => x.before === 'stable' && x.after !== 'stable'), gained = e.statusChanges.filter(x => x.after === 'stable' && x.before !== 'stable');
  return [
    `# View effect of ${release} if it were accepted (candidate, not accepted)`, '', disclosure, '', `Basis: ${basis}`, '',
    row('', 'Accepted (A)', 'Candidate (C)'), row('---', '---:', '---:'),
    ...['stable', 'provisional', 'pending', 'unsupported'].map(k => row(k, e.distribution.accepted[k], e.distribution.candidate[k])),
    row('stable by documented / empirical', profile(e.stableDistribution.accepted), profile(e.stableDistribution.candidate)),
    row('families in the support matrix', e.families.accepted, e.families.candidate),
    row('families the corpus names but no registry entry maps (unmapped)', e.unmappedFamilies.accepted, e.unmappedFamilies.candidate),
    row('undetected', e.undetected.accepted, e.undetected.candidate), '',
    `Policy revision: accepted \`${e.policyRevision.accepted}\`, candidate \`${e.policyRevision.candidate}\` (its derived inputs follow the corpus).`, '',
    '## Families whose status or reasons change', '',
    row('Family', 'Before', 'After', 'Reasons added', 'Reasons removed', 'Effect'), row('---', '---', '---', '---', '---', '---'),
    ...[...e.statusChanges, ...e.reasonChangesWithoutStatusChange].map(x => row(`\`${x.family}\``, x.before, x.after, x.reasonsAdded.join('; ') || 'none', x.reasonsRemoved.join('; ') || 'none', x.effect)), '',
    `${lost.length} families lose \`stable\` and ${gained.length} gain it.`, '',
    ...(scannerRoster ? ['## Scanner roster', '', scannerRoster, ''] : []),
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  const need = name => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
  const read = file => JSON.parse(readFileSync(file, 'utf8'));
  const accepted = read(need('accepted')), candidate = read(need('candidate'));
  const effects = option('effects') ? read(option('effects')) : {};
  const effect = viewEffect(accepted, candidate, { effects });
  const roster = candidate.scannerRoster?.notMeasured;
  const scannerRoster = roster ? `${(Array.isArray(roster) ? roster : [roster]).map(n => (typeof n === 'string' ? n : n.line ?? `${n.scanner ?? n.id}: not measured in this run (optional)`)).join(' ')} Measured in the candidate: ${(candidate.scannerRoster.measured ?? []).join(', ')}.` : undefined;
  const meta = { release: need('release'), disclosure: need('disclosure'), basis: need('basis') };
  writeFileSync(need('out-json'), `${JSON.stringify({ schema: 'redact-secret/adoption-view-effect/v1', evidenceRelease: meta.release, disclosure: meta.disclosure, basis: meta.basis, ...effect }, null, 2)}\n`);
  writeFileSync(need('out-md'), `${renderMarkdown({ ...meta, effect, scannerRoster })}\n`);
}
