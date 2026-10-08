import Link from 'next/link';
import { cx } from '../../../lib/cx';
import { StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { Eyebrow } from '../../text';
import styles from './DomainStatus.module.css';
import type { DomainStatusData, StatusLink } from './types';

export interface DomainStatusProps extends DomainStatusData {
  className?: string;
}

function Anchor({ link }: { link: StatusLink }) {
  return link.external ? <a href={link.href} rel="noreferrer">{link.label}</a> : <Link href={link.href}>{link.label}</Link>;
}

/**
 * Where this stands, in three groups: what the ledger records, what is not measured yet, and the known gaps. Each row
 * has a status word with its shape, the recorded value, where it comes from and a link or a follow-up issue. It never
 * orders scanners or states what a product outputs: /report and /comparison hold those.
 */
export function DomainStatus({ title, groups, links, className }: DomainStatusProps) {
  return (
    <Section title={title} className={cx(styles.status, className)}>
      {groups.map(group => (
        <div key={group.title} className={styles.group}>
          <Eyebrow tone="muted">{group.title}</Eyebrow>
          {group.navigation && <ul className={styles.links} aria-label={`${group.title} navigation`}>
            {group.navigation.map(link => <li key={link.href}><Anchor link={link} /></li>)}
          </ul>}
          <ul className={styles.rows} aria-label={group.title}>
            {group.rows.map(row => (
              <li key={row.id} id={row.anchor} className={styles.row}>
                <b className={styles.label}>{row.label}</b>
                <span className={styles.badge}><StatusBadge status={row.status}>{row.statusWord}</StatusBadge></span>
                <span className={styles.text}>
                  {row.value && <b className={styles.value}>{row.value}. </b>}
                  {row.detail}
                  {row.link && <> <Anchor link={row.link} /></>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {links.length > 0 && (
        <ul className={styles.links} aria-label="Related pages">
          {links.map(link => (
            <li key={link.href}><Anchor link={link} /></li>
          ))}
        </ul>
      )}
    </Section>
  );
}
