#!/usr/bin/env node
// Transport verification never executes a scanner or changes measurement pins.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSUMER_PIN, sha256, validateSourceBuiltConsumerReceipt } from './lib/pii-evidence-contract.mjs';
import { verifyArchiveMembers } from './fetch-pii-eval-public-synthetic.mjs';
import { same, readEvidenceComparisonPlan } from './lib/pii-evidence-comparison-plan.mjs';

const fail = code => { throw new Error(`evidence-input-refusal: ${code}`); };
const api = (endpoint, binary = false) => execFileSync('gh', ['api', endpoint],
  { encoding: binary ? null : 'utf8', maxBuffer: 48 * 1024 * 1024, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
const jsonApi = endpoint => JSON.parse(api(endpoint));
function output(key, value) {
  if (/[\r\n]/.test(value)) fail('unsafe-output-path');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
export function verifyEvidenceEngineMetadata(run, artifact, now = Date.now(), pin = CONSUMER_PIN) {
  const expected = pin.executionEngine;
  if (run?.id !== expected.workflow.runId || run.run_attempt !== 1 || run.path !== expected.workflow.path || run.event !== 'push' ||
      run.head_branch !== 'main' || run.head_sha !== pin.source.commit || run.status !== 'completed' || run.conclusion !== 'success' ||
      run.repository?.full_name !== pin.source.repository || run.head_repository?.full_name !== pin.source.repository) fail('engine-run-mismatch');
  if (artifact?.id !== expected.archive.id || artifact.name !== expected.archive.name || artifact.digest !== `sha256:${expected.archive.sha256}` ||
      (pin.contract.mapping.revision === 3 ? !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || artifact.size_in_bytes > 48 * 1024 * 1024 : artifact.size_in_bytes !== 1488951 || artifact.expires_at !== '2026-11-06T14:33:13Z') || artifact.expired !== false ||
      Date.parse(artifact.expires_at) <= now || artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha)
    fail('engine-archive-mismatch');
}
export function verifyEvidenceBuildInfo(members, pin = CONSUMER_PIN) {
  const info = JSON.parse(members['build-info.json']);
  const expected = { binary: { bytes: pin.executionEngine.binaryBytes ?? (pin.contract.mapping.revision === 3 ? 4672224 : 4593560), name: 'pii-eval', sha256: pin.executionEngine.binarySha256, version: 'pii-eval 0.0.0 (bootstrap)' },
    commit: pin.source.commit, event: 'push', headSha: pin.source.commit, ref: 'refs/heads/main', repository: pin.source.repository,
    runAttempt: '1', runId: String(pin.executionEngine.workflow.runId), schema: 'pii-eval-build-info/1', target: 'linux-x86_64',
    toolchain: { cargoLockSha256: pin.source.cargoLockSha256, rustToolchainFileSha256: pin.source.rustToolchainFileSha256,
      rustc: pin.evidenceConsumer.canonicalLinux.rustc } };
  if (!same(info, expected) || members['pii-eval'].length !== expected.binary.bytes ||
      members.SHA256SUMS.toString() !== `${pin.executionEngine.archive.members['build-info.json']}  build-info.json\n${pin.executionEngine.binarySha256}  pii-eval\n`)
    fail('engine-build-info-mismatch');
}
export function fetchEvidenceEngine({ out, pin = CONSUMER_PIN, readJson = jsonApi, readBinary = endpoint => api(endpoint, true) }) {
  if (existsSync(out)) fail('output-exists');
  const repo = pin.source.repository;
  const run = readJson(`repos/${repo}/actions/runs/${pin.executionEngine.workflow.runId}`);
  const artifact = readJson(`repos/${repo}/actions/artifacts/${pin.executionEngine.archive.id}`);
  verifyEvidenceEngineMetadata(run, artifact, Date.now(), pin);
  const bytes = readBinary(`repos/${repo}/actions/artifacts/${artifact.id}/zip`);
  if (sha256(bytes) !== pin.executionEngine.archive.sha256) fail('engine-archive-digest');
  mkdirSync(out, { recursive: true }); const zip = join(out, 'engine.zip'); writeFileSync(zip, bytes);
  const members = verifyArchiveMembers(zip, { ...pin.executionEngine.archive, name: artifact.name });
  verifyEvidenceBuildInfo(members, pin);
  for (const [name, body] of Object.entries(members)) writeFileSync(join(out, name), body, { flag: 'wx' });
  chmodSync(join(out, 'pii-eval'), 0o555); output('engine', join(out, 'pii-eval'));
  return join(out, 'pii-eval');
}

// Extract regular files only. Upstream skill symlinks are unrelated to compilation;
// refusing links everywhere else avoids archive escapes and unpinned build inputs.
const sourceScript = `import sys,tarfile,pathlib,hashlib
archive,root,mode,layout=sys.argv[1:]
root=pathlib.Path(root)
with tarfile.open(archive,'r:*') as tar:
 members=tar.getmembers()
 if len(members)>5000: raise ValueError('source-member-limit')
 seen=set(); total=0
 for m in members:
  parts=pathlib.PurePosixPath(m.name).parts
  if not parts or (layout=='legacy' and parts[0]!='redact-secret-pii-eval-e99128f') or any(x in ('.','..') for x in parts) or m.name.startswith('/') or '\\\\' in m.name: raise ValueError('source-path')
  rel=pathlib.PurePosixPath(*(parts if layout=='git-archive' else parts[1:]))
  if str(rel)=='.': continue
  if str(rel) in seen: raise ValueError('source-duplicate')
  seen.add(str(rel))
  if m.issym() and str(rel).startswith('.claude/skills/'): continue
  if m.isdir(): continue
  if not m.isfile() or m.size>16*1024*1024: raise ValueError('source-member-type')
  total+=m.size
  if total>64*1024*1024: raise ValueError('source-size-limit')
  body=tar.extractfile(m).read(); dest=root/str(rel)
  if mode=='extract':
   dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(body)
  elif not dest.is_file() or dest.is_symlink() or dest.read_bytes()!=body: raise ValueError('source-file-changed')
 if mode=='verify':
  for f in root.rglob('*'):
   rel=str(f.relative_to(root))
   if f.is_symlink(): raise ValueError('source-link')
   if f.is_file() and rel not in seen: raise ValueError('source-extra-file')
`;
export function verifyEvidenceSource(source, archive, pin = CONSUMER_PIN) {
  if (sha256(readFileSync(archive)) !== pin.source.sourceArchiveSha256) fail('source-archive-digest');
  try { execFileSync('python3', ['-c', sourceScript, archive, source, 'verify', pin.contract.mapping.revision === 3 ? 'git-archive' : 'legacy'], { timeout: 30_000, stdio: 'pipe' }); }
  catch { fail('source-tree-mismatch'); }
  for (const [name, expected] of Object.entries({ 'Cargo.lock': pin.source.cargoLockSha256,
    'rust-toolchain.toml': pin.source.rustToolchainFileSha256,
    'tools/pii-evidence/fetch-snapshot.mjs': pin.source.fetchHelperSha256,
    'crates/pii-eval-adapters/shims/node/redact-secret-core.mjs': pin.source.shimSha256 }))
    if (sha256(readFileSync(join(source, name))) !== expected) fail('source-member-digest');
}
export function fetchEvidenceSource({ out, pin = CONSUMER_PIN, readBinary = endpoint => api(endpoint, true) }) {
  if (existsSync(out)) fail('output-exists');
  let bytes;
  if (pin.contract.mapping.revision === 3) {
    // Only transport gets credentials. Compilation receives the verified archive tree.
    mkdirSync(out, { recursive: true });
    const gitDir = join(out, 'transport.git');
    execFileSync('git', ['init', '--bare', gitDir], { stdio: 'pipe', timeout: 10000 });
    execFileSync('git', ['-C', gitDir, '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential',
      'fetch', '--depth=1', `https://github.com/${pin.source.repository}.git`, pin.source.commit], { stdio: 'pipe', timeout: 60000 });
    bytes = execFileSync('git', ['-C', gitDir, 'archive', '--format=tar', pin.source.commit], { maxBuffer: 48 * 1024 * 1024, timeout: 30000 });
  } else bytes = readBinary(`repos/${pin.source.repository}/tarball/${pin.source.commit}`);
  if (sha256(bytes) !== pin.source.sourceArchiveSha256) fail('source-archive-digest');
  mkdirSync(out, { recursive: true }); const archive = join(out, 'source.tar.gz'), source = join(out, 'source');
  writeFileSync(archive, bytes); mkdirSync(source);
  try { execFileSync('python3', ['-c', sourceScript, archive, source, 'extract', pin.contract.mapping.revision === 3 ? 'git-archive' : 'legacy'], { timeout: 30_000, stdio: 'pipe' }); }
  catch { fail('source-archive-unsafe'); }
  verifyEvidenceSource(source, archive, pin); output('source', source); output('archive', archive);
  return { source, archive };
}
export function sealEvidenceImporter({ source, binary, out, archive = join(dirname(source), 'source.tar.gz'), pin = CONSUMER_PIN }) {
  if (process.platform !== 'linux' || process.arch !== 'x64') fail('linux-build-receipt-required');
  verifyEvidenceSource(source, archive, pin);
  const rustc = execFileSync('rustc', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim();
  const receipt = validateSourceBuiltConsumerReceipt({ schema: 'pii-evidence-consumer-build-receipt/1', sourceCommit: pin.source.commit,
    sourceArchiveSha256: sha256(readFileSync(archive)), cargoLockSha256: sha256(readFileSync(join(source, 'Cargo.lock'))),
    rustToolchainFileSha256: sha256(readFileSync(join(source, 'rust-toolchain.toml'))), rustc,
    command: pin.evidenceConsumer.canonicalLinux.command, platform: 'linux-x64', binarySha256: sha256(readFileSync(binary)) }, pin);
  writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n', { flag: 'wx' }); return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const value = process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3); if (!value) fail(`missing-${name}`); return resolve(value); };
  const pin = process.env.EVIDENCE_PLAN ? readEvidenceComparisonPlan(process.env.EVIDENCE_PLAN).consumer : CONSUMER_PIN;
  switch (process.argv[2]) {
    case 'fetch-engine': fetchEvidenceEngine({ out: arg('out'), pin }); break;
    case 'fetch-source': fetchEvidenceSource({ out: arg('out'), pin }); break;
    case 'seal-importer': sealEvidenceImporter({ source: arg('source'), binary: arg('binary'), out: arg('out'), pin }); break;
    default: fail('unknown-command');
  }
}
