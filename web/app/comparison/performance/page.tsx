import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PerformancePair } from '../../../components/comparison';
import { DEFAULT_PEER, DEFAULT_SETTING } from '../../../resolvers/performance';
import { resolvePerformancePairPage } from '../../../resolvers/pages';
import { PerformanceSync } from './PerformanceSync';
import { PerformanceDropdowns, PerformanceReadingDialog } from './PerformanceControls';
import { PERFORMANCE_SCRIPT } from './performance-script';
import styles from './Performance.module.css';

export const metadata: Metadata = { title: 'Performance pair comparison' };

/**
 * `/comparison/performance`: redact-secret next to one other library, text by text, on one shared time axis.
 * A server component: it runs during `next build` and ships HTML. Every combination of `?with=` and `?setting=`
 * is a pre-rendered panel; the URL picks one after hydration, so a pair is shareable and nothing is fetched.
 */
export default async function Page() {
  const panels = await resolvePerformancePairPage();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PERFORMANCE_SCRIPT }} />
      <Suspense fallback={null}><PerformanceSync /></Suspense>
      {panels.map(panel => (
        <div key={panel.key} className={styles.panel} data-peer={panel.peer} data-setting={panel.setting} data-default={panel.peer === DEFAULT_PEER && panel.setting === DEFAULT_SETTING ? '' : undefined}>
          <PerformancePair {...panel.props} pickerContent={<PerformanceDropdowns picker={panel.props.picker} />} firstContent={<PerformanceReadingDialog note={panel.props.first} />} />
        </div>
      ))}
    </>
  );
}
