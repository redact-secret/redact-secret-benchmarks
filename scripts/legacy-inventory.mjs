#!/usr/bin/env node
// The file-level caller inventory of the legacy credential evaluator (docs/specs/qualification-cutover.md, "File-level inventory", #653, #660) as a checked
// document. Every row of a six-column inventory table names one path with its owner, disposition, callers, replacement and removal prerequisite; this
// script recomputes the callers column from the tree (scripts/legacy-callers.mjs) and fails when a cell is stale, a cell is empty, a disposition is
// not one the document defines, or a file of the credential domain, the neutral modules or the frozen legacy review queue has no row.
// Read-only unless `--write`, which rewrites only the callers column. It removes nothing and asserts nothing about product output.
//
//   node scripts/legacy-inventory.mjs --check     fail when the document differs from the tree (npm run legacy-inventory:check)
//   node scripts/legacy-inventory.mjs --write     rewrite the callers column of every row
//   node scripts/legacy-inventory.mjs <path>      print the callers cell one path would get
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { callersOf } from './legacy-callers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DOC = 'docs/specs/qualification-cutover.md'
export const HEADER = '| File | Owner | Disposition | Callers outside the removal set | Replacement artifact | Removal prerequisite |'
/** `shim` is a re-export left at a path whose module moved (#660): removed with the evaluator, once nothing imports the old path. */
export const DISPOSITIONS = new Set(['keep', 'oracle', 'replace', 'move', 'remove', 'shim', 'other-domain'])
/** Removal-set dispositions: a caller inside it never blocks the removal of another member. */
const REMOVAL = new Set(['remove', 'shim'])
/** Every tracked file below these must have a row (a directory prefix, or an exact path). */
export const COMPLETE_FOR = [
  'benchmarks/evaluation/domains/credential/',
  'benchmarks/evaluation/model/', 'benchmarks/scoring/', 'benchmarks/evaluation/evidence.ts', 'benchmarks/accounting/index.ts', 'benchmarks/qualification/legacy-review.ts',
  'benchmarks/support/legacy-review-queue.json',
  'benchmarks/consumer/', 'benchmarks/shared/statistical-primitives.ts',
]

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim())

/** The inventory rows: the six-column tables only, one path per row. */
export function parseInventory(doc) {
  const lines = doc.split('\n')
  const rows = []
  let inTable = false
  lines.forEach((line, index) => {
    if (line.trim() === HEADER) { inTable = true; return }
    if (!inTable) return
    if (!line.startsWith('|')) { inTable = false; return }
    if (/^\|\s*-/.test(line)) return
    const c = cells(line)
    const only = c[0].match(/^`([^`]+)`$/)
    rows.push({ index, line, cells: c, path: only ? only[1] : null })
  })
  return { lines, rows }
}

const isTestFile = (f) => f.startsWith('tests/') || f.startsWith('web/tests/') || /\.test\.[cm]?[jt]sx?$/.test(f)

function removalPaths(rows) {
  return rows.filter((r) => r.path && REMOVAL.has(r.cells[2])).map((r) => r.path)
}

/** The callers cell one path gets: callers outside the removal set, the non-test files listed, the test files counted. */
export function callersCell(path, removal) {
  const outside = callersOf(path).map((c) => c.file).filter((f) => !removal.some((r) => (r.endsWith('/') ? f.startsWith(r) : f === r)))
  const files = outside.filter((f) => !isTestFile(f))
  const tests = outside.length - files.length
  const parts = [...files.map((f) => `\`${f}\``), ...(tests ? [`${tests} test file${tests === 1 ? '' : 's'}`] : [])]
  return parts.length ? parts.join(', ') : 'none'
}

export function inventoryProblems(doc, tracked) {
  const { rows } = parseInventory(doc)
  const problems = []
  if (!rows.length) return ['the inventory has no rows']
  const removal = removalPaths(rows)
  for (const row of rows) {
    const name = row.path ?? row.cells[0]
    if (row.cells.length !== 6) { problems.push(`${name}: expected six columns, found ${row.cells.length}`); continue }
    if (!row.path) continue // a grouped row names several paths; its callers are not recomputed
    const [, owner, disposition, callers, , prerequisite] = row.cells
    for (const [label, value] of [['owner', owner], ['disposition', disposition], ['callers', callers], ['removal prerequisite', prerequisite]])
      if (!value) problems.push(`${name}: the ${label} cell is empty`)
    if (!DISPOSITIONS.has(disposition)) problems.push(`${name}: disposition "${disposition}" is not one of ${[...DISPOSITIONS].join(', ')}`)
    const expected = callersCell(row.path, removal)
    if (callers !== expected) problems.push(`${row.path}: callers are stale\n    document: ${callers}\n    tree:     ${expected}`)
  }
  const named = rows.flatMap((r) => (r.path ? [r.path] : [...r.cells[0].matchAll(/`([^`]+)`/g)].map((m) => m[1])))
  for (const file of tracked.filter((f) => COMPLETE_FOR.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p))))
    if (!named.some((p) => p === file || (p.endsWith('/') && file.startsWith(p)))) problems.push(`${file}: has no row in the inventory`)
  return problems
}

function rewrite(doc) {
  const { lines, rows } = parseInventory(doc)
  const removal = removalPaths(rows)
  for (const row of rows) {
    if (!row.path || row.cells.length !== 6) continue
    const next = [...row.cells]
    next[3] = callersCell(row.path, removal)
    lines[row.index] = `| ${next.join(' | ')} |`
  }
  return lines.join('\n')
}

/** The files below benchmarks/ (the only tree the completeness rule reads). */
export function trackedFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}${entry.name}`
      if (entry.isDirectory()) walk(`${rel}/`)
      else out.push(rel)
    }
  }
  walk('benchmarks/')
  return out
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode] = process.argv.slice(2)
  const file = join(ROOT, DOC)
  const doc = readFileSync(file, 'utf8')
  if (mode === '--write') {
    writeFileSync(file, rewrite(doc))
    console.log(`${DOC}: callers column rewritten from the tree`)
  } else if (mode === '--check') {
    const problems = inventoryProblems(doc, trackedFiles())
    if (problems.length) {
      console.error(`${DOC} no longer equals the tree:\n  - ${problems.join('\n  - ')}\nRun: node scripts/legacy-inventory.mjs --write (callers), and add or fix the row by hand (owner, disposition, prerequisite).`)
      process.exit(1)
    }
    const { rows } = parseInventory(doc)
    console.log(`${DOC}: ${rows.length} inventory rows, each with owner, disposition, callers and removal prerequisite; callers equal the tree.`)
  } else if (mode && !mode.startsWith('--')) {
    const { rows } = parseInventory(doc)
    console.log(callersCell(mode, removalPaths(rows)))
  } else {
    console.error('usage: node scripts/legacy-inventory.mjs --check | --write | <path>')
    process.exit(2)
  }
}
