import Link from 'next/link';
import { cx } from '../../../lib/cx';
import { DataTable, KeyValueList } from '../../data';
import type { DataTableColumn } from '../../data';
import { EmptyState, Note, RetryNote, Skeleton, SkeletonBlock } from '../../feedback';
import { Stack } from '../../layout';
import { Pager } from '../../nav';
import { Breadcrumb, PageHead } from '../../page';
import { Code } from '../../text';
import type { CheckItem, CheckTable, MethodCasesProps } from './types';
import styles from './MethodCases.module.css';

type Row = CheckTable['rows'][number];

function Item({ item }: { item: CheckItem }) {
  const text = item.code ? <Code>{item.text}</Code> : item.text;
  return (
    <span className={styles.item}>
      {item.href ? <Link href={item.href}>{text}</Link> : text}
      {item.note && <small>{item.note}</small>}
    </span>
  );
}

function Table({ table }: { table: CheckTable }) {
  return (
    <DataTable<Row>
      columns={table.columns.map((column, i): DataTableColumn<Row> => ({
        key: column.key,
        header: column.header,
        rowHeader: i === 0,
        cell: row => <span className={styles.items}>{row.cells[i].map((item, j) => <Item key={j} item={item} />)}</span>,
      }))}
      rows={table.rows}
      getRowKey={r => r.key}
      caption={table.caption}
      wide
    />
  );
}

function Body({ body }: { body: MethodCasesProps['body'] }) {
  switch (body.state) {
    case 'index':
      return <Table table={body.table} />;
    case 'recorded':
      return (
        <>
          <Table table={body.table} />
          <Pager
            page={body.pager.page} pageCount={body.pager.pageCount} total={body.pager.total} pageSize={body.pager.pageSize}
            previousHref={body.pager.previousHref} nextHref={body.pager.nextHref} itemLabel="checks"
          />
        </>
      );
    case 'loading':
      return (
        <Skeleton label={body.label}>
          <SkeletonBlock shape="panel" />
          <SkeletonBlock shape="panel" />
          <SkeletonBlock shape="line" width="half" />
        </Skeleton>
      );
    case 'error':
      return <RetryNote title={body.title} retryLabel={body.retryLabel} onRetry={body.onRetry}>{body.detail}</RetryNote>;
    case 'missing':
      return <EmptyState title={body.title}><p>{body.text}</p></EmptyState>;
    default:
      return (
        <EmptyState title={body.title} command={body.command}>
          <p>{body.body}</p>
        </EmptyState>
      );
  }
}

/**
 * The checks behind one count of a method table (#623): the method, check, scanner and status that chose them, the run they come from,
 * one row per recorded check and Previous and Next links; or the index of a method's lists. Pure render: the resolver chose every row and
 * word and the page-level island chose the state (loading, failed, missing); the block counts nothing. A family link leads to the
 * qualification view, another run, and the notes say so.
 */
export function MethodCases({ crumbs, eyebrow, title, lede, meta, filters, notes, body, back, className }: MethodCasesProps) {
  return (
    <Stack gap="xl" className={cx(styles.cases, className)}>
      <PageHead before={<Breadcrumb items={crumbs} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <KeyValueList items={filters} />
      {notes.map(note => (
        <Note key={note.title} tone="info" title={note.title}>
          <p>{note.text}</p>
        </Note>
      ))}
      <Body body={body} />

      <p className={styles.muted}><Link href={back.href}>{back.label}</Link></p>
    </Stack>
  );
}
