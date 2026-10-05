/**
 * Re-check the fixed and verified records of `benchmarks/known-gaps.json` against the ACCEPTED official run (#680): read-only on the artifacts, nothing is scanned
 * again and no record status is changed. For each record the legacy fixture slugs are joined to the canonical case ids of the pinned snapshot (the content join of
 * the axis overlay), and the product scanner's outcome on each case is read from the accepted public-evidence artifact: a positive passes when every expected span is
 * EXACT, a control when it is not flagged. A record whose fixtures are not in the run's corpora is `notCovered`, one with a failing fixture is `stillFailing`;
 * both keep their status. With `--write` the result is recorded as the header's `reverification`, with `reviewedAt` set to `--checked-on`.
 *
 *   node scripts/official-run-archive.mjs fetch --out <dir>
 *   node scripts/fetch-pinned-public-snapshot.mjs --out <snapshot dir>
 *   node --import tsx scripts/verify-known-gaps.ts --artifacts <dir> --snapshot <snapshot dir>/credential-eval-corpus-snapshot.json --checked-on YYYY-MM-DD [--write]
 *
 * This repository records and never asserts product output: the header says what the run confirmed, and the lifecycle (observed, reviewed, promoted, fixed, verified)
 * stays governed by docs/decisions/2026-09-18-govern-benchmark-promotion.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { joinLegacyToSnapshot } from '../benchmarks/qualification/axis-overlay.ts';
import { LARGE_ARTIFACT_BYTES, readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
/* eslint-disable @typescript-eslint/no-explicit-any */
const gaps: any = readJson('benchmarks/known-gaps.json');
const registry: any = readJson('benchmarks/official-runs.json');
const archive: any = readJson('benchmarks/official-run-archive.json');
const snapshot = readJson(need('snapshot'));
const checkedOn = need('checked-on');
if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) throw new Error('--checked-on must be YYYY-MM-DD');
const file = path.join(path.resolve(need('artifacts')), 'public-evidence-snapshot/artifact.json');
const bytes = readFileSync(file);
const artifact: any = readRunArtifact(bytes, { forceBytes: bytes.length > LARGE_ARTIFACT_BYTES }).artifact;
const reference = registry.scanners.find((s: any) => s.id === 'redact-secret');
const product = artifact.scanners.find((s: any) => s.scanner === 'redact-secret');
if (!product) throw new Error('the accepted artifact has no redact-secret scanner');
const cases = new Map<string, any>(product.cases.map((c: any) => [c.case_id, c]));
const slugToCase: Map<string, string> = await joinLegacyToSnapshot(snapshot);
const passes = (c: any) => (c.measurement.type === 'positive' ? c.measurement.span_outcomes.every((o: string) => o === 'EXACT') : c.measurement.type === 'control' ? c.measurement.flagged === false : null);

const group = (status: 'fixed' | 'verified') => {
  const records = gaps.issues.filter((i: any) => i.status === status);
  const result = { records: records.length, allFixturesPass: 0, notCovered: [] as number[], stillFailing: [] as number[] };
  for (const record of records) {
    const found = record.fixtures.map((slug: string) => cases.get(slugToCase.get(slug) ?? '')).filter(Boolean);
    if (found.length === 0) result.notCovered.push(record.number);
    else if (found.some((c: any) => passes(c) === false)) result.stillFailing.push(record.number);
    else if (found.length === record.fixtures.length) result.allFixturesPass++;
    else result.notCovered.push(record.number);
  }
  result.notCovered.sort((a, b) => a - b); result.stillFailing.sort((a, b) => a - b);
  return result;
};
const reverification = {
  checkedOn,
  run: `https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/${archive.source.ciRun}`,
  product: `${reference.package}@${reference.version}`,
  scope: 'the fixed and verified records only; the outcomes of the accepted official run, read from its public-evidence artifact by the content join of the legacy fixtures to the snapshot cases; nothing was scanned again and no record status was changed',
  fixed: group('fixed'),
  verified: group('verified'),
  note: 'A record whose fixtures are not in the accepted run\'s corpora (notCovered) or whose fixture still fails (stillFailing) keeps its recorded status; the run neither confirms nor contradicts it. A positive passes when every expected span is EXACT, a control when it is not flagged.',
};
console.log(JSON.stringify(reverification, null, 1));
if (args.includes('--write')) {
  const next = { ...gaps, measuredVersion: reference.version, reviewedAt: checkedOn, reverification };
  const order = ['schemaVersion', 'lifecycleAuthority', 'measuredVersion', 'milestone', 'milestoneUrl', 'reviewedAt', 'reverification', 'issues'];
  writeFileSync('benchmarks/known-gaps.json', `${JSON.stringify(Object.fromEntries(order.map(k => [k, (next as any)[k]])), null, 2)}\n`);
}
