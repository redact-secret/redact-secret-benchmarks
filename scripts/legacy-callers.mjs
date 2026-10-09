#!/usr/bin/env node
// Lists the callers of a file or directory: the static importers (relative import, export-from, dynamic import,
// require) and every file that names its repository-relative path (package.json scripts, workflows, shell, scripts).
// It is the "list its callers first" step of docs/specs/qualification-cutover.md#file-level-inventory (#653). Read-only:
// it removes and changes nothing, and it asserts nothing about product output.
//
//   node scripts/legacy-callers.mjs benchmarks/evaluation/domains/credential/runner.ts
//   node scripts/legacy-callers.mjs benchmarks/evaluation/domains/credential/  (every file below it, callers outside it only)
//   node scripts/legacy-callers.mjs --json benchmarks/scoring/lattice.ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'out', 'storybook-static', 'dist', 'graft', 'results-output', 'coverage', 'test-results'])
const CODE = /\.(?:[cm]?[jt]sx?)$/
const TEXT = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|py|html|css)$|^Dockerfile$/
const SKIP_PATHS = [/^package-lock\.json$/, /^web\/package-lock\.json$/, /^docs\//, /^public\/results\//, /^evidence\//, /^graft\//]

// Parallel checks can remove their temporary files during this read-only scan.
function ifPresent(read) {
  try { return read() }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined
    throw error
  }
}

function walk(dir, out = []) {
  for (const name of ifPresent(() => readdirSync(dir)) ?? []) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = ifPresent(() => statSync(full))
    if (!st) continue
    if (st.isDirectory()) walk(full, out)
    else out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

const files = walk(root).filter((f) => TEXT.test(f) && !SKIP_PATHS.some((p) => p.test(f)) && (ifPresent(() => statSync(join(root, f)))?.size ?? Infinity) < 2_000_000)
const known = new Set(walk(root).map((f) => f))
const SPEC = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\1/g

function resolveSpec(fromFile, spec) {
  const base = join(dirname(fromFile), spec).split(sep).join('/')
  const swaps = base.replace(/\.(?:m?js)$/, '')
  for (const c of [base, `${swaps}.ts`, `${swaps}.mts`, `${swaps}.tsx`, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, `${base}.json`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.mjs`, `${base}/index.js`]) {
    if (known.has(c)) return c
  }
  return null
}

const importers = new Map()
const text = new Map()
for (const f of files) {
  const src = ifPresent(() => readFileSync(join(root, f), 'utf8'))
  if (src === undefined) continue
  text.set(f, src)
  if (!CODE.test(f)) continue
  for (const m of src.matchAll(SPEC)) {
    const target = resolveSpec(f, m[2])
    if (!target) continue
    if (!importers.has(target)) importers.set(target, new Set())
    importers.get(target).add(f)
  }
}

/** The files that statically import `file` (no path mentions), for callers that walk the import graph (scripts/ci-plan.mjs). */
export const importersOf = (file) => [...(importers.get(file) ?? [])]

export function classify(f) {
  if (f === 'package.json') return 'package hook'
  if (f.startsWith('.github/workflows/')) return 'workflow'
  if (f.startsWith('tests/') || f.startsWith('web/tests/') || /\.test\.[cm]?[jt]sx?$/.test(f)) return 'test'
  if (f.startsWith('web/scripts/')) return 'web script'
  if (f.startsWith('web/')) return 'web (Next app)'
  if (f.startsWith('scripts/')) return 'script'
  if (f.startsWith('src/')) return 'src (legacy site)'
  if (f.startsWith('benchmarks/')) return 'benchmarks'
  return 'other'
}

export function callersOf(target) {
  const isDir = target.endsWith('/')
  const own = isDir ? [...known].filter((f) => f.startsWith(target)) : [target]
  const ownSet = new Set(own)
  const result = new Map()
  const add = (f, why) => {
    if (ownSet.has(f) || f === 'scripts/legacy-callers.mjs' || f === 'scripts/legacy-inventory.mjs') return
    if (!result.has(f)) result.set(f, new Set())
    result.get(f).add(why)
  }
  for (const file of own) {
    for (const f of importers.get(file) ?? []) add(f, 'import')
    for (const [f, src] of text) {
      if (ownSet.has(f)) continue
      // A file under web/ is named relative to web/ by that package's own package.json and scripts.
      if (src.includes(file) || (file.startsWith('web/') && f.startsWith('web/') && src.includes(file.slice(4)))) add(f, 'path')
    }
  }
  if (isDir) {
    for (const [f, src] of text) if (!ownSet.has(f) && src.includes(target)) add(f, 'path')
  }
  return [...result].map(([file, why]) => ({ file, class: classify(file), via: [...why].sort().join('+') })).sort((a, b) => a.file.localeCompare(b.file))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const targets = args.filter((a) => a !== '--json')
  if (targets.length === 0) {
    console.error('usage: node scripts/legacy-callers.mjs [--json] <file-or-dir/>...')
    process.exit(2)
  }
  const out = {}
  for (const t of targets) {
    if (!known.has(t) && !(t.endsWith('/') && [...known].some((f) => f.startsWith(t)))) {
      console.error(`not a tracked path: ${t}`)
      process.exit(2)
    }
    out[t] = callersOf(t)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const [t, list] of Object.entries(out)) {
      console.log(`${t}: ${list.length} caller file(s)`)
      const by = {}
      for (const c of list) (by[c.class] ??= []).push(`${c.file} (${c.via})`)
      for (const [k, v] of Object.entries(by)) console.log(`  ${k}: ${v.join(', ')}`)
    }
  }
}
