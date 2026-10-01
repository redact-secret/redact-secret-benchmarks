import Link from 'next/link';
import { cx } from '../../../lib/cx';
import { DataTable } from '../../data';
import type { DataTableColumn } from '../../data';
import { EmptyState, StatusBadge } from '../../feedback';
import type { Status } from '../../feedback';
import { Grid, Section, Stack } from '../../layout';
import { NavRow } from '../../nav';
import { PageHead } from '../../page';
import type { MetaItem } from '../../page';
import { ListRow, RowList } from '../../disclosure';
import type { HubMethod, HubPhase, HubPrinciple, HubRunData, HubScanner } from './types';
import styles from './EvaluationHub.module.css';

export interface EvaluationHubProps {
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  phasesLabel: string;
  phases: HubPhase[];
  methodsTitle: string;
  methodsIntro: string;
  methods: HubMethod[];
  run: HubRunData;
  principlesTitle: string;
  principles: HubPrinciple[];
  className?: string;
}

const STATUS: Record<HubScanner['status'], { badge: Status; word: string }> = {
  complete: { badge: 'none', word: 'Complete' },
  unavailable: { badge: 'not-measured', word: 'Not measured' },
  unsupported: { badge: 'not-measured', word: 'Unsupported' },
  error: { badge: 'fail', word: 'Error' },
  unstable: { badge: 'unstable', word: 'Unstable' },
};

const scannerColumns: DataTableColumn<HubScanner>[] = [
  { key: 'name', header: 'Scanner', rowHeader: true, cell: s => s.name },
  { key: 'version', header: 'Version', cell: s => <code>{s.version}</code> },
  { key: 'mode', header: 'How it was run', cell: s => s.mode },
  { key: 'observed', header: 'Observed', cell: s => s.observed },
  { key: 'status', header: 'Execution', cell: s => <StatusBadge status={STATUS[s.status].badge}>{STATUS[s.status].word}</StatusBadge> },
];

/**
 * `/evaluation`: the section's front door. Four questions that the other phases answer, the six methods, the
 * one run all of them read (stated once, here, and not on every page), and the rules of reading. Pure render.
 */
export function EvaluationHub({ eyebrow, title, lede, meta, phasesLabel, phases, methodsTitle, methodsIntro, methods, run, principlesTitle, principles, className }: EvaluationHubProps) {
  return (
    <Stack gap="xl" className={cx(styles.hub, className)}>
      <PageHead eyebrow={eyebrow} title={title} lede={lede} meta={meta} />

      <nav className={styles.phases} aria-label={phasesLabel}>
        {phases.map(p => (
          <NavRow key={p.label} href={p.href} label={p.label} title={p.title} description={p.description} action={p.action} />
        ))}
      </nav>

      <Section title={methodsTitle} description={methodsIntro}>
        <RowList label={methodsTitle}>
          {methods.map(m => (
            <ListRow key={m.id} trailing={m.fact}>
              <Link href={m.href}>{m.name}</Link>
              <small>{m.question}</small>
            </ListRow>
          ))}
        </RowList>
      </Section>

      <Section title={run.title} description={run.description}>
        {run.state === 'recorded' ? (
          <DataTable columns={scannerColumns} rows={run.scanners} getRowKey={s => s.id} caption="Scanners in the evaluation run" />
        ) : (
          <EmptyState title="Not measured" command={run.command}>
            <p>{run.reason}</p>
          </EmptyState>
        )}
      </Section>

      <Section title={principlesTitle} rule="hairline">
        <Grid columns={4} divided>
          {principles.map(p => (
            <div key={p.title} className={styles.principle}>
              <b>{p.title}</b>
              <span>{p.text}</span>
            </div>
          ))}
        </Grid>
      </Section>
    </Stack>
  );
}
