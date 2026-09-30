import { PageIntro, type Fact } from '../components/shell';
import { loadLedgerSnapshot, type LedgerSnapshot } from '../lib/ledger';
import { ROUTES, sectionFor } from '../lib/routes';

export function routeEntry(href: string) {
  const entry = ROUTES.find(r => r.href === href);
  if (!entry) throw new Error(`No route entry for ${href}`);
  return entry;
}

/** One line naming the mode and source of every number on the page. */
export function sourceLine(s: LedgerSnapshot): string {
  return `${s.mode === 'published' ? 'Published' : 'Candidate'} mode: ${s.package} ${s.version}, read from the ledger at build time.`;
}

/**
 * The placeholder every route renders until its blocks land (#545, #546). It
 * shows values the ledger already records, chosen by `pick`, so the build-time
 * data path is exercised end to end. Server component: runs during `next build`.
 */
export async function RoutePage({ href, pick }: { href: string; pick: (s: LedgerSnapshot) => Fact[] }) {
  const entry = routeEntry(href);
  const snapshot = await loadLedgerSnapshot();
  return (
    <PageIntro
      eyebrow={sectionFor(href)?.label ?? 'Benchmarks'}
      title={entry.title}
      lede={entry.summary}
      facts={pick(snapshot)}
      source={sourceLine(snapshot)}
      placeholder="Placeholder content. The blocks for this page are built in Storybook first and assembled here in a later change."
    />
  );
}
