import assert from 'node:assert/strict';
import test from 'node:test';
import { branchName, moveEnginePin, replayablePin, replayEntry, reusableRun } from '../scripts/run-evidence-replay.mjs';
import { sha256Digest } from '../scripts/evidence-adoption.mjs';
import { attributeEngineEffect, ENGINE_TWIN_SCOPING } from '../scripts/attribute-engine-effect.mjs';
import { buildReceipt, receiptProblems, expectedStamps, DISCLOSURE, PAGES } from '../scripts/record-deployment-receipt.mjs';

const D = c => `sha256:${c.repeat(64)}`;
const registry = { engine: { tag: 'v0.1.0-alpha.5', revision: 'a'.repeat(40) }, scanners: [{ id: 'redact-secret', version: '0.1.0-beta.13', integrity: 'sha512-X' }] };
const ec = { evidenceRelease: 'snapshot-2026.10.05.2', manifestDigest: D('1'), adoptionKey: D('2'), engine: registry.engine, product: { version: '0.1.0-beta.13', integrity: 'sha512-X' }, ownerAcceptance: null };
const adoption = { state: 'accepted', candidate: {}, evidenceCandidate: ec };

test('the control replay refuses what is not an unaccepted evidence candidate on the active engine and product', () => {
  assert.equal(replayablePin({ adoption, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), ec);
  assert.throws(() => replayablePin({ adoption: { ...adoption, state: 'candidate' }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), /accepted adoption/);
  assert.throws(() => replayablePin({ adoption, registry, tag: 'snapshot-2000.01.01', manifestDigest: D('1') }), /no evidence candidate/);
  assert.throws(() => replayablePin({ adoption, registry, tag: ec.evidenceRelease, manifestDigest: D('9') }), /not sha256/);
  assert.throws(() => replayablePin({ adoption: { ...adoption, evidenceCandidate: { ...ec, ownerAcceptance: { acceptedBy: 'x' } } }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), /already accepted/);
  assert.throws(() => replayablePin({ adoption: { ...adoption, evidenceCandidate: { ...ec, engine: { tag: 'v9', revision: 'b'.repeat(40) } } }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), /moved engine/);
  assert.throws(() => replayablePin({ adoption: { ...adoption, evidenceCandidate: { ...ec, product: { version: '0.1.0-beta.14', integrity: 'sha512-Y' } } }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), /moved product/);
});

test('one branch per adoption key and one run per commit: a failed run is not reused, a running or successful one is', () => {
  assert.equal(branchName('snapshot-2026.10.05.2', D('f')), 'replay/snapshot-2026.10.05.2-ffffffffffff-control');
  const run = (id, conclusion, sha = 's', createdAt = '2026-10-05T10:00:00Z') => ({ databaseId: id, event: 'workflow_dispatch', headSha: sha, conclusion, createdAt });
  assert.equal(reusableRun([run(1, 'failure'), run(2, 'cancelled')], 's'), undefined);
  assert.equal(reusableRun([run(1, 'failure'), run(2, ''), run(3, 'success', 's', '2026-10-05T09:00:00Z')], 's').databaseId, 2);
  assert.equal(reusableRun([run(4, 'success', 'other')], 's'), undefined);
});

const record = (population, kind, extra = {}) => ({ population, kind, platform: 'linux-x64', benchmarkRevision: 's'.repeat(1), engine: { revision: 'a'.repeat(40) }, determinism: { semanticDigestsEqual: true }, configHash: D('c'), caseCounts: { x: 1 }, artifact: { semanticDigest: D(population[0]), digest: D('b') }, evidence: { release: { tag: ec.evidenceRelease } }, ...extra });
test('the replay entry keeps run identities and refuses a record that is not the control of this commit and candidate', () => {
  const records = [{ rel: 'public-evidence-snapshot', record: record('public-evidence-snapshot', 'plain') }, { rel: 'public-evidence-snapshot/methods', record: record('public-evidence-snapshot', 'methods') }, { rel: 'policy-corpus', record: record('policy-corpus', 'plain') }];
  const entry = replayEntry({ records, ec, tag: ec.evidenceRelease, runId: '7', sha: 's', branch: 'replay/x', archive: { release: 'official-runs-7', sha256: D('d') }, patchPath: 'p.patch' });
  assert.equal(entry.state, 'replayed');
  assert.deepEqual(entry.recordedRuns.map(r => r.id), ['policy-corpus@linux-x64', 'public-evidence-snapshot+methods@linux-x64', 'public-evidence-snapshot@linux-x64']);
  assert.deepEqual(Object.keys(entry.semanticDigests).sort(), ['policy-corpus', 'public-evidence-snapshot', 'public-evidence-snapshot+methods']);
  const bad = extra => () => replayEntry({ records: [{ rel: 'a', record: record('public-evidence-snapshot', 'plain', extra) }], ec, tag: ec.evidenceRelease, runId: '7', sha: 's', branch: 'b', archive: {}, patchPath: 'p' });
  assert.throws(bad({ determinism: { semanticDigestsEqual: false } }), /did not agree/);
  assert.throws(bad({ benchmarkRevision: 'z' }), /replay commit/);
  assert.throws(bad({ engine: { revision: 'e'.repeat(40) } }), /engine/);
  assert.throws(bad({ productCandidate: { id: 'x' } }), /not the control/);
  assert.throws(bad({ evidence: { release: { tag: 'snapshot-2000.01.01' } } }), /not snapshot-2026/);
});

test('a deployment receipt is built only from a successful push publish on the right branch whose commit holds the acceptance and whose pages carry the stamps', () => {
  const accepted = { evidenceRelease: 'snapshot-2026.10.05', engine: { tag: 'v0.1.0-alpha.5' }, product: { version: '0.1.0-beta.13' } };
  const stamps = expectedStamps(accepted);
  const page = `${Object.values(stamps).join(' ')} ${DISCLOSURE.join(' ')}`;
  const pages = Object.fromEntries(PAGES.map(p => [p, page]));
  const run = { databaseId: 5, conclusion: 'success', event: 'push', headBranch: 'develop', headSha: 'c'.repeat(40) };
  const ok = { environment: 'staging', run, pages, accepted, commitHasAcceptance: true };
  assert.deepEqual(receiptProblems(ok), []);
  const receipt = buildReceipt({ ...ok, verifiedOn: '2026-10-05' });
  assert.equal(receipt.runId, '5');
  assert.equal(receipt.site, 'https://staging.benchmarks.redactsecret.dev');
  const bad = change => receiptProblems({ ...ok, ...change }).join();
  assert.match(bad({ run: { ...run, conclusion: 'failure' } }), /not success/);
  assert.match(bad({ run: { ...run, event: 'workflow_dispatch' } }), /push-triggered/);
  assert.match(bad({ environment: 'production' }), /published from main/);
  assert.match(bad({ commitHasAcceptance: false }), /does not hold the owner acceptance/);
  assert.match(bad({ pages: { ...pages, '/report/': null } }), /could not be fetched/);
  assert.match(bad({ pages: { ...pages, '/report/': 'nothing' } }), /does not carry the evidenceRelease stamp/);
  assert.throws(() => buildReceipt({ ...ok, commitHasAcceptance: false, verifiedOn: 'x' }), /does not hold/);
});

test('the contrast attributes a difference to the evidence change the report names, and labels outcomes without inventing any (#690)', async () => {
  const { explainFromReport } = await import('../scripts/run-evidence-replay.mjs');
  const { outcomeLabel, comparisonEntry, renderMarkdown } = await import('../scripts/render-snapshot-contrast.mjs');
  const explain = explainFromReport({ evidenceRelease: 'snapshot-x', diff: { changed: [{ id: 'a--b', fields: ['grouping'], evidenceClass: ['project-policy', 'unresolved'] }, { id: 'c--d', fields: ['content'] }] } }, 'a maintainer decision');
  assert.equal(explain['a--b'], 'changed in snapshot-x (grouping; evidence class project-policy -> unresolved): a maintainer decision');
  assert.equal(explain['c--d'], 'changed in snapshot-x (content): a maintainer decision');
  const withTwin = explainFromReport({ evidenceRelease: 'snapshot-x', diff: { changed: [{ id: 'p--twin', fields: ['grouping'], evidenceClass: ['project-policy', 'unresolved'] }] } }, undefined, { 'p--twin': 'p--seed', 'q--twin': 'q--seed' });
  assert.match(withTwin['p--seed'], /a twin of this case/);
  assert.equal(withTwin['q--seed'], undefined, 'only the seed of a twin the release changed');
  assert.equal(outcomeLabel({ measurement: { type: 'positive', span_outcomes: ['EXACT', 'MISS'], leaked_bytes: 3 } }), 'positive EXACT/MISS leaked 3');
  assert.equal(outcomeLabel({ measurement: { type: 'control', flagged: false } }), 'control clear');
  assert.equal(outcomeLabel({ measurement: { type: 'pending' } }), 'pending');
  assert.equal(outcomeLabel(undefined), 'absent');
  const d = (id, cause) => ({ population: 'public-evidence-snapshot', scanner: 's', kind: 'case', id, before: { measurement: { type: 'control', flagged: false }, expected: [] }, after: { measurement: { type: 'pending' }, expected: [] }, cause, regression: false });
  const entry = comparisonEntry({ kind: 'k', newer: { label: 'n' }, older: { label: 'o' } }, { differences: 2, explained: 1, unexplained: 1, regressions: 0, byCause: { x: 1 }, explainedDifferences: [d('a', 'x')], unexplainedDifferences: [d('b', null)] });
  assert.equal(entry.plainCases.length, 2);
  assert.match(renderMarkdown('t', [entry]), /\*\*unexplained\*\*/);
  assert.match(renderMarkdown('t', [entry]), /UNEXPLAINED DIFFERENCES OR REGRESSIONS REMAIN/);
});

test('a moved engine is replayed only with the record\'s engineChange, and the moved pin is digest-checked (#773)', () => {
  const schema = Buffer.from('{"schema":"x"}');
  const to = { tag: 'v9.0.0', revision: 'b'.repeat(40) };
  const engineChange = { from: registry.engine, to, runArtifactSchemaSha256: sha256Digest(schema) };
  const moved = { ...ec, engine: to, engineChange };
  assert.equal(replayablePin({ adoption: { ...adoption, evidenceCandidate: moved }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), moved);
  assert.throws(() => replayablePin({ adoption: { ...adoption, evidenceCandidate: { ...moved, engineChange: { ...engineChange, from: { tag: 'v1', revision: 'c'.repeat(40) } } } }, registry, tag: ec.evidenceRelease, manifestDigest: D('1') }), /engineChange/);
  const pinned = moveEnginePin({ engine: { ...registry.engine, version: '0.1.0-alpha.5', runArtifactSchema: { path: 'schemas/r.json', sha256: D('0') } }, scanners: [], runs: [{ id: 'old', engine: { revision: registry.engine.revision } }, { id: 'new', engine: { revision: to.revision } }] }, engineChange, schema);
  assert.deepEqual(pinned.runs.map(r => r.id), ['new'], 'a run of the previous engine cannot match the moved pin');
  assert.deepEqual(pinned.engine, { tag: 'v9.0.0', revision: to.revision, version: '9.0.0', runArtifactSchema: { path: 'schemas/r.json', sha256: sha256Digest(schema) } });
  assert.throws(() => moveEnginePin({ engine: registry.engine, scanners: [] }, engineChange, Buffer.from('other')), /record names/);
});

test('engine-effect attribution splits the mechanisms and keeps the generic twin-scoping cause for the rest (#772)', () => {
  const twinOf = { 'anthropic--anthropic-admin01-key-api03-prefix-twin': 'anthropic--anthropic-admin01-key-dotenv', 'vercel--vercel-app-access-token-body-55-twin': 'vercel--vercel-app-access-token-dotenv', 'sendgrid--sendgrid-1-twin': 'sendgrid--sendgrid-dotenv' };
  const caseDiff = id => ({ kind: 'case', id });
  const assertion = id => ({ kind: 'assertion', id: `${id}|mutation|a|b|must-flip|` });
  const out = attributeEngineEffect([caseDiff('anthropic--anthropic-admin01-key-api03-prefix-twin'), assertion('anthropic--anthropic-admin01-key-dotenv'), caseDiff('vercel--vercel-app-access-token-body-55-twin'), assertion('vercel--vercel-app-access-token-dotenv'), caseDiff('sendgrid--sendgrid-1-twin'), caseDiff('polar--polar-1')], { 'polar--polar-1': 'changed' }, twinOf);
  assert.match(out['anthropic--anthropic-admin01-key-api03-prefix-twin'], /provider-wide coverage/);
  assert.equal(out['anthropic--anthropic-admin01-key-dotenv'], out['anthropic--anthropic-admin01-key-api03-prefix-twin']);
  assert.match(out['vercel--vercel-app-access-token-body-55-twin'], /security-first fallback/);
  assert.equal(out['vercel--vercel-app-access-token-dotenv'], out['vercel--vercel-app-access-token-body-55-twin']);
  assert.equal(out['sendgrid--sendgrid-1-twin'], ENGINE_TWIN_SCOPING);
  assert.equal(out['polar--polar-1'], 'changed');
});

import { viewEffect, renderMarkdown } from '../scripts/render-view-effect.mjs';
test('the view effect reads two views only: status and reason changes, counts, and a cause only where one is authored (#773)', () => {
  const fam = (family, value, reasons = []) => ({ family, status: { value, reasons } });
  const view = (families, revision, extra = {}) => ({ families, policy: { revision }, distribution: { stable: families.filter(f => f.status.value === 'stable').length }, stableDistribution: { documented: 1, empirical: 0 }, unmappedFamilies: [], undetected: [], knownGaps: [], ...extra });
  const a = view([fam('x', 'stable'), fam('y', 'provisional', ['r1 — text']), fam('z', 'stable')], 'rev-a');
  const c = view([fam('x', 'provisional', ['twinFailures: 1 > 0 — why']), fam('y', 'provisional', ['r2 — text']), fam('z', 'stable')], 'rev-c');
  const e = viewEffect(a, c, { effects: { x: 'engine: twin scoring' } });
  assert.deepEqual(e.statusChanges.map(r => [r.family, r.before, r.after, r.reasonsAdded, r.effect]), [['x', 'stable', 'provisional', ['twinFailures: 1 > 0'], 'engine: twin scoring']]);
  assert.deepEqual(e.reasonChangesWithoutStatusChange.map(r => [r.family, r.reasonsAdded, r.reasonsRemoved, r.effect]), [['y', ['r2'], ['r1'], 'cause: see the contrast']]);
  assert.deepEqual(e.policyRevision, { accepted: 'rev-a', candidate: 'rev-c' });
  assert.match(renderMarkdown({ release: 'snapshot-x', disclosure: 'd', basis: 'b', effect: e }), /1 families lose `stable` and 0 gain it\./);
});
