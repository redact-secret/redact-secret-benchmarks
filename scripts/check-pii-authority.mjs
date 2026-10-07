/**
 * CI gate: `benchmarks/pii-authority.json` (#666) is the one committed value that says which pipeline is the authority for PII
 * measurement. It is independent of the credential qualification authority file: a credential authority setting is not authorisation for PII.
 *
 * This gate checks that the file validates against `schemas/pii-authority-v1.json`; that every `computed` exit criterion records exactly
 * what the committed tree computes (so a criterion can be neither marked met by hand nor left unmet after its evidence arrived); that
 * `new`, if it is the value, is authorised by an owner record and by every part the repository holds (engine pin, product policy, the
 * four population artifacts, an accepted decision, every criterion met); and that nothing outside the listed readers names the file.
 * It reads no measurement, runs no scanner and asserts nothing about the product. `legacy` asks nothing of the new path beyond the
 * honest record of the criteria.
 *
 * Run: npm run pii:authority:check
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { officialRecordExists, officialRecordProblems } from './lib/pii-official-record.mjs';
import { PII_AUTHORITY_FILE, criteriaDriftProblems, piiAuthorityFreshnessProblems, piiAuthorityShapeProblems, unlistedPiiAuthorityReaders } from '../benchmarks/evaluation/domains/pii/authority.ts';

const root = new URL('../', import.meta.url);
const text = path => readFileSync(new URL(path, root), 'utf8');
const json = path => JSON.parse(text(path));
const jsonIfPresent = path => (existsSync(new URL(path, root)) ? json(path) : undefined);
const sha256 = value => createHash('sha256').update(value).digest('hex');

export const LINUX_REPLAY = 'benchmarks/pii-eval-population-dual-run/linux-replay.json';
export const REHEARSAL = 'docs/generated/pii-authority-rehearsal.json';
export const INVENTORY = 'docs/generated/pii-legacy-inventory.json';
export const OFFICIAL_RECORD = 'benchmarks/pii-eval-official-run/record.json';
export const OFFICIAL_PLAN = 'benchmarks/pii-eval-official-execution-plan.json';

/** The state of each `computed` criterion, from the committed tree. Pure of the network. */
export async function computeCriteria({ read = json, readIfPresent = jsonIfPresent } = {}) {
  const migration = read('benchmarks/pii-eval-migration.json');
  const pins = read('benchmarks/pii-eval-population-pins.json');
  const artifacts = migration.benchmarkPopulationDualRun.artifacts;
  // The target of the rehearsal and of an authorisation is what the consumer pins read now (the head of each population pin): the exploratory replays until an official run is recorded, that run's artifacts after.
  const digests = Object.fromEntries(pins.populations.map(p => [p.label, p.artifactDigest]));
  const met = ok => (ok ? 'met' : 'unmet');
  const state = {};

  state['population-dual-run-complete'] = met(migration.acceptance.benchmarkPopulationDualRun === 'accepted' && migration.acceptance.residual?.notRepresentableCases === 0);

  const replay = readIfPresent(LINUX_REPLAY);
  state['linux-engine-replay-equal'] = met(Boolean(replay) && replay.canonical === true && replay.engine?.binarySha256 === pins.build.binarySha256 &&
    replay.engine?.platform === 'linux-x64' && replay.verdict?.allEqualSemanticDigest === true && replay.verdict?.allReplaysByteIdentical === true &&
    artifacts.every(a => replay.populations?.find(p => p.view === a.view)?.semanticDigestReplayed === a.semanticDigest));

  // Official mode is not a flag: the pins are official AND the recorded run (provenance, receipt, durable copies, the pinned engine, the production consumer over the committed copies) holds.
  state['official-mode-measurement'] = met(pins.populations.length > 0 && pins.populations.every(p => p.projection?.mode === 'official') &&
    officialRecordExists(root.pathname) && officialRecordProblems({ root: root.pathname }).length === 0);

  const { buildInventory, comparable, INVENTORY_FILE } = await import('./pii-legacy-inventory.mjs');
  const committedInventory = readIfPresent(INVENTORY_FILE);
  state['legacy-callers-inventoried'] = met(Boolean(committedInventory) && comparable(committedInventory) === comparable(buildInventory()));

  const rehearsal = readIfPresent(REHEARSAL);
  state['rollback-rehearsed-for-target'] = met(Boolean(rehearsal) && rehearsal.result?.restoredIdentical === true && rehearsal.result?.matrixIdenticalAcrossValues === true &&
    rehearsal.result?.legacyAccepted === true && rehearsal.result?.newWithoutAuthorisationRefused === true && rehearsal.result?.newAcceptedWhenAuthorised === true &&
    rehearsal.target?.engineCommit === migration.pins.piiEvalProjection &&
    pins.populations.every(p => rehearsal.target?.populationDigests?.[p.label] === p.artifactDigest));
  // Protected readiness is its own scope: computed here so the record is honest, never required for the public cutover.
  state['protected-path-live'] = met(migration.protectedPath?.state === 'live-verified' && migration.protectedPath?.liveProtectedArtifactConsumed === true);

  // The frozen target as the tree pins it now, compared field by field with what an owner authorisation names.
  const record = readIfPresent(OFFICIAL_RECORD);
  const plan = readIfPresent(OFFICIAL_PLAN);
  const target = {
    engineBinarySha256: pins.build.binarySha256,
    scannerPackageTreeSha256: record?.candidate?.packageTreeSha256 ?? '',
    protocol: { id: plan?.protocol?.id ?? '', revision: plan?.protocol?.revision ?? -1 },
    artifactSchema: pins.artifactSchema.version,
    manifestDigests: Object.fromEntries(pins.populations.map(p => [p.label, p.manifestDigest])),
    officialRunId: record?.workflow?.runId ?? 0,
  };
  return { state, digests, engineCommit: migration.pins.piiEvalProjection, target };
}

/** Tracked files that name the authority file, other than the file itself. */
export function filesNamingTheAuthorityFile(listing, read) {
  return listing.filter(path => !/\.(png|jpe?g|gif|ico|woff2?|lock|map)$/.test(path) && path !== 'package-lock.json' && path !== 'web/package-lock.json').filter(path => {
    const body = read(path);
    return body !== undefined && body.includes('pii-authority.json');
  });
}

export async function checkPiiAuthority({ listing } = {}) {
  const problems = [];
  const file = jsonIfPresent(PII_AUTHORITY_FILE);
  if (file === undefined) return [`${PII_AUTHORITY_FILE} is absent: the default is legacy, but the file is committed so that the switch is one reviewed value`];

  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(json('schemas/pii-authority-v1.json'));
  if (!validate(file)) problems.push(...(validate.errors ?? []).slice(0, 5).map(e => `schema: ${e.instancePath || '/'} ${e.message}`));
  problems.push(...piiAuthorityShapeProblems(file).map(p => `shape: ${p}`));
  if (problems.length) return problems;

  const computed = await computeCriteria();
  problems.push(...criteriaDriftProblems(file, computed.state));
  if (file.new.target.engine !== `redact-secret/pii-eval@${computed.engineCommit}`) problems.push(`new.target.engine names ${file.new.target.engine}, the migration record pins ${computed.engineCommit}`);
  if (JSON.stringify(file.new.target.populations) !== JSON.stringify(Object.keys(computed.digests))) problems.push('new.target.populations differ from the four pinned benchmark populations');
  const oracleDecision = existsSyncText(file.legacy.oracle.decision);
  if (oracleDecision === undefined) problems.push(`${file.legacy.oracle.decision} does not exist`);

  if (file.authority === 'new') {
    const auth = file.new.authorisation;
    const decision = auth ? existsSyncText(auth.decision) : undefined;
    problems.push(...piiAuthorityFreshnessProblems(file, {
      computed: computed.state, policyDigest: sha256(readFileSync(new URL('qualification/pii-v1.json', root))), engineCommit: computed.engineCommit,
      populationDigests: computed.digests, target: computed.target, decisionStatus: decision === undefined ? undefined : /^status:\s*(\S+)/m.exec(decision)?.[1],
    }));
  }

  const tracked = listing ?? execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const naming = filesNamingTheAuthorityFile(tracked, path => { try { return text(path); } catch { return undefined; } });
  for (const path of unlistedPiiAuthorityReaders(naming)) problems.push(`${path} names ${PII_AUTHORITY_FILE} and is not a listed reader: a reader is a decision, add it to PII_AUTHORITY_READERS and the spec`);
  return problems;
}

function existsSyncText(path) { try { return text(path); } catch { return undefined; } }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkPiiAuthority();
  if (problems.length > 0) {
    console.error(`${problems.length} PII-authority problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  const file = json(PII_AUTHORITY_FILE);
  const unmet = file.exitCriteria.filter(c => c.scope === 'public' && c.state !== 'met').map(c => c.id);
  const pending = file.exitCriteria.filter(c => c.scope === 'protected' && c.state !== 'met').map(c => c.id);
  console.log(`PII authority: ${file.authority}${file.authority === 'new' ? ' (public/synthetic measurement, authorised by an owner record; every public criterion met)' : ` (the new path is not consulted; ${unmet.length} public exit criteria unmet: ${unmet.join(', ')})`}; protected path ${file.protected.state}${pending.length ? ` (${pending.join(', ')} does not gate the public cutover)` : ''}; only listed readers name the file.`);
}
