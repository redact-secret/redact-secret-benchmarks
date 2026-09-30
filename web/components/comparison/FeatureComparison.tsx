import Link from 'next/link';
import { cx } from '../../lib/cx';
import { Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import type { Crumb } from '../page';
import { FeatureSources } from './FeatureSources';
import { FeatureTable } from './FeatureTable';
import { FeatureToolbar } from './FeatureToolbar';
import type { FeatureFilter, FeatureGroup, FeatureLibrary, FeatureSource } from './types';
import styles from './FeatureComparison.module.css';

export interface FeatureComparisonProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  /** The link to the measured page, since a listed feature is not a measured one. */
  runtime: { href: string; label: string };
  libraries: FeatureLibrary[];
  groups: FeatureGroup[];
  filter: FeatureFilter;
  onFilterChange: (filter: FeatureFilter) => void;
  sourcesTitle: string;
  sources: FeatureSource[];
  className?: string;
}

/** `/comparison/feature`: one grouped table of what each library says it can do, with its filter bar and sources. */
export function FeatureComparison({ breadcrumb, eyebrow, title, lede, runtime, libraries, groups, filter, onFilterChange, sourcesTitle, sources, className }: FeatureComparisonProps) {
  return (
    <Stack gap="lg" className={cx(styles.page, className)}>
      <PageHead
        before={<Breadcrumb items={breadcrumb} />}
        eyebrow={eyebrow}
        title={title}
        lede={lede}
        actions={<Link className={styles.link} href={runtime.href}>{runtime.label}</Link>}
      />
      <FeatureToolbar filter={filter} onFilterChange={onFilterChange} />
      <FeatureTable libraries={libraries} groups={groups} filter={filter} caption="What each library says it can do. A mark means listed only." />
      <FeatureSources title={sourcesTitle} sources={sources} />
    </Stack>
  );
}
