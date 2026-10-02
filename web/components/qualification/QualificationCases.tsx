import Link from 'next/link';
import { Fragment } from 'react';
import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { Note, StatusBadge } from '../feedback';
import { Section, Stack } from '../layout';
import { Pager } from '../nav';
import { Breadcrumb, PageHead } from '../page';
import { Code } from '../text';
import styles from './QualificationCases.module.css';
import type { CaseCell, CaseRowProps, CaseSection, QualificationCasesProps } from './types';

/** A scanner's word for one case. Pending and not measured are dashed; they are never a miss and never a pass. */
const Cell = ({ cell }: { cell: CaseCell | undefined }) => {
  if (!cell) return <StatusBadge status="not-measured">Not run</StatusBadge>;
  return cell.state === 'measured' ? <>{cell.word}</> : <StatusBadge status="not-measured">{cell.word}</StatusBadge>;
};

function columnsFor(scanners: string[]): DataTableColumn<CaseRowProps>[] {
  return [
    {
      key: 'case', header: 'Case', rowHeader: true,
      cell: r => (
        <details className={styles.details} id={`case-${r.key}`}>
          <summary><Code>{r.id}</Code></summary>
          {/* A bare dl of dt/dd pairs: a page holds many rows, so each opened row carries no wrapper elements of its own. */}
          <dl className={styles.facts}>{r.detail.map(f => <Fragment key={f.term}><dt>{f.term}</dt><dd>{f.code ? <Code>{f.value}</Code> : f.value}</dd></Fragment>)}</dl>
        </details>
      ),
    },
    { key: 'kind', header: 'Kind', cell: r => r.kind },
    { key: 'tier', header: 'Tier', cell: r => r.tier },
    { key: 'group', header: 'Group', cell: r => r.group },
    { key: 'evidence', header: 'Evidence class (the artifact’s label)', label: 'Evidence class', cell: r => r.evidenceClass },
    ...scanners.map<DataTableColumn<CaseRowProps>>(scanner => ({
      key: `scanner-${scanner}`, header: scanner, label: scanner,
      cell: r => <Cell cell={r.cells.find(c => c.scanner === scanner)} />,
    })),
  ];
}

function PopulationCases({ section, columns }: { section: CaseSection; columns: DataTableColumn<CaseRowProps>[] }) {
  return (
    <Section title={section.id} description={`${section.role} · ${section.range}`}>
      <KeyValueList items={section.identity.map(f => ({ term: f.term, description: f.code ? <Code>{f.value}</Code> : f.value }))} />
      <DataTable<CaseRowProps> columns={columns} rows={section.rows} getRowKey={r => r.key} caption={`Cases of ${section.id}`} wide />
    </Section>
  );
}

/**
 * The cases of one scope (a detector family, or the cases no family claims), per population: one row per case with each scanner's
 * own word, and the case's facts and measurements when the row is opened. Rows are never merged across populations (the same id in two
 * populations is two rows) and nothing is counted across them. The evidence class is the artifact's label for the case and says nothing
 * about the product's support status.
 */
export function QualificationCases({ breadcrumb, eyebrow, title, lede, meta, note, scanners, sections, empty, pager, back }: QualificationCasesProps) {
  const columns = columnsFor(scanners);
  return (
    <Stack gap="xl" className={styles.cases}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <Note tone="info" title={note.title}>{note.text}</Note>
      {sections.length === 0 ? <p className={styles.muted}>{empty}</p> : sections.map(section => <PopulationCases key={section.id} section={section} columns={columns} />)}
      <Pager page={pager.page} pageCount={pager.pageCount} previousHref={pager.previousHref} nextHref={pager.nextHref} itemLabel="cases" />
      <p className={styles.muted}><Link href={back.href}>{back.label}</Link></p>
    </Stack>
  );
}
