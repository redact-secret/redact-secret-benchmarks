// Custodian-held blind evaluation runner (#142). Spec: docs/specs/blind-evaluation.md.
//
//   npm run blind:run -- freeze --candidate <benchmark-candidate output dir> [--fixtures <private root>]
//   npm run blind:run -- run    --candidate <same dir> [--fixtures <private root>] [--output <new file>]
//
// --fixtures defaults to ../redact-secret-blind-fixture beside this checkout's
// root. The released aggregate defaults to the git-ignored results-output/blind/.
//
// stdout and stderr carry only the aggregate or a rejection code. Never a
// fixture id, path, text, range or scanner finding.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import path from 'node:path';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { repositoryRoot } from './engine/provenance.ts';
import { validateAccounting } from './lib/accounting.ts';
import { BlindError, DEFAULT_FIXTURES_DIRECTORY_NAME } from './blind/storage.ts';
import { freezeBlind, runBlind, type BlindContext } from './blind/lifecycle.ts';
import type { AccountingConfig } from './types.ts';
import suite from '../qualification/suite-v1.json';

const usage = 'npm run blind:run -- freeze|run --candidate <absolute candidate dir> [--fixtures <absolute private dir>] [--output <absolute new file>]';

/** `<checkout root>/../redact-secret-blind-fixture`: a sibling of the checkout, never inside it. */
export function defaultFixturesDirectory() {
  let top = repositoryRoot;
  try { top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  return path.resolve(top, '..', DEFAULT_FIXTURES_DIRECTORY_NAME);
}

export const defaultContext: BlindContext = {
  async benchmark() {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return {
      sourceCommit: git('rev-parse', 'HEAD'), dirty: Boolean(git('status', '--porcelain')),
      lockfileSha256: createHash('sha256').update(await readFile(path.join(repositoryRoot, 'package-lock.json'))).digest('hex'),
    };
  },
  environment: () => ({ node: process.version, os: platform(), arch: arch() }),
  async load(candidate) {
    const file = (role: string) => candidate.artifacts.find(a => a.role === role)!.file;
    const installation = await installCandidate({ core: file('package'), node: file('node'), wasm: file('wasm') });
    try {
      const scanner = await loadCandidate(installation, undefined);
      if (scanner.version !== installation.declaredVersion) throw new Error('candidate-version-mismatch');
      return { packageName: installation.packageName, declaredVersion: installation.declaredVersion,
        scan: (root, fixtures) => scanner.scan(root, fixtures), dispose: () => removeCandidate(installation) };
    } catch (error) { await removeCandidate(installation); throw error; }
  },
  configuration: { ...candidateConfiguration, ruleset: null },
  replays: validateAccounting(suite.accounting as AccountingConfig).replays,
};

async function main() {
  const [action, ...rest] = process.argv.slice(2), options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = /^--(fixtures|candidate|output)$/.exec(rest[i] ?? '')?.[1];
    if (!key || key in options || rest[i + 1] === undefined) throw new BlindError('invalid-arguments');
    options[key] = rest[i + 1];
  }
  if (!options.candidate) throw new BlindError('invalid-arguments');
  options.fixtures ??= defaultFixturesDirectory();
  if (action === 'freeze') {
    if (options.output) throw new BlindError('invalid-arguments');
    const freeze = await freezeBlind({ fixtures: options.fixtures, candidate: options.candidate, context: defaultContext });
    console.log(`Frozen: candidate ${freeze.candidate.artifactSha256}, benchmark ${freeze.benchmark.sourceCommit}, epoch ${freeze.epoch}. One run is now allowed.`);
  } else if (action === 'run') {
    const { report, release } = await runBlind({ fixtures: options.fixtures, candidate: options.candidate, output: options.output,
      outputDirectory: path.join(repositoryRoot, 'results-output', 'blind'), context: defaultContext });
    console.log(JSON.stringify(report, null, 2));
    console.error(`Released aggregate: ${release}`);
    process.exitCode = report.status === 'complete' ? 0 : 1;
  } else throw new BlindError('choose-freeze-or-run');
}

main().catch(error => {
  console.error(error instanceof BlindError ? error.message : 'Blind evaluation failed; private details suppressed.');
  if (error instanceof BlindError && error.code === 'invalid-arguments') console.error(usage);
  process.exitCode = 1;
});
