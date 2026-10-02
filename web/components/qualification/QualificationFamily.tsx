import Link from 'next/link';
import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { Chip, Note, StatusBadge } from '../feedback';
import { Section, Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import { Code } from '../text';
import { StatusWordBadge } from './QualificationOverview';
import styles from './QualificationFamily.module.css';
import type { CountsRow, QualificationFamilyProps } from './types';

const countColumns: DataTableColumn<CountsRow>[] = [
  { key: 'population', header: 'Population', rowHeader: true, cell: r => <><Code>{r.population}</Code><small className={styles.sub}>{r.role}</small></> },
  { key: 'scanner', header: 'Scanner', cell: r => r.scanner },
  { key: 'cases', header: 'Cases', numeric: true, cell: r => r.cases },
  { key: 'positives', header: 'Positive spans', numeric: true, cell: r => r.positives },
  { key: 'outcomes', header: 'Span outcomes', cell: r => r.outcomes },
  { key: 'leaked', header: 'Leaked', cell: r => r.leaked },
  { key: 'benign', header: 'Benign controls flagged', cell: r => r.benign },
  { key: 'twins', header: 'Twin pairs discriminated', cell: r => r.twins },
  { key: 'unmeasured', header: 'Pending / not measured', cell: r => (r.unmeasured === 'None' ? r.unmeasured : <StatusBadge status="not-measured">{r.unmeasured}</StatusBadge>) },
];

const gateColumns: DataTableColumn<QualificationFamilyProps['gates']['rows'][number]>[] = [
  { key: 'population', header: 'Population', rowHeader: true, cell: r => <Code>{r.population}</Code> },
  { key: 'twins', header: 'Twin pairs that did not discriminate', cell: r => r.twins },
  { key: 'benign', header: 'Benign controls flagged', cell: r => r.benign },
];

/**
 * One detector family from the qualification view. The product's support status and the evidence it was judged on come first;
 * the scanners' observations follow, per population and per scanner, as counts that carry no status. "Not measured" is a
 * dashed state, never a zero or a miss, and a population with no case for the family says so rather than showing zeros.
 */
export function QualificationFamily({ breadcrumb, eyebrow, title, lede, meta, status, evidence, gates, observations, cases }: QualificationFamilyProps) {
  return (
    <Stack gap="xl" className={styles.family}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />

      <Section title={status.title}>
        <p className={styles.statusLine}><StatusWordBadge value={status.value} /> <span className={styles.muted}>{status.note}</span></p>
        <KeyValueList items={status.facts.map(f => ({ term: f.term, description: f.code ? <Code>{f.value}</Code> : f.value }))} />
        {status.methodsNotRun.length > 0 && (
          <Note tone="warning" title="Methods not run">
            These methods did not run in the official configuration, so their gates are not measured:{' '}
            {status.methodsNotRun.map(m => <Chip key={m}>{m}</Chip>)}
          </Note>
        )}
        {status.reasons.length > 0 && (
          <div className={styles.block}>
            <h3 className={styles.h3}>Why the status is not stable</h3>
            <ul className={styles.list}>{status.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
      </Section>

      <Section title={evidence.title} description={evidence.description}>
        <KeyValueList items={evidence.facts.map(f => ({ term: f.term, description: f.code ? <Code>{f.value}</Code> : f.value }))} />
      </Section>

      <Section title={gates.title} description={gates.description}>
        <DataTable columns={gateColumns} rows={gates.rows} getRowKey={r => r.key} caption={gates.title} wide empty="No gate-bearing population is recorded for this family." />
      </Section>

      <Section title={observations.title} description={observations.description}>
        <DataTable<CountsRow> columns={countColumns} rows={observations.rows} getRowKey={r => r.key} caption={observations.title} wide empty={observations.empty} />
      </Section>

      <Section title={cases.title} description={cases.description}>
        <p className={styles.muted}><Link href={cases.href}>{cases.label}</Link></p>
      </Section>
    </Stack>
  );
}
