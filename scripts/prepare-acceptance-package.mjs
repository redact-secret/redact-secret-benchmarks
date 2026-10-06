#!/usr/bin/env node
/**
 * Prepare the reviewable acceptance package of an evidence candidate (#690, #680) as one command. Until now the patch, its digest, the views, the parity report, the derived inputs and the
 * owner report were assembled by hand. This builds them on a transient worktree and writes only DATA into this checkout; nothing is applied, accepted or deployed:
 *
 *   node scripts/prepare-acceptance-package.mjs --tag <snapshot tag> --manifest-digest sha256:<hex> [--peers-dir <dir holding the pinned trufflehog>] [--superseded-on YYYY-MM-DD]
 *
 * On a transient worktree of HEAD it does what the owner's acceptance branch would: `repin` (the earlier runs become historical receipts), records the control replay's four runs, stores them
 * in the registry-format archive (a release of this repository, verified by fetching it back), regenerates the three derived inputs from the snapshot and the methods run and proves them with the
 * `--check` commands, builds the candidate view, regenerates the legacy oracle (the pinned trufflehog 3.97.4 must be first on PATH) and the parity report (strict: zero unexplained), turns the
 * candidate into the accepted record (owner acceptance OWNER-TO-SET) and drafts the decision (status: proposed). The authority is not touched: the gate lists its readers and the owner renews it in a
 * reviewed commit, so the package carries the values to set (`candidate.acceptance.authorityValues`) and the patch does not change that file.
 * The result is `git diff` as `<tag>.acceptance.patch` with its sha256, and `candidate.acceptance` is written to the evidence candidate. Refuses unless the control replay is recorded.
 *
 * It never fills acceptedBy, acceptedOn or the decision status, never reads or writes the authority, never writes the accepted record in THIS checkout (only the transient copy, as a patch), and never deploys.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchArchive } from './replay-archive.mjs';
import { moveEngineInTree } from './run-evidence-replay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
const OWNER = 'OWNER-TO-SET';
const GENERATED = 'docs/generated/evidence-adoption';
const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'];
const readJson = (file, base = root) => JSON.parse(readFileSync(path.join(base, file), 'utf8'));
const writeJson = (file, value, base = root) => { mkdirSync(path.dirname(path.join(base, file)), { recursive: true }); writeFileSync(path.join(base, file), `${JSON.stringify(value, null, 2)}\n`); };

export const adrPath = (tag, engineTag = 'v0.1.0-alpha.5') => `docs/decisions/${new Date().toISOString().slice(0, 10)}-accept-${tag.replace(/\./g, '-')}-on-credential-eval-${engineTag.replace(/^v0\.1\.0-/, '').replace(/\./g, '-')}.md`;

/** Pure: the accepted record the owner's acceptance would write. The previous accepted adoption stays in it as history; the owner fields are OWNER-TO-SET. */
export function acceptedRecord({ record, decision }) {
  const ec = record.evidenceCandidate;
  const { acceptance, productCandidates, ...rest } = ec;
  void acceptance; void productCandidates;
  const previous = record.candidate;
  return {
    schema: record.schema,
    state: 'accepted',
    candidate: {
      ...rest,
      supersedesAccepted: {
        evidenceRelease: previous.evidenceRelease, manifestDigest: previous.manifestDigest, adoptionKey: previous.adoptionKey,
        // The earlier owner's decision, kept as history under other key names: the prepared patch must never carry an acceptedBy or acceptedOn line that is not OWNER-TO-SET.
        ownerDecision: previous.ownerAcceptance && { by: previous.ownerAcceptance.acceptedBy, on: previous.ownerAcceptance.acceptedOn, decision: previous.ownerAcceptance.decision },
        replay: { ciRun: previous.replay?.ciRun, archive: previous.replay?.archive }, deployment: previous.deployment,
        note: 'The previously accepted adoption stays the public numbers until this change is applied by the owner and deployed; its runs become historical receipts in benchmarks/official-runs.json.',
      },
      ownerAcceptance: { acceptedBy: OWNER, acceptedOn: OWNER, decision },
      deployment: { staging: null, production: null },
    },
  };
}

/** Pure: the draft decision (status proposed). It states the facts of the replay and leaves the decision and the owner statement to the owner. */
export function draftDecision({ tag, ec, decision, summary }) {
  const lines = [
    '---', `decision_id: decision-accept-${tag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-on-credential-eval-alpha-5`, 'status: proposed', 'scope: benchmarks',
    `title: Accept evidence ${tag} on credential-eval ${ec.engine.tag} with the published @redact-secret/core ${ec.product?.version ?? ''} as the credential qualification evidence`, 'decided_at: OWNER-TO-SET', '---', '',
    `# Accept evidence ${tag} on credential-eval ${ec.engine.tag} with the published @redact-secret/core ${ec.product?.version ?? ''}`, '',
    `**PROPOSED, NOT DECIDED.** Prepared by scripts/prepare-acceptance-package.mjs for the owner (#690, #680). Status stays \`proposed\` and the Decision and the owner statement are the owner's to write. Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): owner acceptance is not an independent review.`, '',
    '## Context', '',
    `\`${tag}\` (manifest \`${ec.manifestDigest}\`, corpus \`${ec.snapshotDigest}\`) supersedes the accepted \`${ec.supersedes?.evidenceRelease}\`. ${summary}`, '',
    '## Decision', '', 'OWNER-TO-SET', '', '## Consequences', '',
    'On acceptance the active evidence pin, the recorded runs (the previous ones as historical receipts), the derived overlays, the parity report and the authority file move to this release; the public numbers change only when this is merged and deployed. Rollback: revert the acceptance, or set the authority back to `legacy` (docs/specs/qualification-cutover.md).', '',
  ];
  void decision;
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

const sh = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 512 * 1024 * 1024, ...options });

export function prepare({ tag, manifestDigest, peersDir, supersededOn, engineReplayRun }) {
  const adoption = readJson('benchmarks/evidence-adoption.json');
  const ec = adoption.evidenceCandidate;
  if (adoption.state !== 'accepted' || ec?.evidenceRelease !== tag || ec.manifestDigest !== manifestDigest) throw new Error(`benchmarks/evidence-adoption.json records no evidence candidate ${tag} with that manifest digest`);
  if (ec.replay?.state !== 'replayed' || !ec.replay.archive) throw new Error('the control replay is not recorded: run scripts/run-evidence-replay.mjs first');
  if (ec.ownerAcceptance) throw new Error('the candidate carries an owner acceptance; nothing to prepare');
  const registry = readJson('benchmarks/official-runs.json');
  const pinnedTruffle = registry.scanners.find(s => s.id === 'trufflehog').version;
  const env = { ...process.env, PATH: `${peersDir ? `${path.resolve(peersDir)}:` : ''}${process.env.PATH}`, NODE_OPTIONS: '--max-old-space-size=8192' };
  const truffle = sh('trufflehog', ['--version'], { env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!truffle.includes(pinnedTruffle)) throw new Error(`trufflehog prints "${truffle}", the pin is ${pinnedTruffle}: put the pinned binary first on PATH (--peers-dir) before the legacy oracle runs`);
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'acceptance-'));
  const tree = path.join(scratch, 'tree');
  const run = (command, args, options = {}) => sh(command, args, { cwd: tree, env, ...options });
  try {
    sh('git', ['worktree', 'add', '--detach', tree, 'HEAD'], { cwd: root });
    symlinkSync(path.join(root, 'node_modules'), path.join(tree, 'node_modules'), 'dir');
    run('npm', ['run', '-s', 'fixtures:generate']);
    // 1. The control replay's artifacts, by the archive digest the record carries.
    const replay = path.join(scratch, 'replay');
    fetchArchive({ release: ec.replay.archive.release, sha256: ec.replay.archive.sha256, out: replay, repository: REPOSITORY });
    const runId = ec.replay.ciRun.split('/').pop();
    // 2. Repin and record the four runs.
    run('node', ['scripts/adopt-evidence-snapshot.mjs', 'repin', '--superseded-on', supersededOn ?? new Date().toISOString().slice(0, 10)]);
    // A candidate that moves the engine (record `engineChange`): the engine pin and schema move with it and the previous engine's runs of the other populations are dropped (#773).
    moveEngineInTree(tree, ec);
    for (const rel of ['policy-corpus', 'public-evidence-snapshot', 'public-evidence-snapshot/methods', 'regression-corpus']) run('npm', ['run', '-s', 'official-runs:record', '--', path.join(replay, rel, 'run-record.json'), '--date', supersededOn ?? new Date().toISOString().slice(0, 10)]);
    // 3. The registry-format archive, stored in a release (storage of bytes, not an acceptance) and fetched back against the registry.
    const archiveFile = readJson('benchmarks/official-run-archive.json', tree);
    archiveFile.release = { tag: `official-runs-registry-${runId}`, asset: `official-runs-${runId}.tar.gz` };
    archiveFile.source.ciRun = runId;
    writeJson('benchmarks/official-run-archive.json', archiveFile, tree);
    const pack = path.join(scratch, 'registry-pack');
    run('node', ['scripts/official-run-archive.mjs', 'pack', '--run', runId, '--out', pack]);
    let hasRelease = true;
    try { sh('gh', ['release', 'view', archiveFile.release.tag, '-R', REPOSITORY, '--json', 'tagName'], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { hasRelease = false; }
    if (!hasRelease) sh('gh', ['release', 'create', archiveFile.release.tag, path.join(pack, archiveFile.release.asset), '-R', REPOSITORY, '--target', 'develop', '--title', `Official run artifacts (CI run ${runId})`, '--notes', `The linux-x64 RunArtifacts of the control replay of the evidence candidate ${tag}, in the registry format an acceptance would record in benchmarks/official-runs.json. Stored for the prepared acceptance; nothing here is accepted. Verified by byte digest at every use.`]);
    run('node', ['scripts/official-run-archive.mjs', 'fetch', '--out', path.join(scratch, 'registry-fetch')], { env: { ...env, GITHUB_REPOSITORY: REPOSITORY } });
    // 4. The derived inputs from the snapshot and the methods run, proved with the --check commands.
    const snapshot = path.join(scratch, 'snapshot');
    run('node', ['scripts/fetch-pinned-public-snapshot.mjs', '--out', snapshot], { env: { ...env, GH_TOKEN: env.GH_TOKEN ?? sh('gh', ['auth', 'token']).trim() } });
    const snapshotFile = path.join(snapshot, 'credential-eval-corpus-snapshot.json');
    const methods = path.join(replay, 'public-evidence-snapshot/methods/artifact.json');
    const derived = path.join(scratch, 'derived');
    run('npm', ['run', '-s', 'qualification:derive-inputs', '--', '--snapshot', snapshotFile, '--plain-run', path.join(replay, 'public-evidence-snapshot/artifact.json'), '--methods-run', methods, '--out', derived]);
    for (const f of ['public-axis-overlay.json', 'public-twin-scope-map.json', 'public-review-ledger-map.json']) cpSync(path.join(derived, f), path.join(tree, 'benchmarks/support', f));
    run('npm', ['run', '-s', 'qualification:axis-overlay', '--', '--snapshot', snapshotFile, '--check']);
    run('npm', ['run', '-s', 'qualification:twin-scope', '--', '--snapshot', snapshotFile, '--check']);
    run('npm', ['run', '-s', 'qualification:ledger-rekey', '--', '--snapshot', snapshotFile, '--methods-run', methods, '--check']);
    // 5. The candidate view: the product populations' case metadata is a deterministic export of this checkout.
    for (const population of ['regression-corpus', 'policy-corpus']) {
      const exp = path.join(scratch, `export-${population}`);
      run('npm', ['run', '-s', 'qualification:export', '--', '--population', population, '--out', exp]);
      mkdirSync(path.join(replay, population, 'inputs'), { recursive: true });
      cpSync(path.join(exp, 'case-metadata.json'), path.join(replay, population, 'inputs/case-metadata.json'));
    }
    const view = path.join(scratch, 'view.json');
    run('npm', ['run', '-s', 'qualification:view', '--', '--artifacts', replay, '--out', view]);
    // 6. The legacy oracle and the parity report (strict).
    run('npm', ['run', '-s', 'bench'], { stdio: ['ignore', 'ignore', 'inherit'] });
    run('npm', ['run', '-s', 'eval:classify'], { stdio: ['ignore', 'ignore', 'inherit'] });
    run('npm', ['run', '-s', 'qualification:parity', '--', '--legacy-status', 'results-output/support-status.json', '--legacy-results', 'public/results', '--view', view, '--artifacts', replay, '--public-snapshot', snapshotFile, '--change-report', ec.changeReport, '--strict']);
    // 7. The prepared-acceptance block is part of the base the patch applies to (the patch removes the evidence candidate it lives in), so it is committed to the transient tree first and
    //    written to this checkout's record at the end, by the same code from the same record.
    const decision = adrPath(tag, ec.engine.tag);
    const patchFile = `${GENERATED}/${tag}.acceptance.patch`;
    const derivedDigest = f => `sha256:${createHash('sha256').update(readFileSync(path.join(derived, f))).digest('hex')}`;
    const viewData = JSON.parse(readFileSync(view, 'utf8'));
    const distribution = viewData.distribution ?? {};
    const recordedRuns = readJson('benchmarks/official-runs.json', tree).runs;
    const semanticDigests = Object.fromEntries(recordedRuns.map(r => [r.id.replace(/@.*$/, ''), r.artifact.semanticDigest]).sort(([a], [b]) => (a < b ? -1 : 1)));
    const acceptance = {
      note: 'Prepared for the owner (#690). Nothing here is accepted: the active pins, runs and authority file stay on the previous accepted evidence until the owner applies the patch and fills the OWNER-TO-SET fields. The patch applies to the commit that merges this candidate; the policy revision and the parity report in it are derived from the product inputs of that commit, so re-derive them if the product inputs change first.',
      report: `${GENERATED}/${tag}.md`, comparison: `${GENERATED}/${tag}.comparison.json`, patch: patchFile, patchDigestFile: `${patchFile}.sha256`, applies: `git apply ${patchFile}`,
      ownerFields: ['the authority: renew it in a reviewed commit with `authorityValues` (and set its acceptedOn and acceptedBy); the patch does not change it, so authority:check stays red until you do', 'benchmarks/evidence-adoption.json candidate.ownerAcceptance acceptedBy and acceptedOn', `${decision} status (proposed to accepted), decided_at and its Decision`],
      authorityValues: { release: `@redact-secret/core@${ec.product?.version ?? registry.scanners.find(x => x.id === 'redact-secret').version}`, policyRevision: viewData.policy?.revision, semanticDigests, parityReport: 'docs/generated/qualification-parity.json', decision },
      candidateView: { sha256: `sha256:${createHash('sha256').update(readFileSync(view)).digest('hex')}`, policyRevision: viewData.policy?.revision, distribution },
      derivedInputs: {
        snapshot: `credential-evidence release ${tag}, asset credential-eval-corpus-snapshot.json (gh release download ${tag} -R redact-secret/credential-evidence)`,
        axisOverlay: { file: 'benchmarks/support/public-axis-overlay.json', sha256: derivedDigest('public-axis-overlay.json'), check: 'npm run qualification:axis-overlay -- --snapshot <snapshot> --check' },
        twinScope: { file: 'benchmarks/support/public-twin-scope-map.json', sha256: derivedDigest('public-twin-scope-map.json'), check: 'npm run qualification:twin-scope -- --snapshot <snapshot> --check' },
        ledgerRekey: { file: 'benchmarks/support/public-review-ledger-map.json', sha256: derivedDigest('public-review-ledger-map.json'), check: 'npm run qualification:ledger-rekey -- --snapshot <snapshot> --methods-run <dir>/public-evidence-snapshot/methods/artifact.json --check' },
      },
    };
    const withAcceptance = { ...adoption, evidenceCandidate: { ...ec, acceptance } };
    writeJson('benchmarks/evidence-adoption.json', withAcceptance, tree);
    run('git', ['-c', 'user.name=acceptance', '-c', 'user.email=acceptance@localhost', 'commit', '-qm', 'base: the record with the prepared acceptance', '--', 'benchmarks/evidence-adoption.json']);
    // 8. The authority file (owner fields unset), the accepted record and the draft decision.
    writeJson('benchmarks/evidence-adoption.json', acceptedRecord({ record: withAcceptance, decision }), tree);
    writeFileSync(path.join(tree, decision), draftDecision({ tag, ec, decision, summary: `Candidate view: ${JSON.stringify(distribution)}; the report is ${GENERATED}/${tag}.md.` }));
    const decisions = readFileSync(path.join(tree, 'docs/decisions/DECISIONS.md'), 'utf8').replace(/\n*$/, '\n');
    writeFileSync(path.join(tree, 'docs/decisions/DECISIONS.md'), `${decisions}- [Accept evidence ${tag} on credential-eval ${ec.engine.tag} with the published @redact-secret/core ${ec.product?.version ?? ''} as the credential qualification evidence (PROPOSED)](${path.basename(decision)}) (#690, #680; owner acceptance OWNER-TO-SET)\n`);
    // 9. The patch and its digest; the acceptance block into THIS checkout's record.
    rmSync(path.join(tree, 'node_modules'), { force: true }); // the link to this checkout's modules is not part of the change
    run('git', ['add', '-A']);
    const patch = run('git', ['diff', '--cached', '--binary', 'HEAD']);
    mkdirSync(path.join(root, GENERATED), { recursive: true });
    writeFileSync(path.join(root, patchFile), patch);
    const digest = createHash('sha256').update(patch).digest('hex');
    writeFileSync(path.join(root, `${patchFile}.sha256`), `${digest}  ${path.basename(patchFile)}\n`);
    writeJson('benchmarks/evidence-adoption.json', withAcceptance);
    symlinkSync(path.join(root, 'node_modules'), path.join(tree, 'node_modules'), 'dir'); // back for the comparison, which runs in the tree (the patch is already taken)
    // 10. The views A and C for the owner report: the accepted runs of this checkout and the candidate's, with the product populations' case metadata (a deterministic export of the checkout).
    const dirA = path.join(scratch, 'accepted');
    sh('node', ['scripts/official-run-archive.mjs', 'fetch', '--out', dirA], { cwd: root, env: { ...env, GITHUB_REPOSITORY: REPOSITORY } });
    sh('npm', ['run', '-s', 'fixtures:generate'], { cwd: root });
    for (const population of ['regression-corpus', 'policy-corpus']) { mkdirSync(path.join(dirA, population, 'inputs'), { recursive: true }); cpSync(path.join(replay, population, 'inputs/case-metadata.json'), path.join(dirA, population, 'inputs/case-metadata.json')); }
    const viewA = path.join(scratch, 'view-accepted.json');
    sh('npm', ['run', '-s', 'qualification:view', '--', '--artifacts', dirA, '--out', viewA], { cwd: root, env });
    // The ENGINE effect (view B of the comparison): the accepted corpus replayed on the candidate's engine (`run-evidence-replay.mjs branch --engine-only`, one dispatch). Its artifacts have the moved
    // engine's schema, so the view is built with the engine-only pin patch applied to this checkout for that one command.
    let viewB = viewA;
    if (ec.engineChange) {
      if (!engineReplayRun) throw new Error(`${tag} moves the engine to ${ec.engine.tag}: pass --engine-replay-run <id> (the official run of \`run-evidence-replay.mjs branch --engine-only\`), so the engine effect is separated from the corpus effect`);
      const dirB = path.join(scratch, 'engine-replay');
      for (const population of POPULATIONS) {
        const into = path.join(scratch, `dl-${population}`);
        sh('gh', ['run', 'download', engineReplayRun, '-R', REPOSITORY, '-n', `official-run-${population}`, '-D', into], { cwd: root });
        cpSync(into, path.join(dirB, population), { recursive: true });
      }
      const enginePatch = path.join(root, `${GENERATED}/${tag}.engine-replay-pins.patch`);
      if (!existsSync(enginePatch)) throw new Error(`${enginePatch} is missing: cut the engine-effect branch first (run-evidence-replay.mjs branch --engine-only)`);
      sh('git', ['apply', enginePatch], { cwd: root });
      try {
        viewB = path.join(scratch, 'view-engine.json');
        sh('npm', ['run', '-s', 'qualification:view', '--', '--artifacts', dirB, '--out', viewB], { cwd: root, env });
      } finally { sh('git', ['apply', '-R', enginePatch], { cwd: root }); }
    }
    const candidateRecord = path.join(scratch, 'record-candidate.json');
    writeJson(candidateRecord, { schema: adoption.schema, state: 'candidate', candidate: ec }, '/');
    const changeReport = ec.changeReport;
    const comparison = (out, extra = []) => sh('node', ['--import', 'tsx', 'scripts/compare-adoption-views.ts', '--accepted', viewA, '--replay-old', viewB, '--candidate', view, '--candidate-methods', methods, '--candidate-inputs', derived,
      '--report', changeReport, '--record', candidateRecord, '--engine-from', adoption.candidate.engine.tag, '--engine-to', ec.engine.tag, ...out, '--strict', ...extra], { cwd: tree, env, stdio: ['ignore', 'inherit', 'inherit'] });
    // The comparison and the triage queue read the candidate's artifacts, whose schema is the moved engine's: they run in the transient tree, whose pins match, and write into this checkout by absolute path.
    comparison(['--out-json', path.join(root, `${GENERATED}/${tag}.comparison.json`), '--out-md', path.join(root, `${GENERATED}/${tag}.md`)]);
    // 11. The triage queue, exported with the ledger as it was before the owner's settlement rows (so it does not depend on them), and the re-evaluation of the settlements on this run's identities.
    const ledger = readJson('benchmarks/review-ledger.json');
    const preOwner = path.join(scratch, 'ledger-pre-owner.json');
    writeJson(preOwner, { ...ledger, entries: Object.fromEntries(Object.entries(ledger.entries).filter(([, e]) => !String(e.note ?? '').includes('Owner-decided settlement'))) }, '/');
    const queueComparison = path.join(scratch, 'comparison-pre-owner.json');
    comparison(['--out-json', queueComparison, '--out-md', path.join(scratch, 'comparison-pre-owner.md')], ['--ledger', preOwner]);
    const baseReport = adoption.candidate.changeReport;
    sh('node', ['--import', 'tsx', 'scripts/export-triage-queue.ts', '--artifacts', replay, '--snapshot', snapshotFile, '--record', candidateRecord, '--report', baseReport, '--comparison', queueComparison, '--run-records', replay,
      '--out-json', path.join(root, `${GENERATED}/${tag}.triage-queue.json`), '--out-md', path.join(root, `${GENERATED}/${tag}.triage-queue.md`)], { cwd: tree, env, stdio: ['ignore', 'inherit', 'inherit'] });
    const previousQueue = `${GENERATED}/${adoption.candidate.supersedes?.evidenceRelease}.triage-queue.json`;
    const reauthored = new Set();
    for (const t of [adoption.candidate.supersedes?.evidenceRelease, adoption.candidate.evidenceRelease, tag].filter(Boolean)) for (const f of ['snapshot-2026.10.04.4', t]) if (existsSync(path.join(root, `${GENERATED}/${f}.json`))) for (const c of readJson(`${GENERATED}/${f}.json`).diff?.changed ?? []) if ((c.fields ?? []).includes('content')) reauthored.add(c.id);
    const reauthoredFile = path.join(scratch, 'reauthored.json');
    writeFileSync(reauthoredFile, JSON.stringify([...reauthored].sort()));
    if (existsSync(path.join(root, previousQueue))) sh('node', ['--import', 'tsx', 'scripts/apply-ledger-settlements.ts', '--previous-queue', previousQueue, '--queue', `${GENERATED}/${tag}.triage-queue.json`, '--accepted-run', runId, '--decided-on', adoption.candidate.ownerAcceptance.acceptedOn,
      '--evidence-url', 'https://github.com/redact-secret/redact-secret-benchmarks/issues/698', '--reauthored', reauthoredFile, '--out-json', `${GENERATED}/${tag}.ledger-settlements.json`], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
    return { patch: patchFile, sha256: digest, distribution };
  } finally {
    try { sh('git', ['worktree', 'remove', '--force', tree], { cwd: root }); } catch { /* removed with the scratch directory */ }
    rmSync(scratch, { recursive: true, force: true });
    sh('git', ['worktree', 'prune'], { cwd: root });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
  try { console.log(JSON.stringify(prepare({ tag: option('tag'), manifestDigest: option('manifest-digest'), peersDir: option('peers-dir'), supersededOn: option('superseded-on'), engineReplayRun: option('engine-replay-run') }), null, 1)); }
  catch (error) { console.error(`acceptance package refused: ${error.message}`); process.exit(1); }
}
