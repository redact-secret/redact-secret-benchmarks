import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { cx } from '../../lib/cx';
import styles from './FamilySources.module.css';
import type { FamilySourceLink, FamilySourcesData } from './types';

export interface FamilySourcesProps extends FamilySourcesData {
  className?: string;
}

function LinkList({ label, links }: { label: string; links: FamilySourceLink[] }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {links.map(link => (
        <li key={link.href} className={styles.row}>
          <a href={link.href} rel="noreferrer">{link.label}</a>
          {link.detail && <small className={styles.detail}>{link.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Where the format notes come from: the documentation and code the taxonomy and the provider dossier cite, and
 * the research issues and evidence the dossier links. Every link leaves the site and is shown as the address it
 * goes to. A family with no source says so in a dashed box; nothing is implied to be documented.
 */
export function FamilySources({ sources, log, researched, className }: FamilySourcesProps) {
  const empty = sources.length === 0 && log.length === 0;
  return (
    <Section title="Sources" description={researched} className={cx(styles.sources, className)}>
      {empty ? (
        <EmptyState title="No source recorded for this family">
          <p>Neither the taxonomy nor the provider dossier cites a source for it.</p>
          <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
        </EmptyState>
      ) : (
        <div className={styles.groups}>
          {sources.length > 0 && (
            <div>
              <h3 className={styles.h3}>Documentation and code</h3>
              <LinkList label="Sources for the format" links={sources} />
            </div>
          )}
          {log.length > 0 && (
            <div>
              <h3 className={styles.h3}>Research log</h3>
              <LinkList label="Research issues and evidence" links={log} />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
