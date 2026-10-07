import { cx } from '../../../lib/cx';
import { DataTable, KeyValueList } from '../../data';
import type { DataTableColumn } from '../../data';
import { Disclosure } from '../../disclosure';
import { EmptyState, Note } from '../../feedback';
import { Grid, Section, Stack } from '../../layout';
import { SegmentedNav } from '../../nav';
import { Breadcrumb, PageHead } from '../../page';
import { CodeBlock, Prose } from '../../text';
import Link from 'next/link';
import { EvidenceTable } from './EvidenceTable';
import type { MethodPageProps, NotMeasuredData, TextTable } from './types';
import styles from './MethodPage.module.css';

type Row = TextTable['rows'][number];

function NotMeasured({ data }: { data: NotMeasuredData }) {
  return (
    <EmptyState title={data.title} command={data.command}>
      <p>{data.body}</p>
    </EmptyState>
  );
}

function Table({ table }: { table: TextTable }) {
  const columns: DataTableColumn<Row>[] = table.columns.map((column, i) => ({
    key: column.key,
    header: column.header,
    numeric: column.numeric,
    rowHeader: i === 0,
    cell: row => {
      const cell = row.cells[i];
      return (
        <>
          {cell.href ? <Link href={cell.href}>{cell.text}</Link> : cell.text}
          {cell.note && <small>{cell.note}</small>}
        </>
      );
    },
  }));
  return <DataTable columns={columns} rows={table.rows} getRowKey={r => r.key} caption={table.caption} />;
}

/**
 * One evaluation method, in the order every method page uses: what it is (the head), how it runs, what was
 * recorded now, how to read it, the exact inputs. A figure appears in one of these places and no other.
 * Pure render: the resolver has formatted every number and chosen every word.
 */
export function MethodPage({ switchLabel, switcher, currentHref, crumbs, eyebrow, title, lede, meta, how, recorded, read, inputs, className }: MethodPageProps) {
  return (
    <Stack gap="xl" className={cx(styles.page, className)}>
      <PageHead before={<Breadcrumb items={crumbs} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <SegmentedNav items={switcher} currentHref={currentHref} label={switchLabel} className={styles.switch} />

      <Section title={how.title} eyebrow="1 · How it runs">
        <Grid columns={3} divided as="ol" className={styles.steps}>
          {how.steps.map(step => (
            <li key={step.label} className={styles.step}>
              <b>{step.label}</b>
              <span>{step.text}</span>
            </li>
          ))}
        </Grid>
        <KeyValueList variant="facts" items={how.figures.map(f => ({ term: f.term, description: f.description }))} />
      </Section>

      <Section title={recorded.state === 'recorded' ? recorded.title : 'Recorded now'} eyebrow="2 · Recorded now" description={recorded.state === 'recorded' ? recorded.description : undefined}>
        {recorded.state === 'recorded' ? (
          <>
            <EvidenceTable columns={recorded.columns} groups={recorded.groups} rowHeader={recorded.rowHeader} caption={recorded.caption} />
            <p className={styles.meaning}>{recorded.cellMeaning}</p>
            {recorded.detail && <p className={styles.meaning}>{recorded.detail}</p>}
            {recorded.unscored && (
              <Note title={recorded.unscored.title}>
                <p>{recorded.unscored.text}</p>
              </Note>
            )}
          </>
        ) : (
          <NotMeasured data={recorded} />
        )}
      </Section>

      <Section title={read.title} eyebrow="3 · How to read it">
        <Prose size="small">
          <ul>
            {read.rules.map((rule, i) => <li key={i}>{rule}</li>)}
          </ul>
        </Prose>
      </Section>

      <Section title={inputs.state === 'recorded' ? inputs.title : 'Exact inputs'} eyebrow="4 · Exact inputs" description={inputs.state === 'recorded' ? inputs.description : undefined}>
        {inputs.state === 'recorded' ? (
          <Stack gap="lg">
            {inputs.facts && <KeyValueList items={inputs.facts} />}
            {inputs.tables.map(t => (
              <Stack key={t.title} gap="sm">
                <h3 className={styles.h3}>{t.title}</h3>
                {t.description && <p className={styles.meaning}>{t.description}</p>}
                {t.summary ? (
                  <Disclosure variant="plain" summary={t.summary}>
                    <Table table={t.table} />
                  </Disclosure>
                ) : (
                  <Table table={t.table} />
                )}
              </Stack>
            ))}
            {inputs.provenance && (
              <Disclosure variant="plain" summary={inputs.provenance.summary}>
                <CodeBlock variant="snippet" label={inputs.provenance.summary}>{inputs.provenance.text}</CodeBlock>
              </Disclosure>
            )}
          </Stack>
        ) : (
          <NotMeasured data={inputs} />
        )}
      </Section>
    </Stack>
  );
}
