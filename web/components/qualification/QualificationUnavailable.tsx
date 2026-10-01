import { EmptyState } from '../feedback';
import { Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import styles from './QualificationUnavailable.module.css';
import type { QualificationUnavailableProps } from './types';

/**
 * The qualification page when the view cannot be shown: not built (the normal state in CI), unreadable or built from
 * other pins than this checkout's. It says which, why and the commands that produce a usable view. It never shows a number.
 */
export function QualificationUnavailable({ breadcrumb, eyebrow, title, lede, heading, reason, commands }: QualificationUnavailableProps) {
  return (
    <Stack gap="xl" className={styles.unavailable}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} />
      <EmptyState title={heading} command={commands.join('\n')}>
        <p>{reason}</p>
      </EmptyState>
    </Stack>
  );
}
