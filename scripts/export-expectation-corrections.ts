/**
 * Export the expectation-correction queue for credential-evidence (#698, core #1203): the cases whose evidence expectation the product's classification says does not hold on the
 * raw-input contract, with the proposed change and what it rests on. A QUEUE, never an edit: this repository does not change the evidence (the boundary rule); the evidence
 * owners decide (credential-evidence#221).
 *
 *   node --import tsx scripts/export-expectation-corrections.ts --triage <triage.json> --out-json <file> --out-md <file>
 *
 * Deterministic. The three cases core fixed (a product change, not an evidence change) are listed apart as post-release replays, never as corrections.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const triage = JSON.parse(readFileSync(option('triage') ?? (() => { throw new Error('--triage is required'); })(), 'utf8'));
type Row = { seedCase: string; kind: string; classification: string | null; status: string; disposition: string; evidence: string[]; links: string[]; evidenceProposal?: string; restsOnMaintainerOnlyDecision: boolean; occurrences: number; family: string | null };
const rows: Row[] = triage.rootCauses;
const proposals = new Map<string, Row[]>();
for (const r of rows) if (r.evidenceProposal) proposals.set(r.seedCase, [...(proposals.get(r.seedCase) ?? []), r]);
const corrections = [...proposals.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([seedCase, rs]) => ({
  case: seedCase,
  family: rs[0].family,
  proposedChange: rs[0].evidenceProposal!.replace(new RegExp(`^${seedCase.split('--').pop()}:\\s*|^${seedCase}:\\s*`), ''),
  productClassification: rs[0].classification,
  productDisposition: rs[0].disposition,
  evidence: [...new Set(rs.flatMap(r => r.evidence))],
  rootCauses: rs.length, occurrences: rs.reduce((n, r) => n + r.occurrences, 0),
  maintainerOnlyEvidence: rs.some(r => r.restsOnMaintainerOnlyDecision),
}));
const afterRelease = [...new Set(rows.filter(r => r.status === 'fixed-in-candidate').map(r => r.seedCase))].sort();
const out = {
  schema: 'redact-secret/expectation-correction-queue/v1',
  note: 'A queue for the evidence owners, not an edit: credential-evidence is not changed here and no expectation is asserted. Each entry is the product maintainers\' classification (core #1203, PR #1204) of a case whose expectation does not hold on the raw-input contract, with the proposed change. The fixed cases need no evidence change; they are listed as post-release replays.',
  identity: triage.identity,
  disclosure: triage.disclosure,
  tracking: ['https://github.com/redact-secret/credential-evidence/issues/221', 'https://github.com/redact-secret/redact-secret/issues/1203', 'https://github.com/redact-secret/redact-secret/pull/1204'],
  corrections,
  postReleaseReplays: afterRelease,
};
if (corrections.length === 0) throw new Error('no evidence proposal in the triage');
writeFileSync(option('out-json') ?? (() => { throw new Error('--out-json is required'); })(), `${JSON.stringify(out, null, 1)}\n`);
if (option('out-md')) {
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  writeFileSync(option('out-md')!, [
    '# Expectation corrections proposed to credential-evidence (#698, core #1203)', '',
    `**Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)**: ${triage.disclosure.maintainerOnlyFixtures} maintainer-only fixtures, ${triage.disclosure.independentlyReviewed} independently reviewed. These are the product maintainers' proposals; the evidence owners decide, and the evidence is not edited here. Tracking: credential-evidence#221, redact-secret#1203 and PR #1204.`, '',
    '| Case | Proposed change | Why (product disposition) | Root causes |', '| --- | --- | --- | ---: |',
    ...corrections.map(c => `| \`${c.case}\` | ${cell(c.proposedChange)} | ${cell(c.productDisposition)} | ${c.rootCauses} |`), '',
    '## Post-release replays (a product fix, no evidence change)', '',
    'Fixed in redact-secret PRs #1202 and #1204 and replayed clean on the unpublished candidate 1e45cecf; they appear in an official run only after a release carries the fix.', '',
    ...afterRelease.map(c => `- \`${c}\``), '',
  ].join('\n'));
}
console.error(`${corrections.length} expectation corrections, ${afterRelease.length} post-release replays`);
