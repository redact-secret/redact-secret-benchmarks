/**
 * The six routes of the new site, and the navigation derived from them.
 *
 * `/comparison/runtime` follows issue #547; the design spec's mockup URL says
 * `/comparison/runtime-comparison`. The issue is the contract for this build.
 * The spec's global tab order keeps Report first and Comparison second; the
 * other entrances in that list (Coverage, Support, Performance, How to read)
 * are not part of this migration and stay on the existing site. Evaluation
 * (epic #543 follow-up) replaces the existing site's `/workbench`.
 */
export interface RouteEntry {
  href: string; label: string; title: string; summary: string;
  /** A path prefix that also marks this entry current, for an entry that stands for a family of pages (the six method pages). */
  match?: string;
}
export interface Section { href: string; label: string; entries: RouteEntry[] }

export const SECTIONS: Section[] = [
  {
    href: '/report/',
    label: 'Report',
    entries: [
      { href: '/report/', label: 'Overview', title: 'Report', summary: 'What the ledger records for the published release, level by level.' },
      { href: '/report/providers/', label: 'Providers', title: 'Providers', summary: 'Every provider in the taxonomy and what the ledger records for it.' },
      { href: '/report/families/', label: 'Families', title: 'Families', summary: 'Every credential family, with the evidence behind its recorded status.' },
      { href: '/report/detectors/', label: 'Detectors', title: 'Detectors', summary: 'Every detector family by the fixtures that exercise it, and what the run recorded for each group.' },
      { href: '/report/findings/', label: 'Findings', title: 'Findings', summary: 'Every finding this benchmark handed to the product, with its recorded status and the fixtures it rests on.' },
    ],
  },
  {
    href: '/comparison/',
    label: 'Comparison',
    entries: [
      { href: '/comparison/', label: 'Overview', title: 'How does redact-secret compare?', summary: 'Pick the question you came with.' },
      { href: '/comparison/feature/', label: 'Features', title: 'Feature comparison', summary: 'What each project says it can do, from its own documentation.' },
      { href: '/comparison/runtime/', label: 'Runtime', title: 'Runtime comparison', summary: 'Time and output on the same text, with what each one hid.' },
      { href: '/comparison/performance/', label: 'Performance', title: 'Performance pair comparison', summary: 'How long redact-secret and one other library take, text by text, on one scale.' },
      { href: '/comparison/accuracy/', label: 'Accuracy', title: 'Accuracy, one pair at a time', summary: 'redact-secret and one other tool, each read against the expected answer for the same test files.' },
    ],
  },
  {
    href: '/evaluation/',
    label: 'Evaluation',
    entries: [
      { href: '/evaluation/', label: 'Overview', title: 'Evaluation', summary: 'The evaluation methods, the run behind them and the pages that read it.' },
      { href: '/evaluation/method/twin/', label: 'Methods', title: 'Evaluation methods', summary: 'Six methods, each with how it runs and what was recorded for it.', match: '/evaluation/method/' },
      { href: '/evaluation/scanner/', label: 'Scanners', title: 'Scanners and where they ran', summary: 'The scanners the benchmark ran with, how each was pinned and run, and what was left out.' },
      { href: '/evaluation/rc/', label: 'Release candidate', title: 'What changed in the release candidate?', summary: 'A pinned candidate read against the published release.' },
      { href: '/evaluation/pii/', label: 'Personal data', title: 'How is personal data evaluated?', summary: 'The personal-data domain: its families, fixtures and what was recorded.' },
      { href: '/evaluation/credential/', label: 'Credentials', title: 'How are credentials evaluated?', summary: 'The credential domain: its families, fixtures and what was recorded.' },
    ],
  },
];

/**
 * The pages the Evaluation overview lists besides the methods. Every one is also an entry of the Evaluation section above;
 * the overview links a phase only when its page is an entry there, and otherwise names it as not in this build, so no link
 * points at a route the export does not contain.
 */
export const EVALUATION_PHASES: RouteEntry[] = [
  { href: '/evaluation/scanner/', label: 'Scanners', title: 'Scanners and where they ran', summary: 'The scanners the benchmark ran with, how each was pinned and run, and what was left out.' },
  { href: '/evaluation/rc/', label: 'Release candidate', title: 'What changed in the release candidate?', summary: 'A pinned candidate read against the published release.' },
  { href: '/evaluation/pii/', label: 'Personal data', title: 'How is personal data evaluated?', summary: 'The personal-data domain: its families, fixtures and what was recorded.' },
  { href: '/evaluation/credential/', label: 'Credentials', title: 'How are credentials evaluated?', summary: 'The credential domain: its families, fixtures and what was recorded.' },
];

export const ROUTES: RouteEntry[] = SECTIONS.flatMap(s => s.entries);

/** Normalise a pathname to the trailing-slash form the export uses. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || '/';
  return clean.endsWith('/') ? clean : `${clean}/`;
}

export function sectionFor(path: string): Section | undefined {
  const p = normalizePath(path);
  return SECTIONS.find(s => p === s.href || p.startsWith(s.href));
}

/** True when `path` is the entry's page, or sits under the prefix the entry stands for. */
export function isCurrentEntry(entry: RouteEntry, path: string): boolean {
  const p = normalizePath(path);
  return p === entry.href || Boolean(entry.match && p.startsWith(entry.match));
}
