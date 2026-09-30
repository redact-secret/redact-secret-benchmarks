import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RuntimeComparison } from '../../../components/comparison';
import { resolveRuntimeComparisonPage } from '../../../resolvers/pages';
import { RuntimeSync } from './RuntimeSync';
import { RUNTIME_SCRIPT } from './runtime-script';
import styles from './Runtime.module.css';

export const metadata: Metadata = { title: 'Runtime comparison' };

/**
 * `/comparison/runtime`: time on the same text, per library. A server component: it
 * runs during `next build` and ships HTML. Every combination of `?analysis=`,
 * `?domain=` and `?view=` is a pre-rendered panel; the URL picks one after hydration
 * (docs/decisions/2026-09-30-...), so a link stays shareable and nothing is fetched.
 */
export default async function Page() {
  const panels = await resolveRuntimeComparisonPage();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: RUNTIME_SCRIPT }} />
      <Suspense fallback={null}><RuntimeSync /></Suspense>
      {panels.map(panel => (
        <div key={panel.key} className={styles.panel} data-key={panel.key} data-default={panel.key === 'external-pii-all' ? '' : undefined}>
          <RuntimeComparison {...panel.props} />
        </div>
      ))}
    </>
  );
}
