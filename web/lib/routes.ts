/**
 * The six routes of the new site, and the navigation derived from them.
 *
 * `/comparison/runtime` follows issue #547; the design spec's mockup URL says
 * `/comparison/runtime-comparison`. The issue is the contract for this build.
 * The spec's global tab order keeps Report first and Comparison second; the
 * other entrances in that list (Coverage, Support, Evaluation, Performance,
 * How to read) are not part of this migration and stay on the existing site.
 */
export interface RouteEntry { href: string; label: string; title: string; summary: string }
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
    ],
  },
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
