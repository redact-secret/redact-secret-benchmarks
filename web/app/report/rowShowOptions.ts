import type { ReportShow } from '../../components/report/types';

/** "Show" choices of a rows table: every row, the ones that need a look, and redact-secret's two recorded problems. */
export const ROW_SHOW: { value: ReportShow; label: string }[] = [
  { value: 'all', label: 'All rows' },
  { value: 'signal', label: 'Needs a look' },
  { value: 'leaked', label: 'Left readable' },
  { value: 'flagged', label: 'Flagged' },
];

/** The level page also isolates the rows behind the near-twin figure. */
export const LEVEL_ROW_SHOW: { value: ReportShow; label: string }[] = [
  ...ROW_SHOW,
  { value: 'twins', label: 'Near-twins' },
];
