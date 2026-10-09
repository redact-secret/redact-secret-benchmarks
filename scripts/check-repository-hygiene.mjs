#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { ownerAuthorisationProblems } from './lib/decision-provenance.mjs';
import { inventoryAt } from './lib/retention-inventory.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = /^(?:evidence\/|docs\/(?:generated|reports|decisions)\/)/;
const SESSION = /(?:^|[/-])(?:beta[.-]?\d+|batch\d+|group-[a-z]|groups-cde|round\d+|issue-\d+)(?:[-./]|$)/i;
const SCRATCH = /(?:^|\/)(?:node_modules|results-output|\.next|dist|coverage|test-results|playwright-report)\/|(?:\.next|\.tmp|\.log)$/;

export function workflowScriptReferences(text) {
  const workflow = YAML.parse(text);
  const refs = [];
  for (const job of Object.values(workflow?.jobs ?? {})) {
    const checkouts = (job.steps ?? []).filter(s => s.uses?.startsWith('actions/checkout@'));
    const isSelf = step => !step.with?.repository || ['redact-secret/redact-secret-benchmarks', '${{ github.repository }}'].includes(step.with.repository);
    const external = new Set(checkouts.filter(s => !isSelf(s)).map(s => s.with?.path ?? '.'));
    const local = checkouts.filter(isSelf).map(s => s.with?.path ?? '.');
    for (const step of job.steps ?? []) {
      let cwd = step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? workflow.defaults?.run?.['working-directory'] ?? '.';
      for (const line of (step.run ?? '').split('\n')) {
        const cd = line.match(/^\s*cd\s+([\w./-]+)\s*(?:&&|$)/);
        if (cd) cwd = posix.normalize(posix.join(cwd, cd[1]));
        for (const match of line.matchAll(/(?:node(?:\s+--[\w=-]+)*(?:\s+tsx)?|bash|python3?)\s+['"]?(?:\.\/)?(scripts\/[\w./-]+\.(?:mjs|cjs|js|ts|py|sh))/g)) {
          if (external.has(cwd)) continue;
          let script = posix.normalize(posix.join(cwd, match[1]));
          for (const prefix of local) if (prefix !== '.' && script.startsWith(`${prefix}/`)) { script = script.slice(prefix.length + 1); break; }
          refs.push(script);
        }
      }
    }
  }
  return refs;
}

export function hygieneProblems({ files, policy, inventory, today, archive, removals }) {
  const problems = [];
  if (policy.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(policy.baselineCommit) || !Number.isSafeInteger(policy.maxNewPayloadBytes) || policy.maxNewPayloadBytes <= 0)
    return ['retention-policy.json: invalid schema/baseline/size limit'];
  const known = new Set(policy.existingPaths);
  const large = new Map(policy.existingLargePayloads.map(e => [e.path, e.maxBytes]));
  const exceptions = new Map();
  for (const e of policy.exceptions) {
    if (typeof e.path !== 'string' || !/^[\w./-]+$/.test(e.path) || e.path.startsWith('/') || e.path.split('/').includes('..') || !e.owner || !e.rationale || !/^https:\/\/github\.com\/redact-secret\/[\w-]+\/issues\/\d+$/.test(e.issue) || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires) || Number.isNaN(Date.parse(e.expires)) || new Date(e.expires).toISOString().slice(0, 10) !== e.expires || !Number.isSafeInteger(e.maxBytes) || e.maxBytes <= 0)
      problems.push(`${e.path ?? 'exception'}: require exact path, owner, rationale, linked issue, expiry and positive maxBytes`);
    else if (e.expires < today) problems.push(`${e.path}: exception expired ${e.expires}; review/remove it in ${e.issue}`);
    if (exceptions.has(e.path)) problems.push(`${e.path}: duplicate exception`);
    exceptions.set(e.path, e);
  }
  const reviews = new Map();
  for (const row of policy.pathReviews ?? []) {
    if (typeof row.path !== 'string' || !/^[\w./-]+$/.test(row.path) || row.path.startsWith('/') || row.path.split('/').includes('..') ||
        !row.owner || !row.rationale || !/^https:\/\/github\.com\/redact-secret\/[\w-]+\/issues\/\d+$/.test(row.issue) ||
        !['current-contract', 'structured-owner-authorisation', 'required-manual-tool', 'current-runtime', 'historical-reproduction'].includes(row.classification))
      problems.push(`${row.path ?? 'path review'}: require exact scoped path, owner, issue, rationale and reviewed classification`);
    if (reviews.has(row.path)) problems.push(`${row.path}: duplicate path review`);
    reviews.set(row.path, row);
  }
  const entries = new Map(inventory.entries.map(e => [e.path, e]));
  const paths = new Set(files.map(f => f.path));
  if (policy.enforcePrunedBaseline) {
    const scoped = new Set();
    for (const row of policy.retainedScopes ?? []) {
      if (!row.owner || !row.rationale || !/^https:\/\/github\.com\/redact-secret\/[\w-]+\/issues\/\d+$/.test(row.issue) || !Array.isArray(row.paths)) problems.push('retainedScopes: require owner, issue, rationale and exact paths');
      for (const path of row.paths ?? []) {
        if (!known.has(path) || scoped.has(path)) problems.push(`${path}: retained scope must name one exact baseline path`);
        scoped.add(path);
      }
    }
    for (const path of known) {
      if (!paths.has(path)) problems.push(`${path}: prune removed/moved grandfathered baseline entry`);
      if (!scoped.has(path)) problems.push(`${path}: retained baseline needs a scoped owner/issue review`);
    }
  }
  const hasEntrypoint = target => {
    const queue = [target], seen = new Set(queue);
    while (queue.length) {
      for (const c of entries.get(queue.pop())?.callers ?? []) {
        if (!(c.via ?? ['literal-path']).some(v => ['import', 'literal-path'].includes(v))) continue;
        if (/^(?:\.github\/workflows\/|(?:web\/)?package\.json$)/.test(c.path)) return true;
        if (['current-runtime', 'required-manual-tool'].includes(reviews.get(c.path)?.classification) && c.active && c.path.startsWith('scripts/')) return true;
        if (!seen.has(c.path) && c.active) { seen.add(c.path); queue.push(c.path); }
      }
    }
    return false;
  };
  for (const f of files) {
    if (SCRATCH.test(f.path)) problems.push(`${f.path}: regenerable scratch belongs in ignored results-output/`);
    const exception = exceptions.get(f.path);
    const review = reviews.get(f.path);
    if (f.path.startsWith('docs/decisions/'))
      problems.push(`${f.path}: dated decision history belongs in the linked issue/archive; current contracts go in docs/specs/ and owner authorisations in benchmarks/governance/authorisations/`);
    if (f.path.startsWith('benchmarks/governance/authorisations/')) {
      if (!review || review.classification !== 'structured-owner-authorisation')
        problems.push(`${f.path}: structured owner authorisation needs an exact reviewed path, owner and issue; hygiene never supplies owner approval`);
      try { for (const error of ownerAuthorisationProblems(JSON.parse(f.text ?? ''))) problems.push(`${f.path}: ${error}`); }
      catch { problems.push(`${f.path}: owner authorisation must be schema-valid structured JSON`); }
    }
    if (SESSION.test(f.path.startsWith('scripts/') ? f.path : posix.dirname(f.path)) && ((f.path.startsWith('scripts/') && !review) || (!known.has(f.path) && !review && !exception)))
      problems.push(`${f.path}: session-named path needs role review with an owner/issue; stable identifiers and seeds may remain inside a justified current contract`);

    if (GENERATED.test(f.path) && !known.has(f.path) && !exception)
      problems.push(`${f.path}: new retained output needs a scoped owner/issue/expiry exception; otherwise use results-output/`);
    const max = exception?.maxBytes ?? large.get(f.path) ?? policy.maxNewPayloadBytes;
    if (f.size > max) problems.push(`${f.path}: ${f.size} bytes exceeds ${max}; preserve externally or review a size exception`);
    if (f.path.startsWith('scripts/') && /\.(?:[cm]?[jt]s|py|sh)$/.test(f.path) && !known.has(f.path) && !exception) {
      if (!hasEntrypoint(f.path) && review?.classification !== 'required-manual-tool' && review?.classification !== 'current-runtime')
        problems.push(`${f.path}: orphan script; wire it into an active command/workflow or classify an exact required manual tool; tests and historical prose are not execution roots`);
    }
    if (f.path.startsWith('.github/workflows/') && !exception) {
      try {
        const workflow = YAML.parse(f.text ?? '');
        if (!workflow || !Object.hasOwn(workflow, 'on') || !workflow.on || (typeof workflow.on === 'object' && !Object.keys(workflow.on).length)) problems.push(`${f.path}: workflow has no trigger / reusable entrypoint`);
        for (const script of workflowScriptReferences(f.text ?? ''))
          if (!paths.has(script)) problems.push(`${f.path}: invokes missing ${script}`);
      } catch { problems.push(`${f.path}: invalid workflow YAML`); }
    }
  }
  for (const row of policy.pathReviews ?? []) if (!paths.has(row.path)) problems.push(`${row.path}: path review names a missing tracked file`);
  for (const e of policy.exceptions) if (!paths.has(e.path)) problems.push(`${e.path}: exception names a missing tracked file`);
  if (archive && (archive.schema !== 'redact-secret/retention-archive/v1' || !/^[a-f0-9]{40}$/.test(archive.sourceCommit) || !/^hygiene-[a-z0-9-]+$/.test(archive.retainedTag) || !/^[a-f0-9]{40}$/.test(archive.tagObject)))
    problems.push('retention-archive.json: broken retained source/tag identity');
  if (removals) {
    if (!archive || removals.sourceCommit !== archive.sourceCommit || removals.preservationTag !== archive.retainedTag || !Array.isArray(removals.entries))
      problems.push('retention-removals.json: source/tag differs from archive');
    const seen = new Set();
    const migratedReaders = new Set();
    for (const row of removals.readerMigrations ?? []) {
      if (migratedReaders.has(row.path) || !/^docs\/(?:decisions|reports)\/[\w./-]+\.md$/.test(row.path) || row.path.split('/').includes('..') ||
          !/^[a-f0-9]{64}$/.test(row.sourceSha256 ?? '') || !/^[a-f0-9]{64}$/.test(row.afterSha256 ?? '') ||
          entries.get(row.path)?.sha256 !== row.afterSha256 || !row.owner || !row.issue || !row.reason?.trim())
        problems.push(`${row.path}: invalid or drifted checksum-bound historical reader migration`);
      migratedReaders.add(row.path);
    }
    for (const row of removals.entries ?? []) {
      if (seen.has(row.path)) problems.push(`${row.path}: duplicate removal record`);
      seen.add(row.path);
      if (paths.has(row.path)) problems.push(`${row.path}: declared removed but still tracked`);
      if (!/^[a-f0-9]{64}$/.test(row.sha256) || !row.owner || !row.issue || !row.review?.dynamicReaders || !row.review?.externalReferences || !row.review?.authorityGates || row.preservation?.sha256 !== row.sha256 || row.preservation?.ref !== `refs/tags/${archive?.retainedTag}` || !row.preservation?.verifiedAt || !/^https:\/\/github\.com\/redact-secret\/redact-secret-benchmarks\/releases\/tag\/hygiene-/.test(row.archiveReceipt) || !/^https:\/\/github\.com\/redact-secret\/redact-secret-benchmarks\/issues\/\d+(?:#issuecomment-\d+)?$/.test(row.issueRecord))
        problems.push(`${row.path}: broken removal review, digest or durable receipt references`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  const files = paths.map(path => ({ path, size: lstatSync(resolve(root, path)).size, ...((path.startsWith('.github/workflows/') || path.startsWith('benchmarks/governance/authorisations/')) ? { text: readFileSync(resolve(root, path), 'utf8') } : {}) }));
  const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const problems = hygieneProblems({ files, policy: json('docs/retention/policy.json'), inventory: inventoryAt(root), archive: json('docs/retention/archive.json'), removals: json('docs/retention/removals.json'), today: new Date().toISOString().slice(0, 10) });
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
  else console.log(`Repository hygiene: ${files.length} tracked files checked; generated outputs, payload sizes and new script/workflow entrypoints valid.`);
}
