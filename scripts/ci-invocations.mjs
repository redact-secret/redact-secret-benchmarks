#!/usr/bin/env node
// A review graph, not deletion approval. Computed commands remain explicit unresolved edges.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, lstatSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { analyzeFiles } from './lib/retention-inventory.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const META = new Set(['scripts/ci-invocations.mjs', 'scripts/check-repository-hygiene.mjs', 'scripts/lib/retention-inventory.mjs', 'scripts/retention-inventory.mjs']);
const CODE = /\.(?:[cm]?[jt]sx?|py|sh)$/;
const commandId = (pkg, name) => `npm:${pkg}:${name}`;

export function invocationGraph(files) {
  const text = file => file.text ?? file.bytes?.toString('utf8') ?? '';
  const byPath = new Map(files.map(file => [file.path, file]));
  const packages = new Map(files.filter(file => /^(?:web\/)?package\.json$/.test(file.path)).map(file => [posix.dirname(file.path), JSON.parse(text(file))]));
  const nodes = new Map(), edges = new Map(), unresolved = [];
  const addNode = (id, data) => nodes.set(id, { id, ...data });
  const edge = (from, to, kind) => edges.set(`${from}\0${to}\0${kind}`, { from, to, kind });
  const packageAt = cwd => [...packages.keys()].sort((a, b) => b.length - a.length).find(pkg => pkg === '.' || cwd === pkg || cwd.startsWith(`${pkg}/`));
  const scriptFiles = files.filter(file => file.path.startsWith('scripts/') && CODE.test(file.path));
  for (const file of scriptFiles) addNode(file.path, { kind: /\.d\.[cm]?ts$/.test(file.path) ? 'declaration-file' : 'script-file' });
  for (const [pkg, manifest] of packages) for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    const id = commandId(pkg, name);
    addNode(id, { kind: 'npm-command', package: pkg, name, command });
    for (const hook of [`pre${name}`, `post${name}`]) if (manifest.scripts[hook]) edge(id, commandId(pkg, hook), 'npm-lifecycle');
  }
  const scan = (source, command, initialCwd = '.', external = []) => {
    let cwd = initialCwd;
    for (const line of command.split('\n')) {
      const cd = /^\s*cd\s+['"]?([\w./-]+)['"]?\s*(?:&&|$)/.exec(line);
      if (cd) cwd = posix.normalize(posix.join(cwd, cd[1]));
      if (external.some(prefix => cwd === prefix || cwd.startsWith(`${prefix}/`))) continue;
      if (/\bnpm\s+(?:ci|install)\b/.test(line) && !line.includes('--ignore-scripts')) {
        const pkg = packageAt(cwd);
        for (const hook of ['preinstall', 'install', 'postinstall', 'prepare'])
          if (packages.get(pkg)?.scripts?.[hook]) edge(source, commandId(pkg, hook), 'npm-install-lifecycle');
      }
      for (const match of line.matchAll(/\bnpm\s+(?:--prefix\s+([\w./-]+)\s+)?(?:run\s+(?:(?:-s|--silent|--if-present)\s+)*([\w][\w:.-]*)|(?:start|test)\b)/g)) {
        const name = match[2] ?? (/\btest\b/.test(match[0]) ? 'test' : 'start');
        const target = match[1] ? posix.normalize(posix.join(cwd, match[1])) : cwd;
        if (external.some(prefix => target === prefix || target.startsWith(`${prefix}/`))) continue;
        const pkg = packageAt(target);
        const id = commandId(pkg, name);
        edge(source, id, 'npm-run');
        if (!nodes.has(id)) unresolved.push({ source, kind: 'missing-or-external-npm-command', command: match[0], cwd });
      }
      for (const match of line.matchAll(/(?:node(?:\s+--[\w=-]+(?:\s+(?:tsx|\d+))?)*|bash|python3?)\s+['"]?(?:\.\/)?((?:[\w.-]+\/)*scripts\/[\w./-]+\.(?:mjs|cjs|js|ts|py|sh))/g)) {
        let target = posix.normalize(posix.join(cwd, match[1]));
        if (external.some(prefix => target === prefix || target.startsWith(`${prefix}/`))) continue;
        // A checked-out self repository can be nested; longest matching package prefix wins.
        const suffix = match[1].replace(/^.*?\/(scripts\/)/, '$1');
        if (!byPath.has(target) && byPath.has(suffix)) target = suffix;
        edge(source, target, 'script-execution');
        if (!byPath.has(target)) unresolved.push({ source, kind: 'missing-or-external-script', command: match[0], cwd });
      }
      if (/\b(?:npm|node|bash|python3?)\s+[^\n]*(?:\$\{|\$[A-Za-z_])/.test(line) || /^\s*cd\s+['"]?\$/.test(line))
        unresolved.push({ source, kind: 'computed-shell-command', command: line.trim(), cwd });
      if (/\bnpm\s+run\s+-(?!(?:s|-(?:silent|if-present))\s)[\w-]+/.test(line))
        unresolved.push({ source, kind: 'unresolved-npm-run-option', command: line.trim(), cwd });
    }
  };
  for (const node of nodes.values()) if (node.kind === 'npm-command') scan(node.id, node.command, node.package);
  const workflows = [];
  for (const file of files.filter(file => file.path.startsWith('.github/workflows/') && /\.ya?ml$/.test(file.path))) {
    const workflow = YAML.parse(text(file));
    const triggers = typeof workflow.on === 'string' ? [workflow.on] : Array.isArray(workflow.on) ? workflow.on : Object.keys(workflow.on ?? {});
    const jobs = [];
    for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
      const id = `${file.path}#${name}`;
      addNode(id, { kind: 'workflow-job', workflow: file.path, name, if: job.if ?? null, needs: job.needs ?? [] });
      jobs.push(id);
      if (job.uses?.startsWith('./.github/workflows/')) edge(id, job.uses.slice(2), 'reusable-workflow');
      const checkouts = (job.steps ?? []).filter(step => step.uses?.startsWith('actions/checkout@'));
      const self = step => !step.with?.repository || ['redact-secret/redact-secret-benchmarks', '${{ github.repository }}'].includes(step.with.repository);
      const external = checkouts.filter(step => !self(step)).map(step => step.with?.path ?? '.');
      const local = checkouts.filter(self).map(step => step.with?.path ?? '.');
      for (const step of job.steps ?? []) {
        let cwd = step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? workflow.defaults?.run?.['working-directory'] ?? '.';
        if (external.some(prefix => cwd === prefix || cwd.startsWith(`${prefix}/`))) continue;
        for (const prefix of local) if (prefix !== '.' && (cwd === prefix || cwd.startsWith(`${prefix}/`))) { cwd = cwd === prefix ? '.' : cwd.slice(prefix.length + 1); break; }
        if (step.run) scan(id, step.run, cwd, external);
      }
    }
    workflows.push({ path: file.path, triggers, manualOnly: triggers.every(trigger => ['workflow_dispatch', 'workflow_call'].includes(trigger)), jobs });
  }
  // Include imported/helper files and literal subprocess argv, not just top-level npm entrypoints.
  const inventory = analyzeFiles(files);
  for (const entry of inventory.entries.filter(entry => nodes.has(entry.path))) {
    for (const caller of entry.callers) {
      if ((META.has(caller.path) && !caller.via.includes('import')) || /^(?:docs\/retention\/|benchmarks\/retention-)/.test(caller.path)) continue;
      if (CODE.test(caller.path) && caller.via.includes('import')) edge(caller.path, entry.path, 'import');
      else if (!/\.(?:json|md)$/.test(caller.path) && caller.via.some(via => ['literal-path', 'basename-possible'].includes(via))) edge(caller.path, entry.path, 'possible-literal-caller');
    }
  }
  for (const file of files.filter(file => CODE.test(file.path) && !META.has(file.path))) {
    const source = text(file);
    for (const match of source.matchAll(/\[\s*['"]run['"]\s*,\s*(?:['"](?:-s|--silent|--if-present)['"]\s*,\s*)*['"]([\w:.-]+)['"]/g)) {
      const pkg = file.path.startsWith('web/') ? 'web' : '.';
      if (nodes.has(commandId(pkg, match[1]))) edge(file.path, commandId(pkg, match[1]), 'literal-subprocess-npm-argv');
    }
    if (/\b(?:execFile|spawn|execSync|run)\w*\([^)]*(?:\$\{|\b(?:args|command|script|npm)\b)/.test(source))
      unresolved.push({ source: file.path, kind: 'computed-subprocess', command: 'Inspect computed argv and working directory before declaring callers absent.' });
  }
  const allEdges = [...edges.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  for (const { from, to } of allEdges) for (const id of [from, to])
    if (!nodes.has(id)) addNode(id, { kind: byPath.has(id) ? 'source-file' : 'unresolved-target' });
  const findings = [];
  const allText = files.filter(file => /\.md$/.test(file.path)).map(file => text(file)).join('\n');
  for (const node of nodes.values()) {
    const incoming = allEdges.filter(entry => entry.to === node.id);
    if (node.kind === 'npm-command') {
      if (!incoming.length && !['prepare'].includes(node.name)) findings.push({ id: node.id, kind: 'manual-or-unreferenced-alias', documented: allText.includes(`npm run ${node.name}`), removalApproved: false });
      if (/\b(?:beta\d+|snapshot-\d{4}|product-core-main-[a-f0-9]{7,})/.test(node.command)) findings.push({ id: node.id, kind: 'versioned-one-off-command', command: node.command, removalApproved: false });
    } else if (node.kind === 'script-file' && !incoming.some(entry => !entry.from.startsWith('tests/'))) {
      findings.push({ id: node.id, kind: incoming.length ? 'test-only-script-caller' : 'no-resolved-script-caller', documented: allText.includes(node.id), removalApproved: false });
    }
  }
  const duplicates = new Map();
  for (const node of nodes.values()) if (node.kind === 'npm-command') {
    const key = `${node.package}\0${node.command}`;
    if (!duplicates.has(key)) duplicates.set(key, []);
    duplicates.get(key).push(node.id);
  }
  return { schema: 'redact-secret/ci-invocations/v1', removesNothing: true,
    coverage: { trackedFiles: files.length, packages: packages.size, scriptFiles: scriptFiles.length, workflows: workflows.length, limitations: ['Computed shell/argv and outside-repository callers require explicit review.', 'Possible literal callers are not proof of execution.', 'Manual aliases and test-only files are review flags, never automatic deletion approval.'] },
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)), edges: allEdges,
    workflows, duplicateCommands: [...duplicates.values()].filter(ids => ids.length > 1),
    findings: findings.sort((a, b) => a.id.localeCompare(b.id)), unresolved };
}

export function renderInvocationGraph(graph) {
  return `# Script-command-workflow graph\n\nRead-only review graph; unresolved commands require scoped review.\n\n${graph.coverage.scriptFiles} script files, ${graph.nodes.filter(node => node.kind === 'npm-command').length} npm commands, ${graph.workflows.length} workflows, ${graph.edges.length} edges.\n\n## Workflow lanes\n\n| Workflow | Triggers | Manual/reusable only |\n| --- | --- | --- |\n${graph.workflows.map(row => `| \`${row.path}\` | ${row.triggers.join(', ')} | ${row.manualOnly} |`).join('\n')}\n\n## Review flags\n\n| Entrypoint | Flag | Documented |\n| --- | --- | --- |\n${graph.findings.map(row => `| \`${row.id}\` | ${row.kind} | ${row.documented ?? 'n/a'} |`).join('\n')}\n\n${graph.unresolved.length} computed/unresolved records are in the JSON. No flag approves a deletion.\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/ci-invocations.mjs');
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  const files = paths.filter(path => !lstatSync(resolve(ROOT, path)).isSymbolicLink()).map(path => ({ path, bytes: readFileSync(resolve(ROOT, path)) }));
  const graph = invocationGraph(files);
  const output = resolve(ROOT, 'results-output/hygiene');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'ci-invocations.json'), `${JSON.stringify(graph, null, 2)}\n`);
  writeFileSync(resolve(output, 'ci-invocations.md'), renderInvocationGraph(graph));
  console.log(JSON.stringify({ ...graph.coverage, edges: graph.edges.length, flags: graph.findings.length, unresolved: graph.unresolved.length, output: 'results-output/hygiene/ci-invocations.{json,md}' }));
}
