import type { Metadata } from 'next';
import { ComparisonHub } from '../../components/comparison';
import { resolveComparisonHubPage } from '../../resolvers/pages';

export const metadata: Metadata = { title: 'Comparison' };

/** `/comparison`: three questions and how the pages compare. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  return <ComparisonHub {...await resolveComparisonHubPage()} />;
}
