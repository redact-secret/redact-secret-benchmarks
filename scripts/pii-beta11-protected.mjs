/**
 * Beta.11 PII protected partition (benchmarks #428): the custodian's commands. See holdout/PII-CUSTODIAN.md.
 *
 *   npm run pii:beta11:protected -- validate --input=holdout/generated/pii-b11-input.json
 *   npm run pii:beta11:protected -- seal --input=holdout/generated/pii-b11-input.json --review=reviewed
 *   npm run pii:beta11:protected -- run --core-commit=<40-hex> --family=<family> --seal=holdout/pii-b11-<id>-seal.json
 *   npm run pii:beta11:protected -- resolve --core-commit=<40-hex> --family=<family> --decision=accepted|rejected --custodian=<name> --reviewer=<name>
 *   npm run pii:beta11:protected -- disposition --core-commit=<40-hex> [--seal=holdout/pii-b11-<id>-seal.json]
 *
 * `run` freezes the exact candidate before any protected byte is read: the #428 freeze and report for --core-commit
 * (committed), the frozen core/node/Wasm tarballs and every Wasm payload including `_pii` (redact-secret#937), the
 * identity-seam binary, the per-family selectors and pii-context/v2 activation identities, the lockfile and the clean
 * benchmark revision. It refuses, without spending the budget, a family whose #428 public gates already failed.
 * Output is the allowlisted aggregate only; errors print a code, never case content.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { HoldoutError } from '../holdout/storage.ts';
import { B11_CURRENT_PLAN_SET, B11_FAMILIES, B11_PLAN_SETS } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { B11P_BETA11_CORE_COMMIT, b11ProtectedCandidatePlan, b11ProtectedCounts, b11ProtectedFamilySlug, b11ProtectedFindingType,
  b11ProtectedPublicGates, assertB11ReportBinding, buildB11ProtectedDisposition, buildB11ProtectedTrust, readB11ProtectedInput,
  runB11ProtectedFamily, sealB11ProtectedInput, validateB11ProtectedAggregate, validateB11ProtectedSeal } from '../benchmarks/evaluation/domains/pii/beta11-protected.ts';
import { b11ProfileCostAcceptance } from '../benchmarks/evaluation/domains/pii/profile-cost-acceptance.ts';
import { installCandidate, removeCandidate } from '../scanners/candidate.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileSha256 = async file => sha256(await readFile(file));
const git = async (...argv) => (await exec('git', argv, { cwd: root, maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
const tracked = async file => { try { await git('ls-files', '--error-unmatch', path.relative(root, file)); return true; } catch { return false; } };
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));

const [command, ...rest] = process.argv.slice(2);
const args = {};
let fileVersion = null;
function parseArguments() {
  for (const argument of rest) {
    const match = /^--(input|review|core-commit|family|seal|plan-set|work|output|decision|custodian|reviewer|reviewed-at)=(.+)$/.exec(argument);
    if (!match || match[1] in args) throw new HoldoutError('invalid-arguments');
    args[match[1]] = match[2];
  }
  const planSet = args['plan-set'] ?? B11_CURRENT_PLAN_SET;
  if (!Object.hasOwn(B11_PLAN_SETS, planSet)) throw new HoldoutError('invalid-plan-set');
  fileVersion = B11_PLAN_SETS[planSet].fileVersion;
}

function evidencePaths() {
  const commit = args['core-commit'];
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new HoldoutError(`core-commit-required:beta.11-candidate-is-${B11P_BETA11_CORE_COMMIT}`);
  const dir = path.join(root, 'evidence/901/428', `core-${commit.slice(0, 12)}`);
  return { commit, dir, freeze: path.join(dir, `pii-beta11-freeze-${fileVersion}.json`), report: path.join(dir, `pii-beta11-report-${fileVersion}.json`),
    disposition: path.join(dir, `pii-beta11-disposition-${fileVersion}.json`), protectedDir: path.join(dir, 'protected'),
    protectedDisposition: path.join(dir, `pii-beta11-protected-disposition-${fileVersion}.json`) };
}
/** Maintainer acceptance of the profile-cost gate for this report (benchmarks/accepted-pii-profile-cost.json), or null. */
async function costAcceptanceFor(paths, report) {
  const file = name => path.join(paths.dir, `pii-profile-cost-v2-${name}.json`);
  const names = ['runs', 'candidate', 'size'];
  const profileCost = names.every(name => existsSync(file(name))) ?
    Object.fromEntries(await Promise.all(names.map(async name => [name, await readJson(file(name))]))) : null;
  const acceptance = b11ProfileCostAcceptance({ report, profileCost });
  return acceptance.status === 'none' ? null : acceptance;
}
const familyArg = () => {
  if (!B11_FAMILIES.includes(args.family)) throw new HoldoutError('family-required');
  return args.family;
};
const runFiles = (paths, family) => ({ aggregate: path.join(paths.protectedDir, `${b11ProtectedFamilySlug(family)}-aggregate-v1.json`),
  trust: path.join(paths.protectedDir, `${b11ProtectedFamilySlug(family)}-trust-resolution-v1.json`) });

// ---------------------------------------------------------------------------------------------------------------
// Candidate surfaces (same install and lane recipe as scripts/pii-beta11.mjs, which is frozen and cannot be edited)
// ---------------------------------------------------------------------------------------------------------------
const utf8Offset = (input, offset) => Buffer.byteLength(input.slice(0, offset), 'utf8');
function outsidePreserved(input, result) {
  const findings = [...result.findings].sort((a, b) => a.start - b.start);
  let cursor = 0, at = 0;
  for (const finding of [...findings, { start: input.length, end: input.length }]) {
    const segment = input.slice(cursor, finding.start), index = result.text.indexOf(segment, at);
    if (index < 0) return false;
    at = index + segment.length; cursor = Math.max(cursor, finding.end);
  }
  return findings.length > 0 || result.text === input;
}
function observeRows(module, family, rows) {
  const findingType = b11ProtectedFindingType(family);
  return rows.map(row => {
    const scan = module.scan(row.text);
    const findings = scan.map(finding => ({ ...finding, start: utf8Offset(row.text, finding.start), end: utf8Offset(row.text, finding.end) }));
    const result = module.scanAndRedact(row.text);
    const shape = list => JSON.stringify(list.map(f => [f.type, f.start, f.end, f.action]));
    const target = row.ranges[0] ?? null, bytes = Buffer.from(row.text, 'utf8');
    const otherPii = findings.filter(f => f.detector === 'pii-domain' && f.type !== findingType);
    return { id: row.id, family: findings.filter(f => f.type === findingType).map(f => [f.start, f.end, f.action]),
      otherPii: [...new Set(otherPii.map(f => f.type))].sort(),
      otherPiiAtTarget: Boolean(target) && otherPii.some(f => f.start < target.end && target.start < f.end),
      credential: findings.filter(f => f.detector !== 'pii-domain').length,
      ranges: row.ranges.map(range => [range.start, range.end, result.text.includes(bytes.subarray(range.start, range.end).toString('utf8'))]),
      outsidePreserved: outsidePreserved(row.text, result), scanRedactAgree: shape(result.findings) === shape(scan) };
  });
}
async function withSurface(tarballs, surface, selectors, body) {
  const installation = await installCandidate(tarballs);
  try {
    if (surface === 'node-wasm') {
      const scope = path.join(installation.root, 'node_modules', '@redact-secret');
      for (const entry of await readdir(scope)) if (entry.startsWith('node-')) await rm(path.join(scope, entry), { recursive: true, force: true });
    }
    const module = await import(`${pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href}?b11p=${surface}-${Date.now()}-${Math.random()}`);
    await (selectors.length ? module.initialize({ pii: selectors }) : module.initialize());
    const artifact = typeof module.artifact === 'function' ? module.artifact() : null;
    if (artifact !== (surface === 'node-wasm' ? 'wasm' : 'addon')) throw new Error('surface-mismatch');
    return await body(module, artifact);
  } finally { await removeCandidate(installation); }
}
async function wasmPayloads(tarball) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pii-b11p-wasm-'));
  try {
    await exec('tar', ['-xzf', tarball, '-C', directory]);
    const rows = [];
    for (const name of (await readdir(path.join(directory, 'package'))).filter(file => file.endsWith('.wasm')).sort())
      rows.push({ file: name, sha256: await fileSha256(path.join(directory, 'package', name)) });
    return rows;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

// ---------------------------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------------------------
async function validate() {
  if (!args.input) throw new HoldoutError('input-required');
  const input = await readB11ProtectedInput(path.resolve(args.input));
  console.log(`PASS: ${input.cases.length} cases`);
  for (const [family, views] of Object.entries(b11ProtectedCounts(input.cases)))
    for (const [view, count] of Object.entries(views))
      console.log(`${family} ${view}: cases ${count.cases}, sensitive ${count.sensitive}, non-sensitive ${count.nonSensitive}, ` +
        `not-established ${count.notEstablished}, benign axes ${count.benignAxes}, twin pairs ${count.twinPairs}`);
  const present = new Set(input.cases.map(row => row.family));
  const absent = B11_FAMILIES.filter(family => !present.has(family));
  if (absent.length) console.log(`not authored (recorded unspent: no-sealed-corpus): ${absent.join(', ')}`);
}

async function seal() {
  if (!args.input) throw new HoldoutError('input-required');
  const { sealFile, record } = await sealB11ProtectedInput({ inputFile: path.resolve(args.input), holdoutDirectory: path.join(root, 'holdout'), review: args.review });
  console.log(`Sealed ${record.families.length} famil${record.families.length === 1 ? 'y' : 'ies'}, one attempt each.`);
  console.log(`Commit only these metadata files: ${[path.relative(root, sealFile), ...record.families.map(row => `holdout/${row.manifest}`)].join(' ')}`);
}

async function run() {
  const paths = evidencePaths(), family = familyArg();
  if (!args.seal) throw new HoldoutError('seal-required');
  const sealFile = path.resolve(args.seal);
  const output = path.resolve(args.output ?? runFiles(paths, family).aggregate);
  if (existsSync(output)) throw new HoldoutError('output-exists');
  // Freeze everything below before the lifecycle opens protected bytes.
  if (await git('status', '--porcelain')) throw new HoldoutError('benchmark-tree-dirty:commit-the-seal-record-and-manifests-first');
  for (const file of [paths.freeze, paths.report, sealFile]) if (!(await tracked(file))) throw new HoldoutError(`not-committed:${path.relative(root, file)}`);
  const freeze = await readJson(paths.freeze), report = await readJson(paths.report), sealRecord = validateB11ProtectedSeal(await readJson(sealFile));
  assertB11ReportBinding(freeze, report);
  for (const row of sealRecord.families) if (!(await tracked(path.join(path.dirname(sealFile), row.manifest)))) throw new HoldoutError('manifest-not-committed');
  const gates = b11ProtectedPublicGates(report, family, await costAcceptanceFor(paths, report));
  // A known public rejection is not repeated on the protected corpus (the unspent path of docs/specs/pii-populations.md).
  if (gates.notMet.length) throw new HoldoutError(`public-gates-failed:${gates.notMet.join(',')}:budget-not-spent`);
  const work = path.resolve(args.work ?? path.join(root, 'results-output/pii-beta11'), `core-${paths.commit.slice(0, 12)}`);
  const tarballs = Object.fromEntries(['core', 'node', 'wasm'].map(role => [role, path.join(work, 'npm', freeze.candidate.artifacts[role].file)]));
  const example = path.join(work, 'bin', 'pii_identity_evaluation');
  const measure = async () => {
    const head = await git('rev-parse', 'HEAD');
    if (await git('status', '--porcelain')) throw new HoldoutError('benchmark-tree-dirty');
    const artifacts = Object.fromEntries(await Promise.all(Object.entries(tarballs).map(async ([role, file]) => [role, await fileSha256(file)])));
    return b11ProtectedCandidatePlan({ coreCommit: paths.commit, family, freeze, report, seal: sealRecord, benchmarkRevision: head,
      lockfileSha256: await fileSha256(path.join(root, 'package-lock.json')),
      measured: { artifacts, wasmPayloads: await wasmPayloads(tarballs.wasm), identityExampleSha256: await fileSha256(example) } });
  };
  const { candidate, configuration } = await measure();
  const drifted = { sourceHash: '0'.repeat(64), lockHash: '0'.repeat(64), candidateArtifactHash: '0'.repeat(64) };
  const verifyCandidate = async () => { try { return (await measure()).candidate; } catch { return drifted; } };
  const scanner = {
    id: 'redact-secret-pii-b11-protected', mode: 'candidate', configuration, capabilities: { ranges: true, classification: true },
    async version() { return freeze.candidate.versionString; },
    async observe({ surface, selectors, cases }) {
      return withSurface(tarballs, surface, selectors, async (module, artifact) => ({
        activationIdentity: typeof module.piiActivation === 'function' ? module.piiActivation() : null, artifact,
        cases: observeRows(module, family, cases) }));
    },
    async seam({ family: seamFamily, cases }) {
      const jsonl = cases.map(row => JSON.stringify({ id: row.id, family: seamFamily, text: row.text, candidate: row.candidate })).join('\n') + '\n';
      const stdout = await new Promise((resolve, reject) => {
        const child = execFile(example, ['--family', seamFamily], { maxBuffer: 16 * 1024 * 1024 }, (error, out) => error ? reject(new Error('seam-failed')) : resolve(out));
        child.stdin.end(jsonl);
      });
      const [header, ...observations] = stdout.trim().split('\n').map(line => JSON.parse(line));
      return { header: { format: header.format, family: header.family, vocabulary: header.vocabulary, activationIdentity: header.activationIdentity },
        observations };
    },
  };
  const aggregate = await runB11ProtectedFamily({ sealFile, family, scanner, candidate, verifyCandidate });
  validateB11ProtectedAggregate(aggregate);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(aggregate, null, 2)}\n`, { mode: 0o644, flag: 'wx' });
  console.log(`${family}: run ${aggregate.status}, protected gate ${aggregate.protectedGate}. Aggregate: ${path.relative(root, output)}`);
  process.exitCode = aggregate.status === 'complete' ? 0 : 1;
}

async function resolve() {
  const paths = evidencePaths(), family = familyArg(), files = runFiles(paths, family);
  if (!['accepted', 'rejected'].includes(args.decision)) throw new HoldoutError('decision-required');
  if (existsSync(files.trust)) throw new HoldoutError('trust-resolution-exists');
  const aggregate = validateB11ProtectedAggregate(await readJson(files.aggregate));
  if (aggregate.family !== family || aggregate.binding.coreCommit !== paths.commit) throw new HoldoutError('aggregate-not-bound');
  const trust = buildB11ProtectedTrust({ aggregate, decision: args.decision, custodian: args.custodian ?? '', reviewer: args.reviewer ?? '',
    reviewedAt: args['reviewed-at'] ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
  await writeFile(files.trust, `${JSON.stringify(trust, null, 2)}\n`, { mode: 0o644, flag: 'wx' });
  console.log(`${family}: trust resolution ${trust.decision} written to ${path.relative(root, files.trust)}`);
}

async function disposition() {
  const paths = evidencePaths();
  const report = await readJson(paths.report), committed = await readJson(paths.disposition);
  const sealRecord = args.seal ? validateB11ProtectedSeal(await readJson(path.resolve(args.seal))) : null;
  const runs = [];
  for (const family of B11_FAMILIES) {
    const files = runFiles(paths, family);
    if (!existsSync(files.aggregate)) continue;
    if (!existsSync(files.trust)) throw new HoldoutError(`trust-resolution-missing:${family}`);
    runs.push({ aggregate: await readJson(files.aggregate), trust: await readJson(files.trust) });
  }
  const record = buildB11ProtectedDisposition({ report, disposition: committed, seal: sealRecord, runs, costAcceptance: await costAcceptanceFor(paths, report) });
  await writeFile(paths.protectedDisposition, `${JSON.stringify(record, null, 2)}\n`);
  if (record.costAcceptance) console.log(`profile-cost acceptance ${record.costAcceptance.acceptedBy}: ${record.costAcceptance.status}`);
  for (const row of record.families) console.log(`${row.family}: ${row.status} (protected ${row.protected.state}: ${row.protected.reason})`);
  console.log(`Wrote ${path.relative(root, paths.protectedDisposition)}`);
}

const commands = { validate, seal, run, resolve, disposition };
try {
  if (!Object.hasOwn(commands, command)) throw new HoldoutError('choose-validate-seal-run-resolve-or-disposition');
  parseArguments();
  await commands[command]();
} catch (error) {
  console.error(error instanceof HoldoutError ? `FAIL ${error.code}` : 'FAIL: operation failed; protected details suppressed.');
  process.exitCode = 1;
}
