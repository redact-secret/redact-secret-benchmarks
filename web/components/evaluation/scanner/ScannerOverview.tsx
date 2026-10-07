import { Stack } from '../../layout';
import { Breadcrumb, PageHead } from '../../page';
import type { Crumb, MetaItem } from '../../page';
import { OptionalScannerNote } from '../../qualification/OptionalScannerNote';
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
  profiles: ScannerProfileData[];
  /** Optional scanners the run did not measure (#763): stated beside the roster, so a scanner left out is never a silent absence. */
  notMeasured?: NotMeasuredScanner[];
}

/** `/evaluation/scanner`: the roster, the published and candidate note, then one profile per scanner. */
export function ScannerOverview({ breadcrumb, eyebrow, title, lede, meta, roster, modeNote, profiles, notMeasured }: ScannerOverviewProps) {
  return (
    <Stack gap="xl" className={styles.overview}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <ScannerRoster {...roster} />
      {notMeasured && <OptionalScannerNote scanners={notMeasured} variant="compact" />}
      <ScannerModeNote {...modeNote} />
      {profiles.map(profile => <ScannerProfile key={profile.id} {...profile} />)}
    </Stack>
  );
}
