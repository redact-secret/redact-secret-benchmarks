#!/usr/bin/env node
/**
 * The paired performance run's baseline build cache (#307).
 *
 * The paired run (#303) builds the budgets' baseline commit next to the
 * candidate. The baseline commit only changes when a baseline is promoted, so
 * its build outputs are cached by commit (key: baseline commit, toolchain
 * versions, runner OS/arch, and the hash of scripts/build-core.sh and this
 * file). A cache must never silently change what is measured, so:
 *
 *   collect --core <checkout> --out <dir>
 *       Copies the build outputs (every git-ignored, untracked file outside
 *       dependency and target trees, plus the release CLI binary) into
 *       <dir>/files and writes <dir>/manifest.json: each file's sha256 and
 *       size, and the commit it was built from.
 *   restore --cache <dir> --core <checkout> --source <cache|built|shared-with-candidate>
 *           --key <cache key> --out <record.json>
 *       Verifies every file against the manifest (a missing, extra or changed
 *       file fails the run), checks the manifest's commit is the checkout's
 *       HEAD, copies the files into the checkout, and writes the record the
 *       paired evidence carries: where the baseline build came from, the
 *       cache key, and the manifest's sha256.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXCLUDED = [/(^|\/)node_modules\//, /^target\//, /(^|\/)\.venv\//, /(^|\/)__pycache__\//, /^graft\//, /^assessment-output/];
const EXTRA = ['target/release/redact-secret'];

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) { out._.push(argv[i]); continue; }
    out[argv[i].slice(2)] = argv[i + 1]; i += 1;
  }
  return out;
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const head = dir => execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

/** Every build output of one checkout, relative to it, sorted. */
export function buildOutputs(dir) {
  const listed = execFileSync('git', ['-C', dir, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\0').filter(Boolean).filter(file => !EXCLUDED.some(pattern => pattern.test(file)));
  for (const extra of EXTRA) if (existsSync(path.join(dir, extra))) listed.push(extra);
  return [...new Set(listed)].filter(file => statSync(path.join(dir, file)).isFile()).sort();
}

function collect(args) {
  const files = buildOutputs(args.core);
  if (files.length === 0) throw new Error('core-build-cache: the checkout has no build outputs');
  const manifest = { schema: 'redact-secret-benchmarks/core-build-cache-v1', commit: head(args.core), files: {} };
  for (const file of files) {
    const bytes = readFileSync(path.join(args.core, file));
    manifest.files[file] = { sha256: sha256(bytes), bytes: bytes.length };
    mkdirSync(path.dirname(path.join(args.out, 'files', file)), { recursive: true });
    copyFileSync(path.join(args.core, file), path.join(args.out, 'files', file));
  }
  writeFileSync(path.join(args.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`core-build-cache: collected ${files.length} build outputs of ${manifest.commit}`);
}

function walk(root, prefix = '') {
  return readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root, rel) : [rel];
  });
}

function restore(args) {
  const manifestText = readFileSync(path.join(args.cache, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const commit = head(args.core);
  const problems = [];
  if (manifest.commit !== commit) problems.push(`the cached build is of ${manifest.commit}, the checkout is ${commit}`);
  const present = new Set(walk(path.join(args.cache, 'files')));
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (!present.has(file)) { problems.push(`${file} is missing from the cache`); continue; }
    if (sha256(readFileSync(path.join(args.cache, 'files', file))) !== expected.sha256) problems.push(`${file} does not match its manifest digest`);
    present.delete(file);
  }
  for (const extra of present) problems.push(`${extra} is in the cache but not in its manifest`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`core-build-cache: ${problem}`);
    process.exit(1);
  }
  for (const file of Object.keys(manifest.files)) {
    mkdirSync(path.dirname(path.join(args.core, file)), { recursive: true });
    copyFileSync(path.join(args.cache, 'files', file), path.join(args.core, file));
  }
  const record = {
    source: args.source, cacheKey: args.key ?? null, commit,
    manifestSha256: sha256(manifestText), files: Object.keys(manifest.files).length,
  };
  if (args.out) writeFileSync(args.out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`core-build-cache: restored ${record.files} verified build outputs (${record.source}), manifest ${record.manifestSha256}`);
}

const args = parseArgs(process.argv.slice(2));
const commands = { collect, restore };
if (commands[args._[0]] === undefined) {
  console.error('usage: core-build-cache.mjs <collect|restore> [options]');
  process.exit(2);
}
commands[args._[0]](args);
