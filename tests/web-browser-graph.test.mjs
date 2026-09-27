import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

// The Vite app (index.html -> src/main.ts) runs in a browser, where Node built-ins and Node
// globals do not exist. A module that reaches the browser through a static or dynamic import
// and touches `Buffer` at load time crashed the deployed site to a black page with
// "ReferenceError: Buffer is not defined". Vite only warns about `node:*` imports, so this test
// walks the same import graph and fails on the next one.

const root = path.resolve('.');
const entries = ['src/main.ts'];
const EXTENSIONS = ['', '.ts', '.mjs', '.js', '.json', '/index.ts', '/index.mjs', '/index.js'];
const NODE_GLOBALS = /(?<![\w$.])(Buffer\.[a-zA-Z]|process\.(?:env|argv|cwd|platform|exit|stdout|stderr|versions?|hrtime|nextTick)\b|require\(|__dirname|__filename)/;
const nodeBuiltin = (specifier) => specifier.startsWith('node:') || builtinModules.includes(specifier.split('/')[0]);

function resolveImport(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// Block comments and whole-line or space-preceded `//` comments; a `//` inside a URL string is kept.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/.*$/gm, '$1')
  // Type-only imports and exports are erased by the bundler.
  .replace(/\b(?:import|export)\s+type\b[^;]*?from\s*(['"])[^'"\n]+\1;?/g, ' ');

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
const importsOf = (code) => [...code.matchAll(IMPORT_SPECIFIER)].map((match) => match[2]);

function walk() {
  const parent = new Map();
  const problems = [];
  const queue = entries.map((entry) => path.resolve(root, entry));
  for (const file of queue) parent.set(file, null);
  const chain = (file) => {
    const parts = [];
    for (let at = file; at; at = parent.get(at)) parts.unshift(path.relative(root, at));
    return parts.join(' -> ');
  };
  while (queue.length) {
    const file = queue.shift();
    if (!/\.(ts|mjs|js)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    const code = stripComments(source);
    for (const specifier of importsOf(code)) {
      if (nodeBuiltin(specifier)) {
        problems.push(`${chain(file)} imports ${specifier}`);
      } else if (specifier.startsWith('.')) {
        const target = resolveImport(file, specifier);
        if (target && !parent.has(target)) { parent.set(target, file); queue.push(target); }
      }
    }
    const global = NODE_GLOBALS.exec(code);
    if (global) problems.push(`${chain(file)} uses the Node global ${global[1]}`);
  }
  return { modules: parent.size, problems };
}

test('modules reachable from the browser entry use no Node built-ins or Node globals', () => {
  const { modules, problems } = walk();
  assert.ok(modules > 20, `expected to walk the real import graph, saw ${modules} modules`);
  assert.deepEqual(problems, [], `Node-only code is reachable from ${entries.join(', ')}:\n${problems.join('\n')}`);
});
