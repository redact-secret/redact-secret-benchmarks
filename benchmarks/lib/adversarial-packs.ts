/**
 * Filesystem side of the adversarial intake (#139): locate packs, read their
 * intake and first-run bytes, and apply the sample pack's rejection cases.
 * Rules live in adversarial-intake.ts; this module only reads.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HoldoutManifest } from '../../holdout/types.ts';
import { fileDigest, validateIntake, type IntakeRecord } from './adversarial-intake.ts';
import { adjudicationProblems, type Adjudication } from './adversarial-adjudication.ts';
import { independenceClaims, type EvidenceSources } from './evidence-classes.ts';

export const PACK_DIRECTORIES = ['adversarial/packs', 'adversarial/samples'] as const;

export interface LoadedPack {
  /** Repository-relative pack directory, e.g. `adversarial/packs/<id>`. */
  path: string;
  record: IntakeRecord;
  firstRunBytes: string | null;
  /** `adjudication.json`, when the pack's submitted expectations have been adjudicated (#322). */
  adjudication: Adjudication | null;
}

export function loadPacks(root: string): LoadedPack[] {
  const packs: LoadedPack[] = [];
  for (const parent of PACK_DIRECTORIES) {
    const absolute = join(root, parent);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true }).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${parent}/${entry.name}`;
      const record = JSON.parse(readFileSync(join(root, path, 'intake.json'), 'utf8')) as IntakeRecord;
      const firstRunPath = join(root, path, 'first-run.json');
      const adjudicationPath = join(root, path, 'adjudication.json');
      packs.push({
        path, record,
        firstRunBytes: existsSync(firstRunPath) ? readFileSync(firstRunPath, 'utf8') : null,
        adjudication: existsSync(adjudicationPath) ? JSON.parse(readFileSync(adjudicationPath, 'utf8')) as Adjudication : null,
      });
    }
  }
  return packs;
}

/** Problems with every pack, each prefixed by its directory; a directory must be named after its pack id. */
export function packProblems(packs: readonly LoadedPack[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const pack of packs) {
    const name = pack.path.split('/').at(-1);
    if (pack.record?.id !== name) problems.push(`${pack.path}: directory name must equal the pack id`);
    if (ids.has(name!)) problems.push(`${pack.path}: pack id is used twice`);
    ids.add(name!);
    if (pack.path.startsWith('adversarial/samples/') !== (pack.record?.sample === true)) {
      problems.push(`${pack.path}: sample must be true exactly for packs under adversarial/samples/`);
    }
    problems.push(...validateIntake(pack.record, pack.firstRunBytes).map(problem => `${pack.path}: ${problem}`));
    if (pack.adjudication) {
      const firstRun = pack.firstRunBytes == null ? null : fileDigest(pack.firstRunBytes);
      problems.push(...adjudicationProblems(pack.adjudication, pack.record, firstRun).map(problem => `${pack.path}: ${problem}`));
    }
  }
  return problems;
}

/** Pack directory → SHA-256 of its first-run.json, for packs that have one. */
export function firstRunDigests(packs: readonly LoadedPack[]): Map<string, string | undefined> {
  return new Map(packs.map(pack => [pack.path, pack.firstRunBytes == null ? undefined : fileDigest(pack.firstRunBytes)]));
}

export function evidenceSources(root: string, packs: readonly LoadedPack[]): EvidenceSources {
  const holdoutManifests = readdirSync(join(root, 'holdout'))
    .filter(name => /manifest\.json$/.test(name))
    .sort()
    .map(name => ({ path: `holdout/${name}`, manifest: JSON.parse(readFileSync(join(root, 'holdout', name), 'utf8')) as HoldoutManifest }));
  return {
    regressionManifest: JSON.parse(readFileSync(join(root, 'corpora/regression/manifest.json'), 'utf8')),
    holdoutManifests,
    packs: packs.map(({ path, record }) => ({ path, record })),
  };
}

export interface RejectionCase {
  id: string;
  set: { pointer: string; value: unknown }[];
  firstRun?: 'tamper';
  expect: string | null;
}

function setPointer(target: unknown, pointer: string, value: unknown): void {
  const keys = pointer.split('/').slice(1).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
  const last = keys.pop()!;
  let node = target as Record<string, unknown>;
  for (const key of keys) node = node[key] as Record<string, unknown>;
  if (Array.isArray(node) && last === '-') node.push(value);
  else node[last] = value;
}

/** A deep copy of `pack` with one rejection case applied. */
export function applyRejectionCase(pack: LoadedPack, rejection: RejectionCase): { record: IntakeRecord; firstRunBytes: string | null } {
  const record = structuredClone(pack.record);
  for (const { pointer, value } of rejection.set) setPointer(record, pointer, structuredClone(value));
  const firstRunBytes = rejection.firstRun === 'tamper' && pack.firstRunBytes != null
    ? pack.firstRunBytes.replace('"status": "complete"', '"status": "failed"')
    : pack.firstRunBytes;
  return { record, firstRunBytes };
}

/** Problems with a sample's rejection cases: an expected rejection that did not happen, or an unexpected one. */
export function rejectionCaseProblems(pack: LoadedPack, cases: readonly RejectionCase[]): string[] {
  const problems: string[] = [];
  for (const rejection of cases) {
    const { record, firstRunBytes } = applyRejectionCase(pack, rejection);
    const found = validateIntake(record, firstRunBytes);
    if (rejection.expect === null) {
      if (found.length) problems.push(`${pack.path} case ${rejection.id}: expected a valid record, got ${found.join(' | ')}`);
    } else if (!found.some(problem => new RegExp(rejection.expect!).test(problem))) {
      problems.push(`${pack.path} case ${rejection.id}: expected a problem matching /${rejection.expect}/, got ${found.length ? found.join(' | ') : 'none'}`);
    }
  }
  return problems;
}

/** The rendered site: every page, component and shell string a reader can see. */
export const UI_SOURCES = ['index.html', 'src/main.ts', 'src/shell.ts', 'src/pages', 'src/components'] as const;

/**
 * Sentences in the site source that describe evidence as independent. Every
 * corpus the site renders is project-authored or public-control evidence, so
 * any unnegated independence claim there is a problem.
 */
export function uiLanguageProblems(root: string): string[] {
  const files: string[] = [];
  const walk = (path: string) => {
    const absolute = join(root, path);
    if (!existsSync(absolute)) return;
    const entries = readdirSync(absolute, { withFileTypes: true, recursive: false });
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|mjs|html)$/.test(entry.name)) files.push(child);
    }
  };
  for (const source of UI_SOURCES) {
    if (/\.(ts|html)$/.test(source)) files.push(source);
    else walk(source);
  }
  return files.sort().flatMap(file =>
    independenceClaims(readFileSync(join(root, file), 'utf8')).map(sentence => `${file}: project-authored evidence may not be described as independent: "${sentence.trim().slice(0, 160)}"`));
}
