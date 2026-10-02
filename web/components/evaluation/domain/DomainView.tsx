import { cx } from '../../../lib/cx';
import { SegmentedNav } from '../../nav';
import { Breadcrumb, PageHead } from '../../page';
import { PipelineStamp } from '../../qualification/PipelineStamp';
import { DomainCoverage } from './DomainCoverage';
import { DomainGlance } from './DomainGlance';
import { DomainMethod } from './DomainMethod';
import { DomainReading } from './DomainReading';
import { DomainStatus } from './DomainStatus';
import styles from './DomainView.module.css';
import type { DomainViewData } from './types';

export interface DomainViewProps extends DomainViewData {
  className?: string;
}

/**
 * One evaluation domain, in one order: head (with the switch to its pair), three facts, method, coverage, current
 * status, how to read the numbers, sources. `/evaluation/pii/` and `/evaluation/credential/` render this with their
 * own data and nothing else, so what differs between them is the ledger, never the design.
 */
export function DomainView({ head, pipeline, glance, method, coverage, status, reading, className }: DomainViewProps) {
  return (
    <div className={cx(styles.view, className)}>
      <PageHead
        before={<Breadcrumb items={head.breadcrumb} />}
        eyebrow={head.eyebrow}
        title={head.title}
        lede={head.lede}
        meta={head.meta}
        actions={<SegmentedNav label={head.pairLabel} items={head.pair} currentHref={head.currentHref} />}
      />
      {pipeline && <PipelineStamp {...pipeline} />}
      <DomainGlance items={glance} />
      <DomainMethod {...method} />
      <DomainCoverage {...coverage} />
      <DomainStatus {...status} />
      <DomainReading {...reading} />
    </div>
  );
}
