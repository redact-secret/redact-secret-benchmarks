#!/usr/bin/env node
/**
 * Retention planner for the immutable evaluation bundle directories on the bucket (#791). Plans only: it never touches S3, the workflow runs `aws s3 rm` for the ids it prints.
 *
 *   node --import tsx scripts/evaluation-bundle-retention.mjs --present=<file of bundle ids, one per line> --current=<id> [--previous=<id>] [--live=<id>]
 *
 * Prints `keep <id>` and `prune <id>` lines. Keeps the bundle just published, the bundle the live pointer named before this deployment (the rollback target) and any bundle the live pointer names now.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { retentionPlan } from './lib/evaluation-bundle-deployment.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const m = /^--([a-z]+)=(.*)$/.exec(arg); if (!m) throw new Error(`Unknown argument ${arg}`); return [m[1], m[2]]; }));
  try {
    const present = (await readFile(args.present, 'utf8')).split('\n').map(line => line.trim().replace(/\/$/, '').split('/').pop()).filter(Boolean);
    const plan = retentionPlan({ present, current: args.current, previous: args.previous || null, live: args.live || null });
    for (const id of plan.keep) console.log(`keep ${id}`);
    for (const id of plan.prune) console.log(`prune ${id}`);
    for (const id of plan.ignored) console.error(`::notice::ignoring ${id}: not a bundle id`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
