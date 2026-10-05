/**
 * The candidate diff and the saved-baseline comparison from validated RunArtifacts (#657), not from the legacy engine.
 *
 *   npm run qualification:candidate-diff -- --candidate <id> --candidate-dir <dir> [--control-archive <release>=sha256:<hex>] [--evidence-tag <tag> --manifest-digest sha256:<hex>]
 *                                           [--verify-tarballs] [--out results-output/candidate-diff-from-artifacts.json]
 *
 * <candidate-dir> holds the downloaded `candidate-run-<population>` artifacts as <population>/{artifact,run-record,product-candidate-receipt}.json (and the methods run under
 * public-evidence-snapshot/methods). The saved baseline is the control the adoption record (benchmarks/evidence-adoption.json) binds by archive digest: it is fetched with
 * `replay-archive.mjs fetch` (the digest is verified, never a directory taken on trust). --control-archive <release>=sha256:<hex> names another recorded archive (for example the
 * control a past replay was measured against).
 *
 * Refuses (exit 1, nothing written) when a candidate artifact is not exploratory and internal, is not a run of the registered candidate at its exact tarball sha256 set,
 * does not hash to its run record, or differs from the baseline in anything but the product build. --verify-tarballs additionally downloads each registered tarball from the
 * candidate's release, requires its sha256 to be the registered one, and requires the receipt to list exactly the files that tarball holds. The output is an internal,
 * allowlisted projection: it is refused under public/ or web/ and is never a recorded run. This script asserts nothing about product output. Spec: docs/specs/product-candidate-replay.md.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { buildCandidateDiff, candidateDiffArtifactProblems, METHODS_KEY, PLAIN_POPULATIONS, receiptFilesProblems, type RegisteredCandidate, type Receipt, type RunRecord, type Side } from '../benchmarks/qualification/candidate-diff.ts';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { controlFor } from './candidate-control.mjs';
import { fetchArchive } from './replay-archive.mjs';
import { candidateOf, packagesFor, readRegistry, treeDigest } from './install-product-candidate.mjs';

const usage = 'Usage: qualification:candidate-diff --candidate <id> --candidate-dir <dir> [--control-archive <release>=sha256:<hex>] [--evidence-tag <tag> --manifest-digest sha256:<hex>] [--verify-tarballs] [--out <file>]';
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flags = new Set(['verify-tarballs']);
const values: Record<string, string> = {};
for (let i = 0; i < args.length; i++) {
  const m = /^--([a-z-]+)$/.exec(args[i] ?? '');
  if (!m || !/^(candidate|candidate-dir|control-archive|evidence-tag|manifest-digest|verify-tarballs|out)$/.test(m[1])) throw new Error(usage);
  if (flags.has(m[1])) values[m[1]] = 'true';
  else { if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(usage); values[m[1]] = args[++i]; }
}
const need = (name: string) => values[name] ?? (() => { throw new Error(usage); })();
const id = need('candidate');
const candidateDir = path.resolve(need('candidate-dir'));
const out = path.resolve(values.out ?? 'results-output/candidate-diff-from-artifacts.json');
for (const forbidden of ['public', 'web', 'out']) if (!path.relative(path.join(root, forbidden), out).startsWith('..')) throw new Error(`Refusing to write a candidate diff under ${forbidden}/: it is internal and never published`);

const sha256Stream = async (file: string) => { const hash = createHash('sha256'); await pipeline(createReadStream(file), hash); return `sha256:${hash.digest('hex')}`; };
const readJson = <T>(file: string): T | undefined => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as T : undefined);

/** Read one side: records and receipts always; plain populations are parsed and schema-validated, the (very large) methods run is hashed from its bytes only. */
async function readSides(dir: string): Promise<Side[]> {
  const sides: Side[] = [];
  for (const key of [...PLAIN_POPULATIONS, METHODS_KEY]) {
    const base = path.join(dir, key);
    const record = readJson<RunRecord>(path.join(base, 'run-record.json'));
    const file = path.join(base, 'artifact.json');
    if (!record || !existsSync(file)) continue;
    const receipt = readJson<Receipt>(path.join(base, 'product-candidate-receipt.json'));
    if (key === METHODS_KEY) { sides.push({ key, record, receipt, artifactDigest: await sha256Stream(file), semanticDigest: null }); continue; }
    const read = readRunArtifact(readFileSync(file));
    sides.push({ key, record, receipt, artifact: read.artifact, artifactDigest: read.artifactDigest, semanticDigest: read.semanticDigest });
  }
  return sides;
}

const registry = readRegistry();
const candidate = candidateOf(registry, id) as RegisteredCandidate & { release: { repository: string; tag: string }; packages: { name: string; file: string; sha256: string; size: number; platform: string | null }[] };
const adoption = controlFor(JSON.parse(readFileSync(path.join(root, 'benchmarks/evidence-adoption.json'), 'utf8')), { evidenceTag: values['evidence-tag'], manifestDigest: values['manifest-digest'] });
const named = values['control-archive']?.split('=');
const archive = (named ? { release: named[0], sha256: named[1] } : adoption.replay.archive) as { release: string; sha256: string };
const scratch = mkdtempSync(path.join(os.tmpdir(), 'candidate-diff-'));
try {
  const controlDir = path.join(scratch, 'control');
  fetchArchive({ release: archive.release, sha256: archive.sha256, out: controlDir, repository: REPOSITORY });
  const input = { candidate, control: { archive, product: { version: adoption.product.version as string }, sides: await readSides(controlDir) }, candidateSides: await readSides(candidateDir) };
  const diff = buildCandidateDiff(input);
  const shape = candidateDiffArtifactProblems(diff);
  if (shape.length) throw new Error(`the candidate diff is not what it says: ${shape.join('; ')}`);

  if (values['verify-tarballs']) {
    // The exact tarball digests: download what the registry registers, hash it, extract it the way the install does and compare every file with the receipt.
    const installed: { name: string; tarballSha256: string; files: { path: string; sha256: string }[] }[] = [];
    for (const p of packagesFor(candidate, candidate.platform)) {
      execFileSync('gh', ['release', 'download', candidate.release.tag, '-R', candidate.release.repository, '-p', p.file, '-D', scratch, '--clobber'], { stdio: ['ignore', 'ignore', 'inherit'] });
      const tarball = path.join(scratch, p.file);
      const digest = await sha256Stream(tarball);
      if (digest !== p.sha256) throw new Error(`${p.file} has digest ${digest}, the registry pins ${p.sha256}`);
      const into = path.join(scratch, `extract-${p.name.replace(/\W/g, '_')}`);
      mkdirSync(into, { recursive: true });
      execFileSync('tar', ['-xzf', tarball, '-C', into, '--strip-components=1']);
      installed.push({ name: p.name, tarballSha256: digest, files: treeDigest(into) });
    }
    const problems = input.candidateSides.flatMap(s => (s.receipt ? receiptFilesProblems(s.receipt, installed).map(x => `${s.key}: ${x}`) : []));
    if (problems.length) throw new Error(`the receipts do not match the registered tarballs: ${problems.slice(0, 10).join('; ')}`);
  }

  mkdirSync(path.dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(diff, null, 1)}\n`);
  renameSync(temporary, out);
  for (const p of diff.populations) console.log(`${p.population}: ${p.cases} cases, fixed ${p.fixed}, regressed ${p.regressed}, changed ${p.changed}, unchanged ${p.unchanged}, still failing ${p.stillFailing}`);
  console.log(`Candidate diff ${id} (internal, exploratory) against baseline ${archive.release}: worsened=${diff.worsened}; wrote ${path.relative('.', out)}`);
} catch (error) {
  console.error(`candidate diff refused: ${(error as Error).message}`);
  process.exitCode = 1;
} finally { rmSync(scratch, { recursive: true, force: true }); }
