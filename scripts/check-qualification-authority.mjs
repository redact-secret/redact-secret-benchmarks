/**
 * CI gate: `benchmarks/qualification-authority.json` (#608) is the one committed value that says which pipeline is the authority for
 * credential qualification. This gate checks that the file validates against `schemas/qualification-authority-v1.json`, that `new`
 * is still authorised by what the repository holds (the policy revision, the canonical official runs, the parity report and the
 * accepted decision), and that nothing outside the listed readers names the file. It reads no measurement and asserts nothing about
 * the product: an authorisation that no longer matches the pins is stale, and the fix is a new reviewed authorisation, not an edit
 * of this gate. `legacy` asks nothing of the new path.
 *
 * Run: npm run authority:check
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { AUTHORITY_FILE, authorityFreshnessProblems, authorityShapeProblems, unlistedReaders } from '../benchmarks/qualification/authority.ts';

const root = new URL('../', import.meta.url);
const readText = async path => readFile(new URL(path, root), 'utf8');
const readJson = async path => JSON.parse(await readText(path));
const readJsonIfPresent = async path => { try { return await readJson(path); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; } };

/** The anchor a heading line gets in rendered markdown: lower-cased, punctuation dropped, spaces to hyphens. */
const headingAnchor = line => line.replace(/^#{1,6}\s+/, '').trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-');

/** Tracked files that name the authority file, other than the file itself. */
export function filesNamingTheAuthorityFile(listing, read) {
  return listing.filter(path => !/\.(png|jpe?g|gif|ico|woff2?|lock|map)$/.test(path) && path !== 'package-lock.json' && path !== 'web/package-lock.json').filter(path => {
    const text = read(path);
    return text !== undefined && text.includes('qualification-authority.json');
  });
}

export async function checkQualificationAuthority({ listing } = {}) {
  const problems = [];
  const file = await readJsonIfPresent(AUTHORITY_FILE);
  if (file === undefined) return [`${AUTHORITY_FILE} is absent: the default is legacy, but the file is committed so that the switch is one reviewed value`];

  const schema = await readJson('schemas/qualification-authority-v1.json');
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  if (!validate(file)) problems.push(...(validate.errors ?? []).slice(0, 5).map(e => `schema: ${e.instancePath || '/'} ${e.message}`));
  problems.push(...authorityShapeProblems(file).map(p => `shape: ${p}`));
  if (problems.length) return problems;

  if (file.authority === 'new') {
    const { loadPolicyRevision } = await import('../benchmarks/qualification/inputs.ts');
    const registry = await readJson('benchmarks/official-runs.json');
    const decisionText = await readText(file.new.decision).catch(() => undefined);
    const exit = file.legacy.oracle.exit;
    const exitText = exit ? await readText(exit.decision).catch(() => undefined) : undefined;
    const [rehearsalPath, rehearsalAnchor] = exit ? exit.rollbackRehearsal.split('#') : [];
    const rehearsalText = exit ? await readText(rehearsalPath).catch(() => undefined) : undefined;
    problems.push(...authorityFreshnessProblems(file, {
      policyRevision: (await loadPolicyRevision()).revision,
      runs: registry.runs.map(r => ({ id: r.id, canonical: r.canonical === true, semanticDigest: r.artifact?.semanticDigest })),
      parity: await readJsonIfPresent(file.new.parityReport),
      decisionStatus: decisionText === undefined ? undefined : /^status:\s*(\S+)/m.exec(decisionText)?.[1],
      ...(exit ? {
        exitDecisionStatus: exitText === undefined ? undefined : /^status:\s*(\S+)/m.exec(exitText)?.[1],
        exitRehearsalPresent: rehearsalText !== undefined && rehearsalText.split('\n').some(l => /^#{1,6}\s/.test(l) && headingAnchor(l) === rehearsalAnchor),
      } : {}),
    }));
  }
  const oracleDecision = await readText(file.legacy.oracle.decision).catch(() => undefined);
  if (oracleDecision === undefined) problems.push(`${file.legacy.oracle.decision} does not exist`);

  const tracked = listing ?? execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const naming = filesNamingTheAuthorityFile(tracked, path => { try { return readFileSyncUtf8(path); } catch { return undefined; } });
  for (const path of unlistedReaders(naming)) problems.push(`${path} names ${AUTHORITY_FILE} and is not a listed reader: a reader is a decision, add it to AUTHORITY_READERS and the spec`);
  return problems;
}

import { readFileSync } from 'node:fs';
const readFileSyncUtf8 = path => readFileSync(new URL(path, root), 'utf8');

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = await checkQualificationAuthority();
  if (problems.length > 0) {
    console.error(`${problems.length} qualification-authority problem(s):\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  const file = await readJson(AUTHORITY_FILE);
  console.log(`Qualification authority: ${file.authority}${file.authority === 'new' ? ' (authorised: policy, canonical runs, parity report and decision hold)' : ' (the new path is not consulted)'}; only listed readers name the file.`);
}
