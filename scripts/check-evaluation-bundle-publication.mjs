#!/usr/bin/env node
/**
 * CI gate (#791): the assembled site (or a read-back of the bucket) carries one coherent, complete, public-safe evaluation bundle.
 *
 *   node --import tsx scripts/check-evaluation-bundle-publication.mjs [--dist=dist] [--no-index]
 *   node --import tsx scripts/check-evaluation-bundle-publication.mjs --readback=<results dir> --sha256=<manifest sha256>
 *
 * Site mode: no staging or internal raw file anywhere under dist; the pointer resolves to its manifest; the bundle directory holds exactly the referenced files; the whole bundle validates by streaming
 * (digests, schema, totals); the feature-dataset and blind-public rules run over every referenced file; and the domain index commits to the same manifest digest as the pointer.
 * Read-back mode (after the immutable upload, before any pointer moves): the same bundle checks over what the bucket returned, and the manifest digest must be the one the pointer will commit to.
 * Reads only; runs no scanner. Rules: docs/specs/evaluation-bundle-deployment.md.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleProblems, publicationProblems } from './lib/evaluation-bundle-deployment.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const m = /^--([a-z0-9-]+)(?:=(.*))?$/.exec(arg); if (!m) throw new Error(`Unknown argument ${arg}`); return [m[1], m[2] ?? true]; }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report;
  if (args.readback) {
    report = await bundleProblems(path.resolve(String(args.readback)), { onlyCurrentBundle: false });
    if (args.sha256 && report.pointer && report.pointer.manifest.sha256 !== args.sha256) report.problems.push('the read-back pointer commits to another manifest than the one published');
  } else {
    report = await publicationProblems(path.resolve(String(args.dist ?? 'dist')), { requireIndex: !args['no-index'] });
  }
  if (report.problems.length) {
    console.error(`Evaluation bundle publication check failed:\n${report.problems.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Evaluation bundle publication check passed: bundle ${report.pointer.bundleId} (run ${report.pointer.runId}), ${report.inspected} referenced files validated and inspected with the public exclusion rules${args.readback ? ' (read-back)' : (args['no-index'] ? ', pointer and manifest agree (domain index not checked)' : ', pointer, manifest and domain index commitment agree')}.`);
  }
}
