import type { Metadata } from 'next';
import { QualificationOverview, QualificationUnavailable } from '../../../components/qualification';
import { resolveQualificationPage } from '../../../resolvers/qualification-pages';

export const metadata: Metadata = { title: 'Qualification from the official runs' };

/**
 * `/evaluation/qualification`: the Redact Secret qualification the adapter derived from the official credential-eval runs, beside
 * the existing report (#606). A server component: it runs during `next build` and ships HTML. It reads the pre-derived view
 * and never runs the evaluation; a build without a usable view shows why and the commands that make one.
 */
export default async function Page() {
  const page = await resolveQualificationPage();
  return page.state === 'ready' ? <QualificationOverview {...page.props} /> : <QualificationUnavailable {...page.props} />;
}
