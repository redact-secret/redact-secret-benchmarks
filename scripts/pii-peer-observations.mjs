#!/usr/bin/env node
// Public local observation replay. Authored truth and peer defaults are never adjusted after scanning.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildConversion, snapshotFor, manifestFor, rosterFor, variantId, semanticDigest, canonicalize, ROOT } from './lib/pii-population-conversion.mjs';
import { treeSha256 } from './lib/pii-tree-digest.mjs';
import { consume, parseStrictJson } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
const require = createRequire(import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const seal = (schema, semantic) => { const doc = { schema, schemaVersion: '1.1', semantic }; return { ...doc, semanticDigest: semanticDigest(doc) }; };
import { PEER_TYPES, PEER_CAPABILITIES, PEER_LIMITATIONS, LOCAL_PEER_ENGINE_SHA256, peerConfiguration, peerManifestConfiguration, peerConfigDigest, loadPiiPeerComparison } from '../benchmarks/evaluation/domains/pii/peer-comparison.mjs';
export { PEER_TYPES, PEER_CAPABILITIES };
export function utf8Range(text, start, end) {
  if (typeof text !== 'string' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > text.length) throw new Error('peer-range-invalid');
  // A split surrogate would invent a replacement character and shift subsequent bytes.
  const split = i => i > 0 && i < text.length && /[\uD800-\uDBFF]/.test(text[i - 1]) && /[\uDC00-\uDFFF]/.test(text[i]);
  if (split(start) || split(end) || /[\uD800-\uDFFF]/u.test(text)) throw new Error('peer-range-invalid-unicode');
  return { start: Buffer.byteLength(text.slice(0, start)), end: Buffer.byteLength(text.slice(0, end)) };
}
export function normalizeFindings(peer, text, raw) {
  if (!Object.hasOwn(PEER_TYPES, peer) || !Array.isArray(raw)) throw new Error('peer-findings-invalid');
  const unmapped = Object.create(null);
  const findings = [];
  for (const row of raw) {
    const type = peer === 'flare-redact' ? row.detector : row.type, family = typeof type === 'string' && Object.hasOwn(PEER_TYPES[peer], type) ? PEER_TYPES[peer][type] : undefined;
    if (!family) { const label = typeof type === 'string' && /^[A-Za-z][A-Za-z0-9_:-]{0,79}$/.test(type) ? type : 'unscoped-label'; unmapped[label] = (unmapped[label] ?? 0) + 1; continue; }
    const [start, end] = peer === 'flare-redact' ? [row.start, row.end] : row.position ?? [];
    const range = utf8Range(text, start, end);
    findings.push({ family, ...(family === 'pii:us:ssn' ? { jurisdiction: 'US' } : {}), range });
  }
  findings.sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end || a.family.localeCompare(b.family) || (a.jurisdiction ?? '').localeCompare(b.jurisdiction ?? ''));
  return { findings, unmapped };
}
export function peerApi(peer) {
  if (peer === 'flare-redact') { const { scan } = require('flare-redact'); return text => scan(text, { includeValues: false }); }
  if (peer === 'openredaction') { if (existsSync(join(process.cwd(), '.openredaction', 'learnings.json'))) throw new Error('peer-learning-state-present'); const { OpenRedaction } = require('@openredaction/core'); const scanner = new OpenRedaction(); return async text => (await scanner.detect(text)).detections; }
  throw new Error('unknown-peer');
}
export async function observePopulation(peer, bucket, scan, { deadline = Infinity } = {}) {
  const runs = [];
  for (let replay = 0; replay < 2; replay++) {
    const rows = [];
    for (const c of bucket.cases) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('peer-execution-budget-exhausted');
      let timer;
      try {
        const raw = await Promise.race([Promise.resolve().then(() => scan(c.text)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('peer-scan-timed-out')), Math.min(30000, remaining)); })]);
        rows.push({ variantId: variantId(c.id, 'authored'), inputDigest: hash(c.text), ...normalizeFindings(peer, c.text, raw) });
      } finally { clearTimeout(timer); }
    }
    runs.push(rows);
  }
  if (canonicalize(runs[0]) !== canonicalize(runs[1])) throw new Error('peer-replays-disagree');
  const unmapped = Object.create(null);
  for (const row of runs[0]) for (const [type, count] of Object.entries(row.unmapped)) unmapped[type] = (unmapped[type] ?? 0) + count;
  return { inputs: runs[0].map(({ unmapped: _, ...row }) => row).sort((a, b) => a.variantId.localeCompare(b.variantId)), unmapped };
}
export function verifyPeerArchive(archive, integrity, installedDir) {
  if ('sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64') !== integrity) throw new Error('peer-archive-integrity-mismatch');
  const temp = mkdtempSync(join(tmpdir(), 'pii-peer-package-'));
  try {
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    if (listing.status !== 0 || listing.stdout.trim().split('\n').some(p => !p.startsWith('package/') || p.includes('\\') || p.split('/').includes('..'))) throw new Error('peer-archive-layout-invalid');
    const extraction = spawnSync('tar', ['-xzf', archive, '-C', temp], { timeout: 30000 });
    if (extraction.status !== 0 || treeSha256(join(temp, 'package')) !== treeSha256(installedDir)) throw new Error('peer-installed-tree-differs-from-npm-archive');
    return hash(readFileSync(archive));
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
export async function runPeerReplay({ engine, out, archives, publicDir }) {
  if (existsSync(out)) throw new Error('peer-output-exists');
  if (process.platform !== 'darwin' || hash(readFileSync(engine)) !== LOCAL_PEER_ENGINE_SHA256) throw new Error('pinned-local-engine-required');
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'))), ctx = buildConversion();
  const deadline = Date.now() + 15 * 60 * 1000;
  mkdirSync(out, { recursive: true });
  const summary = { schema: 'pii-peer-local-comparison/1', mode: 'exploratory', publicOnly: true, qualified: false, supportClaims: false, engine: { commit: 'b1c097e40bad456e52f904f626cca00b69c45612', binarySha256: hash(readFileSync(engine)), platform: `${process.platform}-${process.arch}` }, peers: [] };
  const run = args => { const remaining = deadline - Date.now(); if (remaining <= 0) throw new Error('peer-execution-budget-exhausted'); const r = spawnSync(engine, args, { encoding: 'utf8', timeout: Math.min(300000, remaining), maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error('peer-engine-command-failed'); };
  for (const [peer, pkg, version] of [['flare-redact', 'flare-redact', '1.6.1'], ['openredaction', '@openredaction/core', '1.1.5']]) {
    const dir = join(ROOT, 'node_modules', pkg), installed = JSON.parse(readFileSync(join(dir, 'package.json'))), pin = lock.packages[`node_modules/${pkg}`];
    if (installed.version !== version || pin.version !== version || !pin.integrity?.startsWith('sha512-')) throw new Error('peer-package-pin-drift');
    const npmArchiveSha256 = verifyPeerArchive(archives?.[peer], pin.integrity, dir);
    const config = peerConfiguration(peer);
    const configuration = peerManifestConfiguration(peer);
    const identity = { activationDigest: peerConfigDigest('pii-eval.scanner-activation/1', configuration.activation), adapter: { adapterId: 'benchmarks-pii-peer', adapterVersion: '1.0.0', normalizationVersion: 1 }, artifactDigest: treeSha256(dir), configurationDigest: peerConfigDigest('pii-eval.scanner-parameters/1', configuration.parameters), product: { kind: 'released' }, scannerId: peer, scannerVersion: version };
    const peerSummary = { peer, version, npmIntegrity: pin.integrity, npmArchiveSha256, installedTreeSha256: identity.artifactDigest, configuration: config, limitations: PEER_LIMITATIONS[peer], capabilities: PEER_CAPABILITIES, results: [] };
    const pins = JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-eval-population-pins.json')));
    pins.build.binarySha256 = summary.engine.binarySha256;
    const artifacts = [];
    const scan = peerApi(peer);
    for (const bucket of ctx.populations) {
      const snapshot = snapshotFor(bucket, ctx), roster = rosterFor(bucket), manifest = manifestFor(snapshot, ctx), observed = await observePopulation(peer, bucket, scan, { deadline });
      manifest.semantic.scanners = [{ configuration, identity }];
      manifest.semanticDigest = semanticDigest(manifest);
      const observation = seal('pii-eval.observation-set', { capabilities: PEER_CAPABILITIES, engine: manifest.semantic.engine, inputs: observed.inputs, populationDigest: snapshot.semanticDigest, protocol: manifest.semantic.protocol, replays: { agreed: true, count: 2 }, scanner: identity, status: 'complete' });
      const dest = join(out, peer, bucket.view); mkdirSync(dest, { recursive: true });
      for (const [name, value] of Object.entries({ snapshot, manifest, observation, roster })) writeFileSync(join(dest, `${name}.json`), JSON.stringify(value, null, 1) + '\n');
      run(['replay', '--snapshot', join(dest, 'snapshot.json'), '--manifest', join(dest, 'manifest.json'), '--observation', join(dest, 'observation.json'), '--out', join(dest, 'run'), '--projection-roster', join(dest, 'roster.json'), '--projection-mode', 'exploratory']);
      run(['validate', join(dest, 'run/public-synthetic-artifact.json'), '--snapshot', join(dest, 'snapshot.json'), '--projection-roster', join(dest, 'roster.json')]);
      const text = readFileSync(join(dest, 'run/public-synthetic-artifact.json'), 'utf8'), artifact = parseStrictJson(text), ownPin = pins.populations.find(p => p.label === bucket.view);
      ownPin.artifactDigest = artifact.semanticDigest; ownPin.manifestDigest = manifest.semanticDigest; ownPin.retiredArtifactDigests = []; ownPin.retiredManifestDigests = []; ownPin.projection.mode = 'exploratory'; ownPin.scanners = [identity];
      artifacts.push({ name: bucket.view, text });
      peerSummary.results.push({ view: bucket.view, memberships: bucket.cases.length, unresolved: bucket.cases.filter(c => c.rangeless).length, snapshotDigest: snapshot.semanticDigest, unmappedTypes: observed.unmapped, artifactSha256: hash(text) });
    }
    const measurement = consume(pins, artifacts);
    if (!measurement.complete) throw new Error('peer-strict-consumer-refused');
    if (treeSha256(dir) !== identity.artifactDigest) throw new Error('peer-package-changed-during-measurement');
    const pinsText = JSON.stringify(pins, null, 1) + '\n'; peerSummary.pinsSha256 = hash(pinsText);
    writeFileSync(join(out, peer, 'pins.json'), pinsText);
    writeFileSync(join(out, peer, 'measurement.json'), JSON.stringify(measurement, null, 1) + '\n');
    summary.peers.push(peerSummary);
  }
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  if (publicDir) {
    if (existsSync(publicDir)) throw new Error('peer-public-output-exists');
    const inputs = { record: summary, populationPins: JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-eval-population-pins.json'))), populationPlan: JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-candidate-comparison/plan.json'))), pins: [], artifacts: [] };
    for (const peer of Object.keys(PEER_TYPES)) {
      inputs.pins.push({ peer, text: readFileSync(join(out, peer, 'pins.json'), 'utf8') });
      for (const bucket of ctx.populations) inputs.artifacts.push({ peer, view: bucket.view, text: readFileSync(join(out, peer, bucket.view, 'run/public-synthetic-artifact.json'), 'utf8') });
    }
    if (loadPiiPeerComparison(inputs).state !== 'recorded') throw new Error('peer-public-record-refused');
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(publicDir, 'record.json'), JSON.stringify(summary, null, 1) + '\n');
    for (const p of inputs.pins) writeFileSync(join(publicDir, `${p.peer}.pins.json`), p.text);
    for (const p of inputs.artifacts) writeFileSync(join(publicDir, `${p.peer}.${p.view}.public-synthetic-artifact.json`), p.text);
  }
  return summary;
}
export function checkPeerRecord(dir = join(ROOT, 'benchmarks/pii-peer-comparison')) {
  const record = JSON.parse(readFileSync(join(dir, 'record.json'))), populationPins = JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-eval-population-pins.json')));
  const inputs = { record, populationPins, populationPlan: JSON.parse(readFileSync(join(ROOT, 'benchmarks/pii-candidate-comparison/plan.json'))), pins: [], artifacts: [] }, ctx = buildConversion(), lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json')));
  for (const peer of Object.keys(PEER_TYPES)) {
    const row = record.peers.find(p => p.peer === peer), packageName = peer === 'flare-redact' ? peer : '@openredaction/core';
    if (row.npmIntegrity !== lock.packages[`node_modules/${packageName}`].integrity || row.version !== lock.packages[`node_modules/${packageName}`].version) throw new Error('peer-record-release-pin-mismatch');
    inputs.pins.push({ peer, text: readFileSync(join(dir, `${peer}.pins.json`), 'utf8') });
    for (const bucket of ctx.populations) {
      const result = row.results.find(p => p.view === bucket.view);
      if (result.memberships !== bucket.cases.length || result.unresolved !== bucket.cases.filter(c => c.rangeless).length) throw new Error('peer-record-authored-accounting-mismatch');
      inputs.artifacts.push({ peer, view: bucket.view, text: readFileSync(join(dir, `${peer}.${bucket.view}.public-synthetic-artifact.json`), 'utf8') });
    }
  }
  const result = loadPiiPeerComparison(inputs);
  if (result.state !== 'recorded') throw new Error(result.reason);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
  if (Object.hasOwn(flags, 'check')) { const result = checkPeerRecord(); console.log(JSON.stringify({ state: result.state, mode: result.mode, peers: result.peers.length })); }
  else {
  if (!flags.engine || !flags.out || !flags['flare-archive'] || !flags['openredaction-archive']) throw new Error('usage: --engine=PINNED_BINARY --out=FRESH_DIRECTORY --flare-archive=TGZ --openredaction-archive=TGZ');
  const options = { engine: resolve(flags.engine), out: resolve(flags.out), archives: { 'flare-redact': resolve(flags['flare-archive']), openredaction: resolve(flags['openredaction-archive']) }, ...(flags['public-dir'] ? { publicDir: resolve(flags['public-dir']) } : {}) }, prior = process.cwd(), clean = mkdtempSync(join(tmpdir(), 'pii-peer-clean-'));
  try { process.chdir(clean); const result = await runPeerReplay(options); console.log(JSON.stringify({ mode: result.mode, peers: result.peers.length, artifacts: result.peers.reduce((n, p) => n + p.results.length, 0) })); }
  finally { process.chdir(prior); rmSync(clean, { recursive: true, force: true }); }
  }
}
