import { Stack } from '../../layout';
import { Breadcrumb, PageHead } from '../../page';
import type { Crumb, MetaItem } from '../../page';
import type { ReactNode } from 'react';
import type { NotMeasuredScanner } from '../../qualification/types';
import { ScannerModeNote } from './ScannerModeNote';
import { ScannerProfile } from './ScannerProfile';
import { ScannerRoster } from './ScannerRoster';
import styles from './ScannerOverview.module.css';
import type { ScannerModeNoteData, ScannerProfileData, ScannerRosterRow } from './types';

export interface ScannerOverviewProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  roster: { title: string; description: string; rows: ScannerRosterRow[] };
  modeNote: ScannerModeNoteData;
  modeNoteContent?: ReactNode;
  profiles: ScannerProfileData[];
  /** Optional scanner provenance remains in the resolved data; detailed explanations are shown on the qualification page. */
  notMeasured?: NotMeasuredScanner[];
}

/** `/comparison/scanner`: the roster, the published and candidate note, then one profile per scanner. */
export function ScannerOverview({ breadcrumb, eyebrow, title, lede, meta, roster, modeNote, profiles, modeNoteContent }: ScannerOverviewProps) {
  return (
    <Stack gap="xl" className={styles.overview}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <ScannerRoster {...roster} />
      {modeNoteContent ?? <ScannerModeNote {...modeNote} />}
      {profiles.map(profile => <ScannerProfile key={profile.id} {...profile} />)}
    </Stack>
  );
}
