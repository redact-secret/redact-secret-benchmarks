import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccuracyPairComparison } from '../../../components/comparison';
import { pairScript } from '../../../resolvers/accuracy';
import { resolveAccuracyPairPage } from '../../../resolvers/pages';
import { RunNotes } from '../../report/RunNotes';
import { AccuracySync } from './AccuracySync';
import { Differences, DifferencesProvider } from './Differences';
import { panelCss } from './panel-css';
import styles from './Accuracy.module.css';

export const metadata: Metadata = { title: 'Accuracy comparison' };

/**
 * `/comparison/accuracy`: redact-secret and one other tool, read against the expected answer for
 * the same test files. A server component: it runs during `next build` and ships HTML. Every
 * reachable pair, evidence level and scope is a pre-rendered panel; `?data=&with=&level=&scope=&peers=`
 * picks one after load (docs/decisions/2026-09-30-...), so a link stays shareable and nothing is
 * re-rendered. The lists of differing files are built in the browser from one build-emitted JSON file
 * (`data/comparison/accuracy/differences.json`), fetched only when a reader opens one.
 */
export default async function Page() {
  const { options, panels, source, runState } = await resolveAccuracyPairPage();
  const defaultKey = panels.find(p => p.isDefault)?.key;
  const page = (
    <>
      <style dangerouslySetInnerHTML={{ __html: panelCss(panels.map(p => p.key)) }} />
      <script dangerouslySetInnerHTML={{ __html: pairScript(options) }} />
      <Suspense fallback={null}><AccuracySync options={options} /></Suspense>
      {runState.kind === 'measured' && <RunNotes state={runState} detailsInDialog />}
      {panels.map(panel => (
        <div key={panel.key} className={styles.panel} data-acc-panel="" data-key={panel.key} data-default={panel.key === defaultKey ? '' : undefined}>
          <AccuracyPairComparison
            {...panel.props}
            differences={Object.fromEntries(Object.entries(panel.differences).map(([id, slot]) => [id, <Differences key={id} slot={slot} />]))}
          />
        </div>
      ))}
    </>
  );
  return source ? <DifferencesProvider source={source}>{page}</DifferencesProvider> : page;
}
