#!/usr/bin/env node
// Transport verification never executes a scanner or changes measurement pins.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSUMER_PIN, sha256, validateSourceBuiltConsumerReceipt } from './lib/pii-evidence-contract.mjs';
import { verifyArchiveMembers } from './fetch-pii-eval-public-synthetic.mjs';
import { same } from './lib/pii-evidence-comparison-plan.mjs';

const fail = code => { throw new Error(`evidence-input-refusal: ${code}`); };
const api = (endpoint, binary = false) => execFileSync('gh', ['api', endpoint],
  { encoding: binary ? null : 'utf8', maxBuffer: 48 * 1024 * 1024, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
const jsonApi = endpoint => JSON.parse(api(endpoint));
function output(key, value) {
  if (/[\r\n]/.test(value)) fail('unsafe-output-path');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
export function verifyEvidenceEngineMetadata(run, artifact, now = Date.now()) {
  const pin = CONSUMER_PIN, expected = pin.executionEngine;
  if (run?.id !== expected.workflow.runId || run.run_attempt !== 1 || run.path !== expected.workflow.path || run.event !== 'push' ||
      run.head_branch !== 'main' || run.head_sha !== pin.source.commit || run.status !== 'completed' || run.conclusion !== 'success' ||
      run.repository?.full_name !== pin.source.repository || run.head_repository?.full_name !== pin.source.repository) fail('engine-run-mismatch');
  if (artifact?.id !== expected.archive.id || artifact.name !== expected.archive.name || artifact.digest !== `sha256:${expected.archive.sha256}` ||
      artifact.size_in_bytes !== 1488951 || artifact.expired !== false || artifact.expires_at !== '2026-11-06T14:33:13Z' ||
      Date.parse(artifact.expires_at) <= now || artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha)
    fail('engine-archive-mismatch');
}
export function verifyEvidenceBuildInfo(members) {
  const pin = CONSUMER_PIN, info = JSON.parse(members['build-info.json']);
  const expected = { binary: { bytes: 4593560, name: 'pii-eval', sha256: pin.executionEngine.binarySha256, version: 'pii-eval 0.0.0 (bootstrap)' },
    commit: pin.source.commit, event: 'push', headSha: pin.source.commit, ref: 'refs/heads/main', repository: pin.source.repository,
    runAttempt: '1', runId: String(pin.executionEngine.workflow.runId), schema: 'pii-eval-build-info/1', target: 'linux-x86_64',
    toolchain: { cargoLockSha256: pin.source.cargoLockSha256, rustToolchainFileSha256: pin.source.rustToolchainFileSha256,
      rustc: pin.evidenceConsumer.canonicalLinux.rustc } };
  if (!same(info, expected) || members['pii-eval'].length !== expected.binary.bytes ||
      members.SHA256SUMS.toString() !== `${pin.executionEngine.archive.members['build-info.json']}  build-info.json\n${pin.executionEngine.binarySha256}  pii-eval\n`)
    fail('engine-build-info-mismatch');
}
export function fetchEvidenceEngine({ out, readJson = jsonApi, readBinary = endpoint => api(endpoint, true) }) {
  if (existsSync(out)) fail('output-exists');
  const pin = CONSUMER_PIN, repo = pin.source.repository;
  const run = readJson(`repos/${repo}/actions/runs/${pin.executionEngine.workflow.runId}`);
  const artifact = readJson(`repos/${repo}/actions/artifacts/${pin.executionEngine.archive.id}`);
  verifyEvidenceEngineMetadata(run, artifact);
  const bytes = readBinary(`repos/${repo}/actions/artifacts/${artifact.id}/zip`);
  if (sha256(bytes) !== pin.executionEngine.archive.sha256) fail('engine-archive-digest');
  mkdirSync(out, { recursive: true }); const zip = join(out, 'engine.zip'); writeFileSync(zip, bytes);
  const members = verifyArchiveMembers(zip, { ...pin.executionEngine.archive, name: artifact.name });
  verifyEvidenceBuildInfo(members);
  for (const [name, body] of Object.entries(members)) writeFileSync(join(out, name), body, { flag: 'wx' });
  chmodSync(join(out, 'pii-eval'), 0o555); output('engine', join(out, 'pii-eval'));
  return join(out, 'pii-eval');
}

// Extract regular files only. Upstream skill symlinks are unrelated to compilation;
// refusing links everywhere else avoids archive escapes and unpinned build inputs.
const sourceScript = `import sys,tarfile,pathlib,hashlib
archive,root,mode=sys.argv[1:]
root=pathlib.Path(root)
with tarfile.open(archive,'r:gz') as tar:
 members=tar.getmembers()
 if len(members)>5000: raise ValueError('source-member-limit')
 seen=set(); total=0
 for m in members:
  parts=pathlib.PurePosixPath(m.name).parts
  if not parts or parts[0]!='redact-secret-pii-eval-e99128f' or any(x in ('.','..') for x in parts) or m.name.startswith('/') or '\\\\' in m.name: raise ValueError('source-path')
  rel=pathlib.PurePosixPath(*parts[1:])
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
export function verifyEvidenceSource(source, archive) {
  if (sha256(readFileSync(archive)) !== CONSUMER_PIN.source.sourceArchiveSha256) fail('source-archive-digest');
  try { execFileSync('python3', ['-c', sourceScript, archive, source, 'verify'], { timeout: 30_000, stdio: 'pipe' }); }
  catch { fail('source-tree-mismatch'); }
  for (const [name, expected] of Object.entries({ 'Cargo.lock': CONSUMER_PIN.source.cargoLockSha256,
    'rust-toolchain.toml': CONSUMER_PIN.source.rustToolchainFileSha256,
    'tools/pii-evidence/fetch-snapshot.mjs': CONSUMER_PIN.source.fetchHelperSha256,
    'crates/pii-eval-adapters/shims/node/redact-secret-core.mjs': CONSUMER_PIN.source.shimSha256 }))
    if (sha256(readFileSync(join(source, name))) !== expected) fail('source-member-digest');
}
export function fetchEvidenceSource({ out, readBinary = endpoint => api(endpoint, true) }) {
  if (existsSync(out)) fail('output-exists');
  const bytes = readBinary(`repos/${CONSUMER_PIN.source.repository}/tarball/${CONSUMER_PIN.source.commit}`);
  if (sha256(bytes) !== CONSUMER_PIN.source.sourceArchiveSha256) fail('source-archive-digest');
  mkdirSync(out, { recursive: true }); const archive = join(out, 'source.tar.gz'), source = join(out, 'source');
  writeFileSync(archive, bytes); mkdirSync(source);
  try { execFileSync('python3', ['-c', sourceScript, archive, source, 'extract'], { timeout: 30_000, stdio: 'pipe' }); }
  catch { fail('source-archive-unsafe'); }
  verifyEvidenceSource(source, archive); output('source', source); output('archive', archive);
  return { source, archive };
}
export function sealEvidenceImporter({ source, binary, out, archive = join(dirname(source), 'source.tar.gz') }) {
  if (process.platform !== 'linux' || process.arch !== 'x64') fail('linux-build-receipt-required');
  verifyEvidenceSource(source, archive);
  const rustc = execFileSync('rustc', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim();
  const pin = CONSUMER_PIN;
  const receipt = validateSourceBuiltConsumerReceipt({ schema: 'pii-evidence-consumer-build-receipt/1', sourceCommit: pin.source.commit,
    sourceArchiveSha256: sha256(readFileSync(archive)), cargoLockSha256: sha256(readFileSync(join(source, 'Cargo.lock'))),
    rustToolchainFileSha256: sha256(readFileSync(join(source, 'rust-toolchain.toml'))), rustc,
    command: pin.evidenceConsumer.canonicalLinux.command, platform: 'linux-x64', binarySha256: sha256(readFileSync(binary)) });
  writeFileSync(out, JSON.stringify(receipt, null, 1) + '\n', { flag: 'wx' }); return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => { const value = process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3); if (!value) fail(`missing-${name}`); return resolve(value); };
  switch (process.argv[2]) {
    case 'fetch-engine': fetchEvidenceEngine({ out: arg('out') }); break;
    case 'fetch-source': fetchEvidenceSource({ out: arg('out') }); break;
    case 'seal-importer': sealEvidenceImporter({ source: arg('source'), binary: arg('binary'), out: arg('out') }); break;
    default: fail('unknown-command');
  }
}
