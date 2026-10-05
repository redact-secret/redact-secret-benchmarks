#!/usr/bin/env node
/**
 * Render the per-stage timing table of one official-runs job (#707) as GitHub-flavoured markdown.
 *
 *   node scripts/stage-timing-summary.mjs --timings <stage-timings.tsv> --title <text> [--note <text>]...
 *
 * Input rows are "<stage>\t<seconds>\t<exit status>" written by scripts/ci-stage.sh. The table lists each stage in run order
 * with its seconds and result, and a total; it carries timings only, never scanner output or secret material.
 */
import { existsSync, readFileSync } from 'node:fs';

export function renderStageSummary(rows, title, notes = []) {
  const lines = [`### ${title}`, ''];
  for (const note of notes) lines.push(`- ${note}`);
  if (notes.length) lines.push('');
  lines.push('| Stage | Seconds | Result |', '| --- | ---: | --- |');
  let total = 0;
  for (const { name, seconds, status } of rows) {
    total += seconds;
    lines.push(`| ${name} | ${seconds} | ${status === 0 ? 'ok' : `failed (exit ${status})`} |`);
  }
  lines.push(`| **Total** | **${total}** | |`, '');
  return lines.join('\n');
}

export function parseTimings(text) {
  return text.split('\n').filter(Boolean).map(line => {
    const [name, seconds, status] = line.split('\t');
    return { name, seconds: Number(seconds), status: Number(status) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; };
  const notes = args.flatMap((a, i) => (a === '--note' ? [args[i + 1]] : []));
  const file = value('--timings');
  const rows = file && existsSync(file) ? parseTimings(readFileSync(file, 'utf8')) : [];
  process.stdout.write(renderStageSummary(rows, value('--title') ?? 'Stage timings', notes));
}
