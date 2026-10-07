#!/usr/bin/env node
// Which validation a change needs (#655, #656). One changed-path dependency map, shared by `validate.yml` and its tests.
//
// A pull request is planned from its changed files; every other event (push to develop or main, the weekly schedule, a dispatch) runs everything,
// so the integration branch, the release and the scheduled run are always the full suite. The plan only ever removes work whose inputs did not
// change, and it errs towards running: a file this map does not recognise runs everything, and so does a failed diff.
//
//   node scripts/ci-plan.mjs --event pull_request            (changed files = HEAD^1..HEAD of the merge commit the runner checked out)
//   node scripts/ci-plan.mjs --event push
//   node scripts/ci-plan.mjs --files a.ts,b.ts --event pull_request     (tests, local use)
//
// It writes `legacy`, `web`, `web_scope`, `layout_select`, `browser`, `legacy_key` and `view_key` to $GITHUB_OUTPUT and a table of what was selected and why to
// $GITHUB_STEP_SUMMARY, so a skipped check is auditable. It asserts nothing about product output.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { importersOf } from './legacy-callers.mjs'

/** A change to these files changes every check: workflows and composite actions that run them, the lockfiles and the compiler/runtime pins. */
const EVERYTHING = [
  /^\.github\/workflows\/(validate|legacy-oracle)\.yml$/, /^\.github\/actions\//, /^package\.json$/, /^package-lock\.json$/, /^tsconfig\.json$/,
  /^web\/package(-lock)?\.json$/, /^scripts\/ci-plan\.mjs$/, /^scripts\/legacy-callers\.mjs$/, /^schemas\//, /^Dockerfile$/, /^\.dockerignore$/,
]

/**
 * Scripts that only the new path (official runs, the view, the adoption of an evidence snapshot) runs, and the publication-side scripts (#791: site assembly, the public exclusion guards,
 * the evaluation bundle publication check and retention planner): none is read by a measurement, so changing one re-runs the site build and `validate-sources`, never the scanners.
 * Any other script is shared code.
 */
const NEW_PATH_SCRIPTS = /^scripts\/(build-qualification-|export-qualification-|official-run|run-official-|check-official-runs|check-qualification-|record-official-run|provision-official-peers|adopt-evidence-snapshot|check-evidence-adoption|compare-adoption-views|derive-snapshot-inputs|export-|assemble-site|check-evaluation-bundle-publication|evaluation-bundle-retention|lib\/evaluation-bundle-deployment|check-feature-dataset-exclusion|check-blind-public)/

/** Benchmark-owned files only the new path reads: they change the view, never the legacy measurement. */
const NEW_PATH_BENCHMARKS = /^benchmarks\/(qualification\/|evidence-adoption\.json$|official-run|qualification-)/

/**
 * PII migration tooling and data (#666): the pii-eval consumer, the dual-run and linux-replay scripts, the committed pins and artifacts, the PII
 * authority record and its gate, the rollback rehearsal and the legacy-caller inventory. They read committed files and the pii-eval engine; none is
 * read by the legacy engine exercise, the four-scanner comparison or the legacy export (tests/pii-ci-lanes.test.mjs holds that through the import
 * graph). A change to only these runs the site build and the root unit tests, and `validate-sources` always runs their gates (`pii:*:check`), so
 * nothing is checked less: the legacy credential measurement is just not repeated for a change it cannot reach. The PII domain code itself
 * (`benchmarks/evaluation/domains/pii/`, which is the oracle) stays a legacy input.
 */
export const PII_MIGRATION = [
  /^scripts\/(adopt-pii-engine|pii-official-plan|pii-scorer-basis|replay-pii-populations|run-pii-population-dual-run|convert-pii-populations|check-pii-eval-migration|fetch-pii-eval-public-synthetic|check-custodian-conformance|check-pii-authority|pii-legacy-inventory|rehearse-pii-authority-rollback|run-pii-official|record-pii-official-run)\.mjs$/,
  /^scripts\/(lib\/pii-population-|lib\/pii-(tree-digest|official-record)\.mjs$|pii-eval-population-parity\/)/,
  /^benchmarks\/(pii-eval-|pii-authority\.json$)/,
  /^benchmarks\/evaluation\/domains\/pii\/(pii-eval-artifact-consumer|custodian-consumer|authority)\./,
]

/** Inputs of the legacy measurement (the oracle): the engine, its adapters, corpora, policy, pins and ledger, and shared scripts. */
const LEGACY = [
  (f) => /^benchmarks\//.test(f) && !NEW_PATH_BENCHMARKS.test(f) && !matches(PII_MIGRATION, f),
  (f) => /^(scanners|corpora|fixtures|peer-observations|qualification|holdout|adversarial|baselines|evidence|src)\//.test(f),
  (f) => /^scripts\//.test(f) && !NEW_PATH_SCRIPTS.test(f) && !matches(PII_MIGRATION, f),
  (f) => /^(vite\.config\.ts|index\.html)$/.test(f),
]

/** What the Next build reads besides web/: services read the benchmark files, the corpora, the legacy site's validators and the committed evidence. */
const WEB_INPUTS = [
  (f) => /^web\//.test(f),
  (f) => /^(benchmarks|src|scanners|corpora|fixtures|peer-observations|qualification|evidence|baselines|holdout|adversarial|public|scripts)\//.test(f),
  (f) => /^docs\/(specs\/qualification\/|generated\/)/.test(f),
  (f) => /^(vite\.config\.ts|index\.html)$/.test(f),
]

const DOCS = (f) => /^docs\//.test(f) || /\.md$/.test(f) || f === 'LICENSE' || f === '.gitignore'

/** Files no measurement and no page reads: prose, the root unit tests (their own job always runs), other workflows, agent and editor configuration. */
const IGNORED = [
  DOCS, /^tests\//, /^\.github\/(?!workflows\/(validate|legacy-oracle)\.yml$|actions\/)/, /^\.(claude|agents|vscode)\//, /^graft\//, /^\.gitguardian\.yaml$/, /^\.ignore$/, /^\.mcp\.json$/,
]

function matches(rules, f) { return rules.some((r) => (typeof r === 'function' ? r(f) : r.test(f))) }

/**
 * web/app/<route>/page.tsx -> the address it serves: `report/families` is that page alone ('' is the landing page), and a dynamic segment makes it
 * the pages below that point: `report/families/*`. The same matching is in web/scripts/check-layout.mjs and web/tests/e2e/fixtures.ts.
 */
export function routeOfPage(file) {
  const rel = file.replace(/^web\/app\//, '').replace(/\/?page\.tsx$/, '')
  const out = []
  for (const seg of rel.split('/').filter(Boolean)) {
    if (/^\(.*\)$/.test(seg)) continue
    if (/^\[.*\]$/.test(seg)) return `${out.join('/')}${out.length ? '/' : ''}*`
    out.push(seg)
  }
  return out.join('/')
}

const SHARED_WEB = (f) => /^web\/app\/(layout|not-found|template|global-error)\.tsx$/.test(f) || /^web\/app\/globals\.css$/.test(f) || /^web\/app\/data\//.test(f)

/**
 * The browser checks a web change needs. `{ full: true }` is every route and every story. Otherwise the routes (address prefixes) and the story
 * files whose rendering the changed files can reach through the import graph. Only components and routes are selectable: theme, layout, lib,
 * resolvers, services, configuration, browser tests and the data layer each reach every page, so they are the full suite.
 */
export function selectBrowserChecks(webFiles, importers = importersOf) {
  const reasons = []
  const routes = new Set()
  const stories = new Set()
  const seen = new Set()
  for (const f of webFiles) {
    if (/^web\/tests\/unit\//.test(f)) { reasons.push(`${f}: a unit test, no browser check reads it`); continue }
    if (!/^web\/(app|components)\//.test(f) || /^web\/app\/(layout|not-found|template|global-error)\./.test(f)) { reasons.push(`${f}: shared by every page (theme, layout, lib, resolvers, services, configuration, browser tests)`); return { full: true, reasons } }
    const queue = [f]
    while (queue.length) {
      const file = queue.pop()
      if (seen.has(file)) continue
      seen.add(file)
      if (SHARED_WEB(file)) { reasons.push(`${f}: reaches ${file}, which every page renders`); return { full: true, reasons } }
      if (/^web\/app\/.*page\.tsx$/.test(file)) routes.add(routeOfPage(file))
      if (/^web\/components\/.*\.stories\.tsx?$/.test(file)) stories.add(`./${file.replace(/^web\//, '')}`)
      // Only components and routes render a component. Resolvers, services and lib shape the props, and a change to them is the full suite above.
      for (const importer of importers(file)) if (/^web\/(components|app)\//.test(importer)) queue.push(importer)
    }
    reasons.push(`${f}: reaches ${[...seen].filter((x) => /page\.tsx$/.test(x)).length} page(s) and ${[...seen].filter((x) => /\.stories\.tsx?$/.test(x)).length} story file(s)`)
  }
  return { full: false, routes: [...routes].sort(), stories: [...stories].sort(), reasons }
}

/**
 * @param {{ files: string[], event: string, importers?: (f: string) => string[] }} input
 */
export function planChecks({ files, event, importers }) {
  if (event !== 'pull_request') {
    return { mode: 'full', why: `the ${event} event runs every check`, legacy: true, web: true, browser: true, webScope: 'full', layout: null, reasons: { legacy: [`${event}: complete suite`], web: [`${event}: complete suite`], webScope: [`${event}: complete suite`] } }
  }
  if (!files?.length) {
    return { mode: 'full', why: 'no changed file could be listed, so nothing is skipped', legacy: true, web: true, browser: true, webScope: 'full', layout: null, reasons: { legacy: ['no file list'], web: ['no file list'], webScope: ['no file list'] } }
  }
  const reasons = { legacy: [], web: [], webScope: [] }
  // A path this map does not know is not guessed at: it runs everything.
  const unknown = files.filter((f) => !matches(EVERYTHING, f) && !matches(LEGACY, f) && !matches(WEB_INPUTS, f) && !matches(IGNORED, f))
  const everything = [...files.filter((f) => matches(EVERYTHING, f)), ...unknown]
  const legacyHits = files.filter((f) => matches(LEGACY, f))
  const webHits = files.filter((f) => matches(WEB_INPUTS, f))
  const legacy = everything.length > 0 || legacyHits.length > 0
  const web = everything.length > 0 || webHits.length > 0
  for (const f of everything) { const why = unknown.includes(f) ? 'is not in the dependency map, so nothing is skipped' : 'changes every check'; reasons.legacy.push(`${f}: ${why}`); reasons.web.push(`${f}: ${why}`) }
  for (const f of legacyHits) reasons.legacy.push(`${f}: an input of the legacy measurement`)
  for (const f of webHits) reasons.web.push(`${f}: read by the site build`)
  let webScope = 'none'
  let layout = null
  if (web) {
    if (everything.length) { webScope = 'full'; reasons.webScope.push('a workflow, lockfile or configuration change reaches every page') }
    else {
      const webOnly = webHits.filter((f) => /^web\//.test(f))
      const other = webHits.filter((f) => !/^web\//.test(f))
      if (other.length) { webScope = 'full'; reasons.webScope.push(...other.map((f) => `${f}: data the pages are built from`)) }
      else {
        const sel = selectBrowserChecks(webOnly, importers)
        reasons.webScope.push(...sel.reasons)
        if (sel.full) webScope = 'full'
        else { webScope = 'selected'; layout = { routes: sel.routes, stories: sel.stories } }
      }
    }
  }
  const browser = web && !(webScope === 'selected' && !layout.routes.length && !layout.stories.length)
  const mode = legacy && web && webScope === 'full' ? 'full' : legacy || web ? 'selected' : 'none'
  return { mode, legacy, web, browser, webScope, layout, reasons, why: '' }
}

const LOCKS = new Set(['package.json', 'package-lock.json', 'tsconfig.json'])
// A change to this file changes how the legacy results and the view are produced, so it changes their keys too.
const PRODUCER = '.github/workflows/validate.yml'

/** The tracked files whose bytes decide a cached result: the inputs of the legacy measurement, or of the view (what the site is built from, minus web/). */
export function inputFiles(kind, tracked) {
  const legacy = (f) => matches(LEGACY, f)
  const view = (f) => matches(WEB_INPUTS, f) && !/^web\//.test(f)
  return tracked.filter((f) => f === PRODUCER || LOCKS.has(f) || (kind === 'legacy' ? legacy(f) : view(f))).sort()
}

/** The cache key of the legacy results and of the view: a digest of the bytes of their input files. Equal inputs, equal key. */
export function keyOf(kind, tracked, read = (f) => readFileSync(f)) {
  const hash = createHash('sha256')
  for (const f of inputFiles(kind, tracked)) hash.update(`${f}\0${createHash('sha256').update(read(f)).digest('hex')}\n`)
  return `${kind}-v1-${hash.digest('hex').slice(0, 40)}`
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean)
}

function changedFilesOfMergeCommit() {
  const out = execFileSync('git', ['diff', '--name-only', '--no-renames', 'HEAD^1', 'HEAD'], { encoding: 'utf8' })
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

function summary(plan, files) {
  const row = (name, on, why) => `| ${name} | ${on} | ${(why ?? []).slice(0, 6).join('<br>') || 'no changed file is an input'}${(why ?? []).length > 6 ? `<br>and ${(why ?? []).length - 6} more` : ''} |`
  return [
    '### Validation plan',
    '',
    `${files.length} changed file(s); ${plan.why || (plan.mode === 'none' ? 'nothing here reaches the legacy measurement or the site' : 'selected from the changed paths')}. A skipped job is listed as skipped on purpose; \`validate\` accepts a skip only when this plan says so.`,
    '',
    '| Check | Runs | Why |',
    '| --- | --- | --- |',
    row('Legacy oracle (engine, classification and comparison, legacy export and browser checks)', plan.legacy ? 'yes' : 'skipped', plan.reasons.legacy),
    row('Site build, unit and component tests, route export, new-authority view', plan.web ? 'yes' : 'skipped', plan.reasons.web),
    row('Browser checks (Playwright, layout)', !plan.browser ? 'skipped' : plan.webScope === 'full' ? 'full suite' : `selected: ${plan.layout.routes.length} route prefix(es), ${plan.layout.stories.length} story file(s)`, plan.reasons.webScope),
    '',
    ...(plan.layout?.routes.length ? [`Route prefixes: ${plan.layout.routes.map((r) => `\`/${r}\``).join(', ')}`, ''] : []),
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const event = arg('--event') ?? process.env.GITHUB_EVENT_NAME ?? 'pull_request'
  let files
  try { files = arg('--files') ? arg('--files').split(',').filter(Boolean) : event === 'pull_request' ? changedFilesOfMergeCommit() : [] } catch (error) {
    console.error(`::warning::could not list the changed files (${error.message}); running every check`)
    files = []
  }
  const plan = planChecks({ files, event })
  const out = {
    legacy: String(plan.legacy), web: String(plan.web), browser: String(plan.browser), web_scope: plan.webScope,
    layout_select: JSON.stringify(plan.layout ?? { all: true }),
  }
  try {
    const tracked = trackedFiles()
    out.legacy_key = keyOf('legacy', tracked)
    out.view_key = keyOf('view', tracked)
  } catch (error) {
    // No key means no cache hit is possible: a unique key makes the job measure.
    console.error(`::warning::could not compute the cache keys (${error.message}); the results are measured`)
    out.legacy_key = out.view_key = `none-${process.env.GITHUB_RUN_ID ?? Date.now()}`
  }
  console.log(JSON.stringify({ ...out, files: files.length }, null, 2))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(plan, files) + '\n')
}
