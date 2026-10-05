#!/usr/bin/env node
/**
 * Render the contrast of replays of two evidence snapshots (#680, #690): runs `scripts/contrast-snapshots.ts` once per comparison (strict by semantic id) and writes the combined
 * JSON and the reviewable Markdown that `docs/generated/evidence-adoption/<tag>.contrast.{json,md}` hold, so the contrast is a command and not a hand-assembled page.
 *
 *   node scripts/render-snapshot-contrast.mjs --spec <spec.json> --out-json <file> --out-md <file> [--strict]
 *
 * spec.json: { "evidenceRelease": "snapshot-2026.10.05.2", "reading": ["...optional sentences..."],
 *   "comparisons": [{ "kind": "control: published beta.13 on alpha.5", "newer": { "label": "snapshot-2026.10.05.2 (run 1)", "dir": "<dir>" },
 *                     "older": { "label": "snapshot-2026.10.05 (run 2)", "dir": "<dir>" }, "explain": { "<case id>": "<cause>" } }] }
 * Each <dir> holds <population>/artifact.json and public-evidence-snapshot/methods/artifact.json. A difference no `explain` entry attributes is unexplained and a worse unexplained
 * outcome is a regression; with --strict the command exits 1 on either (after writing the files). Nothing here asserts a product result.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DISCLOSURE = 'Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기)';

/** Pure: a short outcome label of one measured case, as the contrast tables print it. */
export function outcomeLabel(side) {
  const m = side?.measurement;
  if (!m) return 'absent';
  if (m.type === 'positive') return ['positive', (m.span_outcomes ?? []).join('/') || null, m.collateral_bytes ? `collateral ${m.collateral_bytes}` : null, m.leaked_bytes ? `leaked ${m.leaked_bytes}` : null].filter(Boolean).join(' ');
  if (m.type === 'control') return `control ${m.flagged ? 'flagged' : 'clear'}`;
  return String(m.type);
}

/** Pure: one comparison, from the contrast tool's result. */
export function comparisonEntry(spec, result) {
  const kinds = {};
  for (const d of [...result.explainedDifferences, ...result.unexplainedDifferences]) kinds[`${d.population} ${d.kind}`] = (kinds[`${d.population} ${d.kind}`] ?? 0) + 1;
  return {
    kind: spec.kind, newer: spec.newer.label, older: spec.older.label,
    differences: result.differences, explained: result.explained, unexplained: result.unexplained, regressions: result.regressions,
    byCause: result.byCause,
    byPopulationAndKind: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => (a < b ? -1 : 1))),
    plainCases: result.explainedDifferences.concat(result.unexplainedDifferences)
      .filter(d => d.population === 'public-evidence-snapshot' && d.kind === 'case')
      .map(d => ({ scanner: d.scanner, case: d.id, cause: d.cause, before: outcomeLabel(d.before), after: outcomeLabel(d.after), expectedChanged: JSON.stringify(d.before?.expected) !== JSON.stringify(d.after?.expected) }))
      .sort((a, b) => (a.scanner + a.case < b.scanner + b.case ? -1 : 1)),
  };
}

export function renderMarkdown(tag, comparisons, reading = []) {
  const lines = [
    `# Contrast of ${tag} with the previous snapshot (#680, #690)`, '',
    `Every case, assertion and review occurrence of the newer run is compared by semantic id with the older run (\`scripts/contrast-snapshots.ts\`, \`--strict\`). A difference is attributed to the evidence change that explains it; anything else is unexplained, and a worse outcome that no evidence change explains is a regression. **${DISCLOSURE}.**`, '',
    '| Comparison | Differences | Explained | Unexplained | Regressions |', '| --- | ---: | ---: | ---: | ---: |',
    ...comparisons.map(c => `| ${c.kind}: ${c.newer} vs ${c.older} | ${c.differences} | ${c.explained} | ${c.unexplained} | ${c.regressions} |`), '',
    'The plain-population differences are listed per case below; the methods run adds the generated variants and the assertions of the same cases, all attributed to the same cause (see the data file).', '',
  ];
  for (const c of comparisons) {
    lines.push(`## ${c.kind}: ${c.newer} against ${c.older}`, '');
    lines.push(`Differences by cause: ${Object.entries(c.byCause).map(([k, v]) => `${v} x ${k}`).join('; ') || 'none'}. By population and kind: ${Object.entries(c.byPopulationAndKind).map(([k, v]) => `${k} ${v}`).join('; ') || 'none'}.`, '');
    if (c.plainCases.length) lines.push('| Scanner | Case | Before | After | Cause |', '| --- | --- | --- | --- | --- |', ...c.plainCases.map(p => `| ${p.scanner} | \`${p.case}\` | ${p.before} | ${p.after} | ${p.cause ?? '**unexplained**'} |`), '');
  }
  if (reading.length) lines.push('## Reading', '', ...reading.map(r => `- ${r}`), '');
  lines.push(`- ${comparisons.every(c => c.unexplained === 0 && c.regressions === 0) ? 'Zero unexplained differences and zero regressions in every comparison.' : 'UNEXPLAINED DIFFERENCES OR REGRESSIONS REMAIN: see the comparisons above.'}`, '');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'contrast-'));
  try {
    const spec = JSON.parse(readFileSync(option('spec'), 'utf8'));
    const comparisons = spec.comparisons.map((c, i) => {
      const explain = path.join(scratch, `explain-${i}.json`), out = path.join(scratch, `result-${i}.json`);
      writeFileSync(explain, JSON.stringify(c.explain ?? {}));
      try {
        execFileSync('node', ['--import', 'tsx', 'scripts/contrast-snapshots.ts', '--from', c.older.dir, '--to', c.newer.dir, '--label', c.kind, '--explain', explain, '--out', out], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' } });
      } catch { /* a strict failure is reported from the written result below */ }
      return comparisonEntry(c, JSON.parse(readFileSync(out, 'utf8')));
    });
    writeFileSync(option('out-json'), `${JSON.stringify({ schema: 'redact-secret/snapshot-contrast/v1', disclosure: `${DISCLOSURE}. A measurement by semantic id, not an assertion about the product.`, tool: 'scripts/contrast-snapshots.ts', comparisons }, null, 1)}\n`);
    writeFileSync(option('out-md'), renderMarkdown(spec.evidenceRelease, comparisons, spec.reading));
    const bad = comparisons.filter(c => c.unexplained || c.regressions);
    if (args.includes('--strict') && bad.length) { console.error(`contrast refused: ${bad.map(c => `${c.kind}: ${c.unexplained} unexplained, ${c.regressions} regressions`).join('; ')}`); process.exit(1); }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
