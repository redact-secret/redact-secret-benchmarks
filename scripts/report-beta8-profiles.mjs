/**
 * Advisory Beta.8 fixture-profile report (#207–#212): for every target an
 * issue module declares a profile for (benchmarks/lib/beta8/*.ts), counts the
 * fixtures across every registered corpus against #206's draft floors and
 * prints the remaining debt. It reads corpora and assignments only; it runs no
 * scanner and decides no support status. #206 owns the enforced gate.
 *
 * Run: npm run beta8:profiles [-- --issue=208] [-- --json] [-- --check]
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { controlAxis, isContextGated } from '../benchmarks/lib/assessment.ts';
import { beta8Profiles } from '../benchmarks/lib/beta8/index.ts';
import { countProfile } from '../benchmarks/lib/beta8/profiles.ts';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export async function beta8ProfileCounts(issue) {
  const [categories, assignments] = await Promise.all([read('benchmarks/categories.json'), read('benchmarks/fixture-detectors.json')]);
  const generated = buildCorpora(), all = [];
  for (const category of categories) {
    const corpus = generated[category.id] ?? await read(category.corpus);
    for (const f of corpus.fixtures)
      all.push({ category: category.id, fixture: f, controlAxis: controlAxis(category.id, f),
        targets: [...(assignments[`${category.id}--${f.id}`] ?? f.detectors ?? []), ...(f.arrivalTargets ?? [])] });
  }
  return Object.entries(beta8Profiles)
    .filter(([, p]) => issue === undefined || p.issue === issue)
    .map(([target, p]) => countProfile(target, p.issue, p.profile, all, isContextGated(target)))
    .sort((a, b) => a.issue - b.issue || a.target.localeCompare(b.target));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const issueArg = process.argv.find(a => a.startsWith('--issue='));
  const counts = await beta8ProfileCounts(issueArg ? Number(issueArg.slice(8)) : undefined);
  if (process.argv.includes('--json')) console.log(JSON.stringify(counts, null, 2));
  else {
    console.log('issue  target  profile  total  pos  ctl  twins(ctx)  pos-axes  ctl-axes  debt');
    for (const c of counts)
      console.log(`#${c.issue}  ${c.target}  ${c.profile}  ${c.total}  ${c.positives}  ${c.controls}  ${c.twinPairs}(${c.contextTwinPairs})  ${c.positiveAxes.length}  ${c.controlAxes.length}  ${c.debt.join('; ') || 'none'}`);
    if (!counts.length) console.log('No Beta.8 profile declarations yet.');
  }
  if (process.argv.includes('--check') && counts.some(c => c.debt.length)) process.exitCode = 1;
}
