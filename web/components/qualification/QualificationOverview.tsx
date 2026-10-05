import Link from 'next/link';
import { DataTable, KeyValueList, StatGrid, StatTile } from '../data';
import type { DataTableColumn } from '../data';
import { Chip, Note, StatusBadge } from '../feedback';
import { Stack, Section } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import { Code } from '../text';
import { ReviewDisclosure } from './ReviewDisclosure';
import { ScopeAccounting } from './ScopeAccounting';
import { cx } from '../../lib/cx';
import styles from './QualificationOverview.module.css';
import type { FamilyRow, GapRow, PopulationRow, QualificationOverviewProps, ScannerRow, StatusWord } from './types';

const BADGE: Record<StatusWord['tone'], 'info' | 'review' | 'none'> = { info: 'info', review: 'review', none: 'none' };
export const StatusWordBadge = ({ value }: { value: StatusWord }) => <StatusBadge status={BADGE[value.tone]}>{value.word}</StatusBadge>;

const populationColumns: DataTableColumn<PopulationRow>[] = [
  { key: 'population', header: 'Population', rowHeader: true, cell: r => <><Code>{r.id}</Code><small className={styles.sub}>{r.role}</small></> },
  { key: 'run', header: 'Run class', cell: r => r.runClass },
  { key: 'evidence', header: 'Evidence', cell: r => r.evidence },
  { key: 'corpus', header: 'Corpus digest', cell: r => <Code>{r.corpusDigest}</Code> },
  { key: 'engine', header: 'Engine', cell: r => r.engine },
  { key: 'config', header: 'Configuration hash', cell: r => <Code>{r.configHash}</Code> },
  { key: 'semantic', header: 'Semantic digest', cell: r => <Code>{r.semanticDigest}</Code> },
  { key: 'methods', header: 'Methods run', cell: r => (r.methods === 'None run' ? <StatusBadge status="not-measured">None run</StatusBadge> : r.methods) },
  { key: 'cases', header: 'Cases', numeric: true, cell: r => r.cases },
];

const scannerColumns: DataTableColumn<ScannerRow>[] = [
  { key: 'population', header: 'Population', rowHeader: true, cell: r => <Code>{r.population}</Code> },
  { key: 'scanner', header: 'Scanner', cell: r => r.scanner },
  { key: 'version', header: 'Version', cell: r => <Code>{r.version}</Code> },
  { key: 'build', header: 'Build', cell: r => r.build },
  { key: 'mode', header: 'Mode line of the run', cell: r => r.mode },
];

const familyColumns: DataTableColumn<FamilyRow>[] = [
  { key: 'family', header: 'Detector family', rowHeader: true, cell: r => <><Link href={r.href}>{r.family}</Link><small className={styles.sub}>{r.provider}</small></> },
  { key: 'status', header: 'Support status', cell: r => <StatusWordBadge value={r.status} /> },
  { key: 'route', header: 'Route', cell: r => r.route },
  { key: 'tier', header: 'Evidence tier', cell: r => r.tier },
  { key: 'basis', header: 'Evidence basis', cell: r => r.basis },
  { key: 'held', header: 'Held below stable by', cell: r => (r.heldBy.length ? <span className={styles.chips}>{r.heldBy.map(h => <Chip key={h} mono={false}>{h}</Chip>)}</span> : <span className={styles.muted}>No hold recorded</span>) },
  { key: 'cases', header: 'Cases per population (redact-secret)', cell: r => <ul className={styles.plain}>{r.cases.map(c => <li key={c}>{c}</li>)}</ul> },
];

const gapColumns: DataTableColumn<GapRow>[] = [
  { key: 'id', header: 'Record', rowHeader: true, cell: r => <><Code>{r.id}</Code><small className={styles.sub}>{r.title}</small></> },
  { key: 'kind', header: 'Kind', cell: r => r.kind },
  { key: 'status', header: 'Ledger status', cell: r => r.status },
  { key: 'matched', header: 'Fixtures matched, per population', cell: r => (r.matched.length ? <ul className={styles.plain}>{r.matched.map(m => <li key={m}>{m}</li>)}</ul> : <StatusBadge status="not-measured">No fixture matched</StatusBadge>) },
  { key: 'fixtures', header: 'Fixtures', cell: r => (r.fixtures.length ? (
    <details className={styles.details}>
      <summary>{r.fixtures.length} named</summary>
      <ul className={styles.plain}>{r.fixtures.map(f => <li key={f.fixture}><Code>{f.fixture}</Code>{f.matches.map(m => <small key={m} className={styles.sub}>{m}</small>)}</li>)}</ul>
    </details>
  ) : <span className={styles.muted}>None named</span>) },
];

/**
 * `/evaluation/qualification`: the Redact Secret qualification the adapter derived from the official credential-eval runs,
 * one population at a time. The support status is the product's own qualification and is shown apart from the scanner
 * observations on each family page; no count here is a sum across populations or scanners.
 */
export function QualificationOverview({ breadcrumb, eyebrow, title, lede, meta, boundary, disclosure, summary, identity, populations, scanners, families, unattributed, gaps, scope }: QualificationOverviewProps) {
  return (
    <Stack gap="xl" className={styles.overview}>
      <PageHead before={<Breadcrumb items={breadcrumb} />} eyebrow={eyebrow} title={title} lede={lede} meta={meta} />
      <Note tone="info" title={boundary.title}>{boundary.paragraphs.map(p => <p key={p}>{p}</p>)}</Note>
      {disclosure && <ReviewDisclosure {...disclosure} />}

      <Section title={summary.title} description={summary.description}>
        <p className={styles.mode}>{summary.mode}</p>
        <StatGrid>{summary.tiles.map(t => <StatTile key={t.label} label={t.label} value={t.value} definition={t.definition} />)}</StatGrid>
        <StatGrid>{summary.routes.map(t => <StatTile key={t.label} label={t.label} value={t.value} definition={t.definition} size="compact" />)}</StatGrid>
        {summary.methodsNote && <Note tone="warning" title="Methods not run">{summary.methodsNote}</Note>}
      </Section>

      <Section title={identity.title}>
        <KeyValueList items={identity.items.map(i => ({ term: i.term, description: i.code ? <Code>{i.value}</Code> : i.value }))} />
      </Section>

      <Section title={populations.title} description={populations.description}>
        <DataTable<PopulationRow> columns={populationColumns} rows={populations.rows} getRowKey={r => r.id} caption={populations.title} wide empty="No population is recorded in this view." />
      </Section>

      <Section title={scanners.title} description={scanners.description}>
        <DataTable<ScannerRow> columns={scannerColumns} rows={scanners.rows} getRowKey={r => r.key} caption={scanners.title} wide empty="No scanner is recorded in this view." />
      </Section>

      {scope && <ScopeAccounting {...scope} />}

      <Section title={families.title} description={families.description}>
        <DataTable<FamilyRow> columns={familyColumns} rows={families.rows} getRowKey={r => r.family} caption={families.title} wide empty="No detector family is recorded in this view." />
        <div className={cx(styles.undetected)}>
          <h3 className={styles.h3}>{families.undetected.title}</h3>
          <p className={styles.muted}>{families.undetected.text}</p>
          {families.undetected.items.length > 0 && <p className={styles.chips}>{families.undetected.items.map(i => <Chip key={i}>{i}</Chip>)}</p>}
        </div>
        <div className={cx(styles.undetected)}>
          <h3 className={styles.h3}>{unattributed.title}</h3>
          <p className={styles.muted}>{unattributed.description}</p>
          <p className={styles.muted}><Link href={unattributed.href}>{unattributed.label}</Link></p>
        </div>
      </Section>

      <Section title={gaps.title} description={gaps.description}>
        <DataTable<GapRow> columns={gapColumns} rows={gaps.rows} getRowKey={r => r.id} caption={gaps.title} wide empty="No known-gap record is in this view." />
      </Section>
    </Stack>
  );
}
