#!/usr/bin/env node
/**
 * Gate for benchmarks/product-candidates.json (#698): the registry of unpublished product builds that candidate replays may measure.
 *
 *   node scripts/check-product-candidates.mjs [--bindings]
 *
 * Offline: the schema, a full 40-character commit, one package per name and platform, digests and sizes in shape, the exploratory/internal classes
 * (an unpublished build is never an official or public run), and that each candidate's control is the published product pin of the adoption's engine candidate.
 * `--bindings` (needs `gh`): each registered tarball exists on the candidate's release with the registered size and digest.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const SHA = /^[0-9a-f]{40}$/, DIGEST = /^sha256:[0-9a-f]{64}$/;

export function problems(registry, adoption) {
  const found = [];
  if (registry?.schema !== 'redact-secret/product-candidates/v1') return ['schema must be redact-secret/product-candidates/v1'];
  const ids = new Set();
  for (const c of registry.candidates ?? []) {
    const at = `candidate ${c.id}`;
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(c.id ?? '')) found.push(`${at}: id must be lowercase words`);
    if (ids.has(c.id)) found.push(`${at}: duplicate id`);
    ids.add(c.id);
    if (!SHA.test(c.product?.commit ?? '')) found.push(`${at}: product.commit must be a full 40-character commit`);
    if (c.product?.published !== false) found.push(`${at}: a registered candidate is unpublished (published: false); a published build is a pin, not a candidate`);
    if (c.runClass !== 'exploratory' || c.publication !== 'internal') found.push(`${at}: an unpublished build is exploratory and internal`);
    if (!c.release?.tag || !c.release?.repository) found.push(`${at}: release.repository and release.tag are required`);
    const seen = new Set();
    for (const p of c.packages ?? []) {
      const key = `${p.name}|${p.platform}`;
      if (seen.has(key)) found.push(`${at}: duplicate package ${key}`);
      seen.add(key);
      if (!DIGEST.test(p.sha256 ?? '')) found.push(`${at}: ${p.name} sha256 must be sha256:<64 hex>`);
      if (!Number.isInteger(p.size) || p.size <= 0) found.push(`${at}: ${p.name} size must be a positive integer`);
      if (!/^[A-Za-z0-9._-]+\.tgz$/.test(p.file ?? '')) found.push(`${at}: ${p.name} file must be a .tgz file name`);
    }
    for (const required of ['@redact-secret/core', '@redact-secret/wasm']) if (!(c.packages ?? []).some(p => p.name === required && p.platform === null)) found.push(`${at}: no ${required} package`);
    if (!(c.packages ?? []).some(p => p.platform === c.platform && p.name.startsWith('@redact-secret/node-'))) found.push(`${at}: no node addon package for ${c.platform}`);
    // The replay on the accepted evidence (`replay`) and on any new snapshot (`evidenceReplays[<tag>]`, with the 2x2 beside its data).
    for (const [name, r] of [...(c.replay !== undefined ? [['replay', c.replay]] : []), ...Object.entries(c.evidenceReplays ?? {}).map(([tag, v]) => [`evidenceReplays.${tag}`, v])]) {
      if (r.state !== 'replayed') found.push(`${at}: ${name}.state must be replayed`);
      if (!/^https:\/\/github\.com\/redact-secret\/redact-secret-benchmarks\/actions\/runs\/\d+$/.test(r.ciRun ?? '')) found.push(`${at}: ${name}.ciRun must be a run of the benchmarks repository`);
      if (!/^candidate-runs-\d+$/.test(r.archive?.release ?? '') || !DIGEST.test(r.archive?.sha256 ?? '')) found.push(`${at}: ${name}.archive needs the candidate-runs-<run id> release and its sha256`);
      if (!SHA.test(r.benchmarkRevision ?? '')) found.push(`${at}: ${name}.benchmarkRevision must be a full commit`);
      if (typeof r.worsened !== 'boolean' || !Number.isInteger(r.fixed) || !Number.isInteger(r.regressed)) found.push(`${at}: ${name}.worsened, fixed and regressed must be recorded`);
      if (r.worsened === false && r.regressed > 0) found.push(`${at}: ${name}.worsened is false but ${r.regressed} case(s) regressed`);
      if (r.repeatRunsEqual !== true) found.push(`${at}: the repeat runs did not agree, so the replay is not recorded`);
      if (!existsSync(path.join(root, r.data ?? '', 'candidate-effect.json'))) found.push(`${at}: ${name}.data ${r.data} holds no candidate-effect.json`);
      if (name !== 'replay' && !existsSync(path.join(root, r.data ?? '', 'two-by-two.json'))) found.push(`${at}: ${name}.data ${r.data} holds no two-by-two.json`);
    }
    const control = adoption?.engineCandidate?.product ?? (adoption?.state === 'accepted' ? adoption.candidate?.product : undefined);
    if (control && (c.control?.version !== control.version)) found.push(`${at}: control ${c.control?.version} is not the engine candidate's (or the accepted adoption's) product pin ${control.version}`);
  }
  return found;
}

export function bindingProblems(registry) {
  const found = [];
  for (const c of registry.candidates ?? []) {
    let assets;
    try { assets = JSON.parse(execFileSync('gh', ['release', 'view', c.release.tag, '-R', c.release.repository, '--json', 'assets'], { encoding: 'utf8' })).assets; }
    catch { found.push(`candidate ${c.id}: release ${c.release.tag} not found in ${c.release.repository}`); continue; }
    for (const p of c.packages) {
      const asset = assets.find(a => a.name === p.file);
      if (!asset) found.push(`candidate ${c.id}: ${p.file} is not on release ${c.release.tag}`);
      else {
        if (asset.size !== p.size) found.push(`candidate ${c.id}: ${p.file} has ${asset.size} bytes on the release, the registry pins ${p.size}`);
        if (asset.digest && asset.digest !== p.sha256) found.push(`candidate ${c.id}: ${p.file} has digest ${asset.digest} on the release, the registry pins ${p.sha256}`);
      }
    }
  }
  return found;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const registry = readJson('benchmarks/product-candidates.json'), adoption = readJson('benchmarks/evidence-adoption.json');
  const found = [...problems(registry, adoption), ...(process.argv.includes('--bindings') ? bindingProblems(registry) : [])];
  for (const f of found) console.error(`product-candidates: ${f}`);
  console.log(`Product candidates check complete: ${found.length} error(s)`);
  process.exit(found.length ? 1 : 0);
}
