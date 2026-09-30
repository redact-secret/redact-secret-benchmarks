import { cx } from '../../lib/cx';
import { Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import type { Crumb, MetaItem } from '../page';
import { RuntimeFacts } from './RuntimeFacts';
import { RuntimeQuestionTable } from './RuntimeQuestionTable';
import { RuntimeSwitches } from './RuntimeSwitches';
import type { RuntimeSwitchesProps } from './RuntimeSwitches';
import { RuntimeToolbar } from './RuntimeToolbar';
import type { RuntimeToolbarProps } from './RuntimeToolbar';
import type { RuntimeColumn, RuntimeFactRow, RuntimeQuestion } from './types';
import styles from './RuntimeComparison.module.css';

export interface RuntimeComparisonProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  switches: Pick<RuntimeSwitchesProps, 'analysis' | 'domain'>;
  /** Omitted when there is nothing to switch, for example a domain with no measurement yet. */
  toolbar?: Omit<RuntimeToolbarProps, 'className'>;
  columns: RuntimeColumn[];
  columnKind: string;
  questions: RuntimeQuestion[];
  factsTitle: string;
  factColumns: RuntimeColumn[];
  facts: RuntimeFactRow[];
  run?: MetaItem[];
  notes?: string[];
  className?: string;
}

/** `/comparison/runtime`: three questions as tables of what each library or setting hid, then what the libraries are. Shows, never grades. */
export function RuntimeComparison({ breadcrumb, eyebrow, title, lede, switches, toolbar, columns, columnKind, questions, factsTitle, factColumns, facts, run, notes, className }: RuntimeComparisonProps) {
  return (
    <Stack gap="lg" className={cx(styles.page, className)}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} actions={<RuntimeSwitches {...switches} />} />
      {toolbar && <RuntimeToolbar {...toolbar} />}
      <Stack gap="xl">
        {questions.map(q => (
          <RuntimeQuestionTable key={q.id} question={q} columns={columns} columnKind={columnKind} view={toolbar?.view} />
        ))}
      </Stack>
      <RuntimeFacts title={factsTitle} columns={factColumns} rows={facts} run={run} notes={notes} />
    </Stack>
  );
}
