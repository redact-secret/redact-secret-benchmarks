#!/usr/bin/env node
/**
 * Registry-shaped clean-consumer check for adapters release train 2026.09.25.
 *
 * Installs the exact rc tarballs by file path, with the registry core
 * 0.1.0-beta.8 tarball, into clean consumers outside any checkout, and checks:
 *   - npm resolves every declared range (^0.1.1, ^0.1.0-alpha) against those
 *     files, with one copy of each package and `npm ls --all` clean;
 *   - no @redact-secret/adapter* package comes from a registry;
 *   - each package README example runs on the real core with no plaintext in
 *     its output.
 *
 * npm is only ever run with `install` / `ls`; never `publish`. Every child
 * inherits NPM_CONFIG_USERCONFIG (an empty file) and npm_config_cache (a
 * scratch dir), checked below, so no user npmrc or token is read.
 *
 *   node registry-consumer-check.mjs <rc-tarball-dir> <core-tarball> <readme-dir> <out.json>
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [tarDir, coreTgz, readmeRoot, outPath] = process.argv.slice(2).map((p) => resolve(p));
if (!outPath) throw new Error("usage: rc-consumer-check.mjs <rc-tarball-dir> <core-tarball> <adapters-checkout> <out.json>");

const userconfig = process.env.NPM_CONFIG_USERCONFIG;
if (!userconfig || statSync(userconfig).size !== 0) throw new Error("NPM_CONFIG_USERCONFIG must point at an empty file");
if (!process.env.npm_config_cache) throw new Error("npm_config_cache must be set to a scratch dir");

const T = {
  adapter: join(tarDir, "redact-secret-adapter-0.1.1.tgz"),
  pino: join(tarDir, "redact-secret-adapter-pino-0.1.1.tgz"),
  otel: join(tarDir, "redact-secret-adapter-otel-0.1.1.tgz"),
  aiContext: join(tarDir, "redact-secret-adapter-ai-context-0.1.0-alpha.tgz"),
  mcp: join(tarDir, "redact-secret-adapter-mcp-0.1.0-alpha.tgz"),
};

// Synthetic, revoked-shaped, same value the adapters' README examples use.
const SECRET = `ghp_SYNTHETICREVOKED${"0".repeat(20)}`;
const FRAGMENT = SECRET.slice(4, 16);
const leaks = (text) => text.includes(SECRET) || text.includes(FRAGMENT);

function npm(args, cwd) {
  const r = spawnSync("npm", args, { cwd, encoding: "utf-8", env: { ...process.env, npm_config_update_notifier: "false" } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function consumer(name) {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), `rc-consumer-${name}-`));
  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: `rc-consumer-${name}`, private: true, type: "module" }, null, 2)}\n`);
  return dir;
}

function readme(pkg) {
  return readFileSync(join(readmeRoot, "packages", pkg, "README.md"), "utf-8");
}
function smokeExample(pkg) {
  const m = /<!-- smoke-test:example -->\s*```js\n([\s\S]*?)```/.exec(readme(pkg));
  if (!m) throw new Error(`${pkg}: no smoke-test:example block`);
  return m[1];
}
/** The n-th ```js block of a README, verbatim. */
function jsBlock(pkg, n) {
  const blocks = [...readme(pkg).matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks[n] === undefined) throw new Error(`${pkg}: no js block ${n}`);
  return blocks[n];
}

function runScript(dir, file, source) {
  writeFileSync(join(dir, file), source);
  const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: "utf-8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, leak: leaks(r.stdout) || leaks(r.stderr) };
}

/** Resolution facts from the lockfile and `npm ls --all`, no values. */
function resolution(dir, expected) {
  const ls = npm(["ls", "--all", "--json"], dir);
  const tree = JSON.parse(ls.stdout);
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf-8"));
  const redactSecret = Object.entries(lock.packages)
    .filter(([path]) => /node_modules\/@redact-secret\//.test(path))
    .map(([path, meta]) => ({ path, version: meta.version, resolved: meta.resolved ?? null }));
  const adapterEntries = redactSecret.filter((e) => /@redact-secret\/adapter/.test(e.path));
  const fromRegistry = adapterEntries.filter((e) => e.resolved === null || !e.resolved.startsWith("file:"));
  const problems = [];
  if (ls.status !== 0) problems.push(`npm ls --all exited ${ls.status}`);
  if (tree.problems?.length) problems.push(...tree.problems);
  for (const [name, version] of Object.entries(expected)) {
    const copies = redactSecret.filter((e) => e.path.endsWith(`node_modules/${name}`));
    if (copies.length !== 1) problems.push(`${name}: ${copies.length} copies installed`);
    else if (copies[0].version !== version) problems.push(`${name}: resolved ${copies[0].version}, expected ${version}`);
  }
  if (fromRegistry.length) problems.push(`adapter packages not from the rc files: ${fromRegistry.map((e) => e.path).join(", ")}`);
  // Every declared @redact-secret edge in the installed manifests, and what it resolved to.
  const edges = [];
  for (const e of adapterEntries) {
    const manifest = JSON.parse(readFileSync(join(dir, e.path, "package.json"), "utf-8"));
    for (const field of ["dependencies", "peerDependencies"]) {
      for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
        if (!dep.startsWith("@redact-secret/")) continue;
        const target = redactSecret.find((x) => x.path === `node_modules/${dep}`);
        edges.push({ from: `${manifest.name}@${manifest.version}`, field, dep, range, resolvedTo: target?.version ?? null });
      }
    }
  }
  return { ok: problems.length === 0, problems, packages: redactSecret, edges };
}

const report = { schema: "registry-consumer-check-v1", train: "2026.09.25", npm: execFileSync("npm", ["--version"], { encoding: "utf-8" }).trim(), node: process.version, consumers: {} };

// ---- Consumer 1: the MCP chain, as `npm i @redact-secret/adapter-mcp@0.1.0-alpha @redact-secret/core` resolves it.
{
  const dir = consumer("mcp");
  const install = npm(["install", "--no-audit", "--no-fund", T.adapter, T.aiContext, T.mcp, coreTgz], dir);
  const res = install.status === 0 ? resolution(dir, {
    "@redact-secret/adapter": "0.1.1", "@redact-secret/adapter-ai-context": "0.1.0-alpha",
    "@redact-secret/adapter-mcp": "0.1.0-alpha", "@redact-secret/core": "0.1.0-beta.8",
  }) : { ok: false, problems: [`npm install exited ${install.status}`] };
  const examples = {};
  const ai = runScript(dir, "ai-context-example.mjs", smokeExample("adapter-ai-context"));
  const aiLast = ai.stdout.trim().split("\n").at(-1) ?? "";
  examples["adapter-ai-context README example"] = { exit: ai.status, leak: ai.leak, expectedOutput: aiLast === '[{"role":"user","content":"deploy with API_KEY=<SECRET_1>"},{"role":"tool","content":{"content":[{"type":"text","text":"build ok"}],"exitCode":0}}]' };
  const mcp = runScript(dir, "mcp-example.mjs", smokeExample("adapter-mcp"));
  const mcpLast = mcp.stdout.trim().split("\n").at(-1) ?? "";
  examples["adapter-mcp README example"] = { exit: mcp.status, leak: mcp.leak, expectedOutput: mcpLast === '{"content":[{"type":"text","text":"deploy ok\\nAPI_KEY=<SECRET_1>"}],"structuredContent":{"env":["API_KEY=<SECRET_1>"]}}' };
  // adapter README: the Langfuse block needs a host; a stub records what it is handed.
  const lf = runScript(dir, "adapter-langfuse-example.mjs",
    `class Langfuse { constructor(o) { this.mask = o.mask; } }\n${jsBlock("adapter", 0)}\n` +
    `const out = langfuse.mask({ data: { input: "token ${SECRET}", n: 1 } });\nconsole.log(JSON.stringify(out));\n`);
  examples["adapter README example (masking callback)"] = { exit: lf.status, leak: lf.leak, expectedOutput: lf.stdout.trim() === '{"input":"token <SECRET_1>","n":1}' };
  const inj = runScript(dir, "adapter-injected-example.mjs", `${jsBlock("adapter", 1)}\nconsole.log("ok");\n`);
  examples["adapter README example (injected API)"] = { exit: inj.status, leak: inj.leak, expectedOutput: inj.stdout.trim() === "ok" };
  const ws = runScript(dir, "adapter-walkstrict.mjs",
    'import { walkStrict } from "@redact-secret/adapter";\n' +
    'const r = walkStrict({ a: ["x"] }, { maxDepth: 4, maxNodes: 16 }, { string: (t) => ({ ok: true, text: t.toUpperCase() }), key: () => ({ ok: true }) });\n' +
    'console.log(typeof walkStrict, JSON.stringify(r));\n');
  examples["walkStrict importable from the installed @redact-secret/adapter"] = { exit: ws.status, leak: ws.leak, expectedOutput: ws.stdout.startsWith("function ") };
  report.consumers.mcp = { install: { exit: install.status }, resolution: res, examples };
}

// ---- Consumer 2: pino and otel 0.1.1 against adapter 0.1.1.
{
  const dir = consumer("pino-otel");
  const install = npm(["install", "--no-audit", "--no-fund", T.adapter, T.pino, T.otel, coreTgz,
    "pino@^10.0.0", "@opentelemetry/sdk-trace-base@^2.0.0", "@opentelemetry/sdk-trace-node@^2.0.0"], dir);
  const res = install.status === 0 ? resolution(dir, {
    "@redact-secret/adapter": "0.1.1", "@redact-secret/adapter-pino": "0.1.1",
    "@redact-secret/adapter-otel": "0.1.1", "@redact-secret/core": "0.1.0-beta.8",
  }) : { ok: false, problems: [`npm install exited ${install.status}`] };
  const examples = {};
  // pino README block verbatim; secretValue is the only free variable. Then a
  // child binding and a mixin, which only hooks.streamWrite covers.
  const pinoBlock = jsBlock("adapter-pino", 0).replace(
    "const logger = pino({",
    "const logger = pino({\n  mixin: () => ({ mixed: secretValue }),",
  );
  const pino = runScript(dir, "pino-example.mjs",
    `const secretValue = "${SECRET}";\n${pinoBlock}\nlogger.child({ token: secretValue }).info("child line");\nlogger.flush?.();\n`);
  const lines = pino.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  examples["adapter-pino README example (+ child binding, mixin)"] = {
    exit: pino.status, leak: pino.leak,
    expectedOutput: lines.length === 2 && lines[0].msg === "token is <SECRET_1>" && lines[1].token === "<SECRET_1>" && lines[1].mixed === "<SECRET_1>",
  };
  const otel = runScript(dir, "otel-example.mjs",
    'import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";\nconst exporter = new InMemorySpanExporter();\n' +
    `${jsBlock("adapter-otel", 0)}\n` +
    `const tracer = provider.getTracer("rc");\nconst span = tracer.startSpan("deploy ${SECRET}");\n` +
    `span.setAttribute("input.value", "API_KEY=${SECRET}");\nspan.addEvent("ev ${SECRET}", { "gen_ai.prompt": "${SECRET}" });\n` +
    'span.setStatus({ code: 2, message: "failed with ' + SECRET + '" });\nspan.end();\nawait provider.forceFlush();\n' +
    'const [s] = exporter.getFinishedSpans();\nconsole.log(JSON.stringify({ n: exporter.getFinishedSpans().length, name: s.name, attr: s.attributes["input.value"], ev: s.events[0].name, evAttr: s.events[0].attributes["gen_ai.prompt"], status: s.status.message }));\n');
  const o = otel.status === 0 ? JSON.parse(otel.stdout.trim().split("\n").at(-1)) : {};
  examples["adapter-otel README example (+ span name, attribute, event, status)"] = {
    exit: otel.status, leak: otel.leak,
    expectedOutput: o.n === 1 && o.name === "deploy <SECRET_1>" && o.attr === "API_KEY=<SECRET_1>" && o.ev === "ev <SECRET_1>" && o.evAttr === "<SECRET_1>" && o.status === "failed with <SECRET_1>",
  };
  report.consumers["pino-otel"] = { install: { exit: install.status }, resolution: res, examples };
}

const all = Object.values(report.consumers).flatMap((c) => [c.install.exit === 0, c.resolution.ok, ...Object.values(c.examples).map((e) => e.exit === 0 && !e.leak && e.expectedOutput)]);
report.pass = all.every(Boolean);
const text = `${JSON.stringify(report, null, 2)}\n`;
if (leaks(text)) throw new Error("refusing to write a report that contains the synthetic value");
writeFileSync(outPath, text);
console.log(text);
process.exit(report.pass ? 0 : 1);
