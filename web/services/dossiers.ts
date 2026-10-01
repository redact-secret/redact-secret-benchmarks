/**
 * Provider dossiers (`benchmarks/support/dossiers/<provider>.md`, #473): the research
 * record behind each taxonomy family. The hand-written frontmatter holds the verdict,
 * evidence tier, sources, research issues, evidence permalink, researched date and
 * what blocks the next stage; the prose body holds one `### \`family-id\`` section per
 * family with labelled notes (Shape, Sources, Issuance, Collisions, Open caveat, ...).
 *
 * The files are read and validated at build time with the checker CI runs
 * (`npm run dossiers:check`, scripts/scaffold-dossiers.mjs): a dossier that fails the
 * schema, names a family the taxonomy does not have or leaves one out fails the build.
 * Nothing is derived or invented here. A family whose dossier says `unresearched` has
 * empty notes; the page says so rather than showing a placeholder.
 *
 * Measured status, fixture counts and detector presence are never read from a dossier:
 * the dossier schema has no field for them (docs/decisions/2026-09-29-keep-provider-research-in-validated-dossiers.md).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter, run as checkDossiers } from '../../scripts/scaffold-dossiers.mjs';
import type { Taxonomy } from '../../benchmarks/support/taxonomy';
import { once, readJson, REPO_ROOT } from './repo';

export type Verdict = 'unresearched' | 'ready' | 'issuance-gated' | 'date-gated' | 'not-found' | 'rejected';
export type DossierTier = 'T0' | 'T1' | 'T2' | 'T3';

/** One labelled bullet of a family's section, as written: `- **Shape:** prefix ...`. Empty bullets are dropped. */
export interface DossierNote { label: string; text: string }

export interface DossierFamily {
  id: string;
  verdict: Verdict;
  tier: DossierTier | null;
  /** `YYYY-MM-DD`. */
  researchedAt: string | null;
  sources: string[];
  /** `owner/repo#N`. */
  issues: string[];
  evidence: string | null;
  blockedBy: string | null;
  notes: DossierNote[];
}

const SECTION = /^### `([^`]+)`/;
const NOTE = /^- \*\*([^*:]+):\*\*[ \t]*(.*)$/;
const HEADING = /^#{1,3} /;

/**
 * The labelled notes of each family section in a dossier body, by family id. A note is a top-level bullet
 * `- **Label:** text`, with its indented continuation lines joined by single spaces. A bullet with no text
 * (the scaffold's blank `- **Shape:**`) is dropped. Pure.
 */
export function parseDossierNotes(text: string): Map<string, DossierNote[]> {
  const lines = text.split('\n');
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  const body = lines.slice(end + 1);
  const sections = new Map<string, DossierNote[]>();
  let current: DossierNote[] | undefined;
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const section = SECTION.exec(line);
    if (section) { current = []; sections.set(section[1], current); continue; }
    if (HEADING.test(line)) { current = undefined; continue; }
    const note = current && NOTE.exec(line);
    if (!current || !note) continue;
    const parts = [note[2].trim()];
    for (let j = i + 1; j < body.length; j++) {
      const next = body[j];
      if (/^\s+\S/.test(next)) { parts.push(next.trim()); i = j; continue; }
      if (next.trim() === '' && j + 1 < body.length && /^\s+\S/.test(body[j + 1])) continue;
      break;
    }
    const joined = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (joined) current.push({ label: note[1].trim(), text: joined });
  }
  return sections;
}

interface FrontmatterFamily {
  id: string;
  research: { verdict: Verdict; tier: DossierTier | null; sources: string[]; issues: string[]; evidence: string | null; researchedAt: string | null };
  blockedBy: string | null;
}

/** Every taxonomy family's dossier entry, by family id. Fails the build on an invalid or incomplete dossier set. */
export function loadDossiers(): Promise<Map<string, DossierFamily>> {
  return once('dossiers', async () => {
    const dir = path.join(REPO_ROOT, 'benchmarks/support/dossiers');
    const taxonomy = await readJson<Taxonomy>('benchmarks/support/taxonomy.json');
    const { problems } = checkDossiers({ dir, check: true, taxonomy });
    if (problems.length) throw new Error(`the provider dossiers are invalid; run npm run dossiers:check: ${problems.join('; ')}`);
    const files = (await readdir(dir)).filter(f => f.endsWith('.md') && !f.startsWith('_'));
    const families = new Map<string, DossierFamily>();
    for (const file of files) {
      const text = await readFile(path.join(dir, file), 'utf8');
      const { data } = parseFrontmatter(text) as { data?: { families?: FrontmatterFamily[] } };
      const notes = parseDossierNotes(text);
      for (const entry of data?.families ?? []) {
        const { research } = entry;
        families.set(entry.id, {
          id: entry.id, verdict: research.verdict, tier: research.tier ?? null,
          researchedAt: research.researchedAt ? String(research.researchedAt) : null,
          sources: research.sources, issues: research.issues, evidence: research.evidence ?? null,
          blockedBy: entry.blockedBy ?? null, notes: notes.get(entry.id) ?? [],
        });
      }
    }
    return families;
  });
}
