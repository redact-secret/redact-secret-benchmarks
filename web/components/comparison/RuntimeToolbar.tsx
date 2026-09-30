import { cx } from '../../lib/cx';
import { Legend, OutcomeMark } from '../data';
import { SegmentedNav } from '../nav';
import type { SegmentedNavItem } from '../nav';
import type { RuntimeLegendItem, RuntimeView } from './types';
import styles from './RuntimeToolbar.module.css';

export interface RuntimeToolbarProps {
  /** All, Speed and Accuracy as links (`?view=speed`), so the view is shareable and works without script. */
  views: SegmentedNavItem[];
  currentHref: string;
  /** The current view; the legend is hidden in `speed`, where there are no outcome icons to read. */
  view: RuntimeView;
  legend: RuntimeLegendItem[];
  className?: string;
}

/** The bar pinned under the site header while the question tables are on screen: the view switch and the outcome key. */
export function RuntimeToolbar({ views, currentHref, view, legend, className }: RuntimeToolbarProps) {
  return (
    <div className={cx(styles.bar, className)}>
      <SegmentedNav items={views} currentHref={currentHref} label="What to show" />
      <Legend
        className={cx(view === 'speed' && styles.hiddenLegend)}
        label="Outcome key"
        items={legend.map(item => <OutcomeMark key={item.outcome} outcome={item.outcome} label={item.label} />)}
      />
    </div>
  );
}
