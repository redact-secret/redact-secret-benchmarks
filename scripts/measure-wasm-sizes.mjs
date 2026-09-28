#!/usr/bin/env node
/**
 * Measures the WebAssembly artifacts a core checkout just built, for the
 * size rows of the regression budgets (redact-secret#929). The performance
 * workflow runs it on the candidate checkout it evaluates, after the build and
 * the assessment, so the sizes are of the exact files that job measured -- never
 * a rebuild at another commit, and never the frozen #141 operational evidence.
 *
 *   node scripts/measure-wasm-sizes.mjs --core <core checkout> --source-commit <40-hex>
 *        --out <wasm-sizes.json> [--markdown-out <file>]
 *
 * Both detector profiles are required: `full` (`npm run wasm:build`,
 * bindings/wasm/pkg) and `common` (`npm run wasm:build:common`,
 * bindings/wasm/pkg-common). A missing file, or a checkout at a different
 * commit, is an error: the evaluation then marks the wasm size rows
 * invalid-measurement instead of silently skipping them.
 *
 * The `pii` variants (redact-secret#937: `<outName>_pii_bg.wasm` beside each
 * profile's default build, loaded only when `initialize()` selects PII) are
 * measured as profiles `full-pii` and `common-pii` when the checkout built
 * them. Both or neither: one without the other is an error. A commit from
 * before the split builds neither, and the evidence says so (`piiBuilds`).
 *
 * Compression matches scripts/collect-operational-evidence.mjs: gzip level 9,
 * brotli quality 11. Only gzip is budgeted; raw and brotli are recorded.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export const WASM_ARTIFACTS = [
  { profile: 'full', artifact: 'wasm-web', dir: 'bindings/wasm/pkg', file: 'redact_secret_wasm_bg.wasm' },
  { profile: 'common', artifact: 'wasm-web-common', dir: 'bindings/wasm/pkg-common', file: 'redact_secret_wasm_common_bg.wasm' },
];

/** The optional PII-runtime variants (redact-secret#937), measured only when the checkout built them. */
export const WASM_PII_ARTIFACTS = [
  { profile: 'full-pii', artifact: 'wasm-web', dir: 'bindings/wasm/pkg', file: 'redact_secret_wasm_pii_bg.wasm' },
  { profile: 'common-pii', artifact: 'wasm-web-common', dir: 'bindings/wasm/pkg-common', file: 'redact_secret_wasm_common_pii_bg.wasm' },
];

export function measureWasm(bytes) {
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    rawBytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    brotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}

export function renderMarkdown(evidence) {
  return [
    '## WebAssembly artifact sizes (candidate build)',
    '',
    `Core \`${evidence.sourceCommit}\`. gzip is budgeted (\`size/wasm/<profile>/gzip\`); raw and brotli are recorded. PII-runtime builds: ${evidence.piiBuilds ?? 'absent'}.`,
    '',
    '| Profile | File | sha256 | raw | gzip | brotli |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...evidence.artifacts.map(a => `| ${a.profile} | \`${a.file}\` | \`${a.sha256.slice(0, 12)}\` | ${a.rawBytes} | ${a.gzipBytes} | ${a.brotliBytes} |`),
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`measure-wasm-sizes: bad argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ['core', 'source-commit', 'out']) if (!args[key]) throw new Error(`measure-wasm-sizes: --${key} is required`);
  if (!/^[0-9a-f]{40}$/.test(args['source-commit'])) throw new Error('measure-wasm-sizes: --source-commit must be 40 hex');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const head = execFileSync('git', ['-C', args.core, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== args['source-commit']) {
    throw new Error(`measure-wasm-sizes: ${args.core} is at ${head}, not the candidate ${args['source-commit']}`);
  }
  const artifacts = WASM_ARTIFACTS.map(({ profile, artifact, dir, file }) => {
    const location = path.join(args.core, dir, file);
    let bytes;
    try {
      bytes = readFileSync(location);
    } catch {
      throw new Error(`measure-wasm-sizes: ${location} is missing; build it in this job before measuring (${profile} profile)`);
    }
    return { profile, artifact, file, path: path.join(dir, file), ...measureWasm(bytes) };
  });
  const pii = WASM_PII_ARTIFACTS.map(entry => ({ ...entry, location: path.join(args.core, entry.dir, entry.file) }))
    .map(entry => ({ ...entry, present: existsSync(entry.location) }));
  if (pii.some(e => e.present) && !pii.every(e => e.present)) {
    throw new Error(`measure-wasm-sizes: ${pii.find(e => !e.present).location} is missing while another pii build exists; build both profiles' pii variants`);
  }
  const piiBuilds = pii.every(e => e.present) ? 'present' : 'absent';
  if (piiBuilds === 'present') {
    for (const { profile, artifact, dir, file, location } of pii) {
      artifacts.push({ profile, artifact, file, path: path.join(dir, file), ...measureWasm(readFileSync(location)) });
    }
  }
  const evidence = { schemaVersion: '1', kind: 'wasm-artifact-sizes', sourceCommit: head, piiBuilds, artifacts };
  mkdirSync(path.dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(evidence, null, 2)}\n`);
  if (args['markdown-out']) writeFileSync(args['markdown-out'], renderMarkdown(evidence));
  for (const a of artifacts) console.log(`${a.profile}: raw ${a.rawBytes}, gzip ${a.gzipBytes}, brotli ${a.brotliBytes} (${a.sha256})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
