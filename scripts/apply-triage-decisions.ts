/**
 * Apply the triage rules (benchmarks/qualification/triage-decisions.ts) to an exported triage queue (#698) and write the decided queue and a summary.
 *
 *   node --import tsx scripts/apply-triage-decisions.ts --queue <triage-queue.json> --out-json <triage.json> [--out-md <triage.md>]
 *     [--open-core-issue <url>] [--candidate <candidate-effect.json>]
 *
 * `--candidate` is the unpublished-candidate replay record ({ commit, fixed: [case ids], stillFailing: [case ids] }); without it nothing is claimed fixed.
 * Deterministic. A root cause no rule decides stays open; nothing here settles a ledger row or restores a status.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { decideAll } from '../benchmarks/qualification/triage-decisions.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const queue = readJson(option('queue') ?? (() => { throw new Error('--queue is required'); })());
const candidate = option('candidate') ? readJson(option('candidate')!) : null;
const decided = decideAll(queue.rootCauses, { openCoreIssue: option('open-core-issue'), candidate });

const tally = <T,>(items: T[], key: (t: T) => string) => { const m: Record<string, number> = {}; for (const i of items) m[key(i)] = (m[key(i)] ?? 0) + 1; return Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1))); };
const occ = (r: { occurrences: unknown[] }) => r.occurrences.length;
const summary = {
  rootCauses: decided.length, occurrences: decided.reduce((n, r) => n + occ(r), 0),
  byClassification: tally(decided, r => r.decision.classification ?? '(open)'),
  byStatus: tally(decided, r => r.decision.status),
  byKindAndClassification: tally(decided, r => `${r.kind} | ${r.decision.classification ?? '(open)'} | ${r.decision.status}`),
  byRule: tally(decided, r => r.decision.rule.replace(/^assertion\.follows-seed:.*/, 'assertion.follows-seed')),
  restingOnMaintainerOnly: { rootCauses: decided.filter(r => r.restsOnMaintainerOnlyDecision).length, byClassification: tally(decided.filter(r => r.restsOnMaintainerOnlyDecision), r => r.decision.classification ?? '(open)') },
  ledgerProposals: tally(decided.filter(r => r.decision.ledger), r => r.decision.ledger!.proposal),
  // What the proposals would mean per product family if they were ledger rows. They are NOT rows: no status moves here, and a family also has to clear its other gates.
  gateProposalsByProductFamily: (() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of decided.filter(x => x.decision.ledger)) for (const f of ((r as unknown as { productFamilies?: string[] }).productFamilies?.length ? (r as unknown as { productFamilies: string[] }).productFamilies : ['(no product family)'])) {
      const row = (m[f] ??= { occurrences: 0, resolved: 0, 'not-assertable': 0, open: 0 });
      row.occurrences += occ(r); row[r.decision.ledger!.proposal] += occ(r);
    }
    return Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1)));
  })(),
  openRootCauses: decided.filter(r => r.decision.status === 'open').length,
  // Proposed credential-evidence changes the product's classification implies. They are proposals only: the snapshot is not edited here (the evidence owner decides).
  evidenceProposals: [...new Map(decided.filter(r => r.decision.evidenceProposal).map(r => [r.seedCase, { case: r.seedCase, proposal: r.decision.evidenceProposal!, rootCauses: 0 }])).values()]
    .map(p => ({ ...p, rootCauses: decided.filter(r => r.seedCase === p.case && r.decision.evidenceProposal).length })).sort((a, b) => (a.case < b.case ? -1 : 1)),
};
const out = { schema: 'redact-secret/triage-decisions/v1', queueSource: queue.source, identity: queue.identity, disclosure: queue.disclosure, candidate, summary,
  note: 'Decisions are rules applied to recorded evidence (benchmarks/qualification/triage-decisions.ts). A root cause no rule decides is open. Ledger proposals are not ledger rows. Core classifications are the product maintainers\' (core #1199 to #1201); a "provisional scope reading" is this repository\'s reading of the product docs, not a product-owner decision.',
  rootCauses: decided.map(r => ({ id: r.id, key: r.key, kind: r.kind, seedCase: r.seedCase, family: r.family, tier: r.tier, restsOnMaintainerOnlyDecision: r.restsOnMaintainerOnlyDecision, addedInThisSnapshot: r.addedInThisSnapshot, occurrences: occ(r), ...r.decision })) };
const { rootCauses, ...head } = out;
const text = `${JSON.stringify(head, null, 1).replace(/\n}$/, `,\n "rootCauses": [\n${rootCauses.map(r => `  ${JSON.stringify(r)}`).join(',\n')}\n ]\n}`)}\n`;
if (option('out-json')) writeFileSync(option('out-json')!, text); else process.stdout.write(text);
if (option('out-md')) {
  const t = (head: string[], rows: unknown[][]) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
  writeFileSync(option('out-md')!, [
    `# Triage dispositions (#698)`, '',
    `Scanned product \`@redact-secret/core@${queue.identity.product.version}\` on credential-eval ${queue.identity.engine.version}. **Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: ${queue.disclosure.maintainerOnlyFixtures} maintainer-only fixtures, ${queue.disclosure.independentlyReviewed} independently reviewed. ${summary.restingOnMaintainerOnly.rootCauses} root causes rest on a seed case attributed to a maintainer-only record; their dispositions are not independent review.`, '',
    out.note, '',
    '## By classification', '', t(['Classification', 'Root causes'], Object.entries(summary.byClassification)), '',
    '## By kind, classification and status', '', t(['Kind | classification | status', 'Root causes'], Object.entries(summary.byKindAndClassification)), '',
    '## By rule', '', t(['Rule', 'Root causes'], Object.entries(summary.byRule)), '',
    '## Gate proposals by product family (not ledger rows; no status moves)', '', t(['Product family', 'Occurrences', 'Proposed resolved', 'Proposed not-assertable', 'Stay open'], Object.entries(summary.gateProposalsByProductFamily).map(([f, v]) => [f, v.occurrences, v.resolved, v['not-assertable'], v.open])), '',
    '## Proposed credential-evidence changes (proposals only; the adopted snapshot is not edited)', '', t(['Case', 'Proposal', 'Root causes'], summary.evidenceProposals.map(p => [`\`${p.case}\``, p.proposal, p.rootCauses])), '',
    `Open root causes: ${summary.openRootCauses}. Ledger proposals: ${JSON.stringify(summary.ledgerProposals)}.`, '',
  ].join('\n'));
}
console.error(JSON.stringify(summary.byClassification), JSON.stringify(summary.byStatus));
