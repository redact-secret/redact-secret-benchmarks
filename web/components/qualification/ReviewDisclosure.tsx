import { cx } from '../../lib/cx';
import styles from './ReviewDisclosure.module.css';
import type { ReviewDisclosureProps } from './types';

/**
 * The review state of some fixtures behind a number, in both languages, with the note that says what it means. Words and count are
 * passed in already formatted; the block derives nothing and never calls the review independent.
 */
export function ReviewDisclosure({ labels, count, note, className }: ReviewDisclosureProps) {
  return (
    <div className={cx(styles.disclosure, className)} data-review-disclosure>
      <p className={styles.labels}>
        <span lang="ko">{labels.ko}</span>
        <span lang="en">{labels.en}</span>
      </p>
      <p className={styles.count}>{count}</p>
      <p className={styles.note}>{note}</p>
    </div>
  );
}
