import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Note, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import styles from './ScopeAccounting.module.css';
import type { ProfileEffectRow, ScopeAccountingProps, ScopeRow } from './types';

const count = (value: string, unaccounted: boolean) => (unaccounted ? <StatusBadge status="not-measured">{value}</StatusBadge> : value);

const columns: DataTableColumn<ScopeRow>[] = [
  { key: 'scanner', header: 'Scanner', rowHeader: true, cell: r => <><Code>{r.scanner}</Code><small className={styles.sub}>{r.population} · {r.artifact}</small></> },
  { key: 'configuration', header: 'Configuration', cell: r => <>{r.configuration}<small className={styles.sub}>{r.identity}</small></> },
  { key: 'classification', header: 'Classification version', cell: r => r.classification },
  { key: 'state', header: 'State', cell: r => (r.unaccounted ? <StatusBadge status="not-measured">{r.state}</StatusBadge> : r.state) },
  { key: 'coverage', header: 'Native-label coverage', cell: r => count(r.coverage, r.unaccounted) },
  { key: 'mapped', header: 'Mapped credentials', numeric: true, cell: r => count(r.mapped, r.unaccounted) },
  { key: 'credential', header: 'Credential-related, unmapped', numeric: true, cell: r => count(r.credentialRelated, r.unaccounted) },
  { key: 'out', header: 'Out of scope (personal data, resource identifiers)', numeric: true, cell: r => count(r.outOfScope, r.unaccounted) },
  { key: 'ambiguous', header: 'Ambiguous', numeric: true, cell: r => count(r.ambiguous, r.unaccounted) },
  { key: 'unavailable', header: 'Native label unavailable', numeric: true, cell: r => count(r.unavailable, r.unaccounted) },
  { key: 'unrecognized', header: 'Unrecognized label', numeric: true, cell: r => count(r.unrecognized, r.unaccounted) },
  { key: 'labels', header: 'Native types', cell: r => (r.labels.length ? (
    <details className={styles.details}>
      <summary>{r.labels.length}{r.labelsMore ? ' shown' : ''}</summary>
      <ul className={styles.plain}>{r.labels.map(l => <li key={l.label}><Code>{l.label}</Code> {l.findings}<small className={styles.sub}>{l.scope}{l.reason ? ` · ${l.reason}` : ''}</small></li>)}</ul>
      {r.labelsMore && <p className={styles.muted}>{r.labelsMore}</p>}
    </details>
  ) : <span className={styles.muted}>None</span>) },
  { key: 'limits', header: 'Limits', cell: r => <details className={styles.details}><summary>{r.limits.length} stated</summary><ul className={styles.plain}>{r.limits.map(l => <li key={l}>{l}</li>)}</ul></details> },
];

const profileColumns: DataTableColumn<ProfileEffectRow>[] = [
  { key: 'pair', header: 'Profile against default', rowHeader: true, cell: r => <>{r.pair}<small className={styles.sub}>{r.population}</small></> },
  { key: 'identities', header: 'Configuration identities', cell: r => r.identities },
  { key: 'outcomes', header: 'Change in positive span outcomes', cell: r => r.outcomes },
  { key: 'benign', header: 'Change in benign controls flagged', cell: r => r.benign },
  { key: 'findings', header: 'Change in retained findings', cell: r => r.findings },
  { key: 'denominators', header: 'Evidence denominators', cell: r => r.denominators },
];

/**
 * Scope accounting beside the scanner counts (#724). The engine classified every retained finding; this block shows what it recorded, per
 * scanner and per artifact, with the configuration, classification version and limits next to the numbers. A scanner or artifact with no
 * accounting reads "Unknown" in a dashed badge, never zero. A credential profile is a separate row, never merged into the default's.
 */
export function ScopeAccounting({ title, description, mode, rows, profiles, notes }: ScopeAccountingProps) {
  return (
    <Section title={title} description={description}>
      <p className={styles.mode}>{mode}</p>
      <Note tone="info" title="How to read these counts">{notes.map(n => <p key={n}>{n}</p>)}</Note>
      <DataTable<ScopeRow> columns={columns} rows={rows} getRowKey={r => r.key} caption={title} wide empty="No scanner scope accounting is recorded in this view." />
      <h3 className={styles.h3}>{profiles.title}</h3>
      <p className={styles.muted}>{profiles.description}</p>
      <DataTable<ProfileEffectRow> columns={profileColumns} rows={profiles.rows} getRowKey={r => r.key} caption={profiles.title} wide empty={profiles.empty} />
    </Section>
  );
}
