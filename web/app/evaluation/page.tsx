import type { Metadata } from 'next';
import { EvaluationHub } from '../../components/evaluation/hub';
import { resolveEvaluationHubPage } from '../../resolvers/evaluation-pages';

export const metadata: Metadata = { title: 'Evaluation' };

/** `/evaluation`: the section's front door. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  return <EvaluationHub {...await resolveEvaluationHubPage()} />;
}
