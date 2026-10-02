#!/usr/bin/env node
/**
 * Assemble the published site root (#602): the Next static export is the site, and the measured files the pages
 * and the artifact consumers fetch sit beside it under /results/. Nothing of the legacy Vite UI is built or copied.
 *
 *   dist/            <- web/out (pages, _next/static, data/, robots.txt, favicon.svg, 404.html)
 *   dist/results/    <- public/results (the measured JSON the build wrote; never committed)
 *
 * Used by publish-site.yml before it signs in, by validate.yml's web job (so the leak guards scan what would ship)
 * and locally for a dry run: `node scripts/assemble-site.mjs [--web-out web/out] [--results public/results] [--out dist]`.
 * It refuses an export that is not a site root, so a wrong BASE_PATH or a missing file fails before anything is uploaded.
 */
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exists = async file => stat(file).then(() => true, () => false);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Builds `out` from the export and the results. Returns `{ files }`; throws with every problem named. */
export async function assembleSite({ webOut, results, out }) {
  const problems = [];
  for (const required of ['index.html', 'robots.txt', 'favicon.svg', '404.html', 'evaluation/qualification/index.html', 'report/index.html']) {
    if (!(await exists(path.join(webOut, required)))) problems.push(`the export has no ${required}`);
  }
  if (await exists(path.join(webOut, 'results'))) problems.push('the export has its own results/: the measured files must be the only owner of /results/');
  if (!(await exists(path.join(results, 'run.json')))) problems.push(`${results} has no run.json: the measured files were not written`);
  if (problems.length) throw new Error(problems.join('\n'));

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(webOut, out, { recursive: true });
  await cp(results, path.join(out, 'results'), { recursive: true });

  const after = [];
  if (await exists(path.join(out, 'assets'))) after.push('the site root has an assets/ directory (legacy build output)');
  if (await exists(path.join(out, 'next'))) after.push('the site root has a next/ directory (the retired prefix)');
  let files = 0;
  for await (const file of walk(out)) {
    files += 1;
    if (!/\.(html|txt|js|css|json|svg)$/.test(file)) continue;
    // The measured JSON is data; only the export's own files are checked for the retired prefix.
    if (path.relative(out, file).startsWith(`results${path.sep}`)) continue;
    if (/["'(=]\/next\/|["']\/next["']/.test(await readFile(file, 'utf8'))) after.push(`${path.relative(out, file)} names the retired /next/ prefix`);
  }
  if (after.length) throw new Error(after.join('\n'));
  return { files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const flag = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return path.resolve(root, i >= 0 ? process.argv[i + 1] : fallback); };
  try {
    const { files } = await assembleSite({ webOut: flag('web-out', 'web/out'), results: flag('results', 'public/results'), out: flag('out', 'dist') });
    console.log(`site root assembled: ${files} files (export at /, measured files at /results/, robots.txt and favicon.svg present, no /next/ prefix)`);
  } catch (error) {
    console.error(`::error::${String(error.message).replaceAll('\n', '%0A')}`);
    process.exit(1);
  }
}
