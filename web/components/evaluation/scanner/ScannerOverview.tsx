import { Stack } from '../../layout';
import { Breadcrumb, PageHead } from '../../page';
import type { Crumb, MetaItem } from '../../page';
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
  profiles: ScannerProfileData[];
}

/** `/evaluation/scanner`: the roster, the published and candidate note, then one profile per scanner. */
export function ScannerOverview({ breadcrumb, eyebrow, title, lede, meta, roster, modeNote, profiles }: ScannerOverviewProps) {
  return (
    <Stack gap="xl" className={styles.overview}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <ScannerRoster {...roster} />
      <ScannerModeNote {...modeNote} />
      {profiles.map(profile => <ScannerProfile key={profile.id} {...profile} />)}
    </Stack>
  );
}
