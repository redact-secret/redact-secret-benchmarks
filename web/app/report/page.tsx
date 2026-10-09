import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Note } from '../../components/feedback';
import { Stack } from '../../components/layout';
import { PageHead } from '../../components/page';
import { FindingsFeed, PeerScannerSection, ReportHubTiles, ThreeAnswers } from '../../components/report';
import { resolveReportPage } from '../../resolvers/pages';
import { LEVEL_SCRIPT } from './level-script';
import { LevelSync } from './LevelSync';
import { RunNotes } from './RunNotes';
import styles from './Report.module.css';

export const metadata: Metadata = { title: 'Report' };

/**
 * `/report`: the hub, the three answers at each evidence level, what changed and
 * the other scanners. A server component: it runs during `next build` and ships
 * HTML. The three levels are three pre-rendered panels; `?level=` picks one on
 * the client (docs/decisions/2026-09-30-...), so the URL stays shareable.
 */
export default async function Page() {
  const data = await resolveReportPage();
  return (
    <Stack gap="lg">
      <script dangerouslySetInnerHTML={{ __html: LEVEL_SCRIPT }} />
      <Suspense fallback={null}><LevelSync /></Suspense>
      <PageHead eyebrow={data.head.eyebrow} title={data.head.title} lede={data.head.lede} />
      <RunNotes state={data.runState} detailsInDialog />
      <ReportHubTiles tiles={data.tiles} label="Report sections" />

      {data.byLevel?.map(({ level }) => (
        <div key={level.level} className={styles.panel} data-panel={level.level}>
          <ThreeAnswers
            title="Three answers"
            eyebrow={level.eyebrow}
            meta={data.answersMeta}
            levels={data.levels}
            currentLevelHref={level.href}
            answers={level.answers}
          />
        </div>
      ))}

      <FindingsFeed
        id="news"
        title={data.findings.title}
        description={data.findings.description}
        findings={data.findings.findings}
        allHref={data.findings.allHref}
        allLabel={data.findings.allLabel}
      />

      {data.byLevel?.map(({ level, peers }) => (
        <div key={level.level} className={styles.panel} data-panel={level.level}>
          {peers.hiddenByDefault ? (
            <>
              <div className={styles.peersHidden}>
                <Note tone="info" title={peers.title}>
                  Hidden by default. Project policy is this project’s masking policy: a peer’s rate here reflects scope, not accuracy, because a peer is not built to flag it.{' '}
                  <Link href="?level=T3&peers=1">Show anyway</Link>.
                </Note>
              </div>
              <div className={styles.peersShown}>
                <PeerScannerSection title={peers.title} description={peers.description} rows={peers.rows} notes={peers.notes} />
                <p><Link href="?level=T3">Hide</Link></p>
              </div>
            </>
          ) : (
            <PeerScannerSection title={peers.title} description={peers.description} rows={peers.rows} notes={peers.notes} />
          )}
        </div>
      ))}
    </Stack>
  );
}
