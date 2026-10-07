import Link from 'next/link';
import { cx } from '../../lib/cx';
import { Code } from '../text';
import { OptionalScannerNote } from './OptionalScannerNote';
import { ReviewDisclosure } from './ReviewDisclosure';
import styles from './PipelineStamp.module.css';
import type { PipelineStampProps } from './types';

/**
 * Which pipeline produced the numbers on a credential page, and whether it is the authority for credential qualification (#608).
 * Every report page carries one, so a number is never seen without the name of the pipeline behind it. The words, facts and link
 * are passed in already formatted; the block derives nothing and never asserts what the numbers say about the product.
 */
export function PipelineStamp({ pipeline, role, title, text, facts, link, disclosure, notMeasured, className }: PipelineStampProps) {
  return (
    <aside className={cx(styles.stamp, styles[pipeline], className)} aria-label="Where these numbers come from" data-pipeline={pipeline} data-role={role}>
      <p className={styles.head}>
        <span className={styles.pipeline}>{pipeline === 'new' ? 'New pipeline' : 'Legacy pipeline'}</span>
        <span className={styles.role}>{role === 'authority' ? 'Authority' : 'Oracle'}</span>
      </p>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{text}</p>
      {facts.length > 0 && (
        <dl className={styles.facts}>
          {facts.map(fact => (
            <div key={fact.term} className={styles.fact}>
              <dt>{fact.term}</dt>
              <dd>{fact.code ? <Code>{fact.value}</Code> : fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {disclosure && <ReviewDisclosure {...disclosure} />}
      {notMeasured && <OptionalScannerNote scanners={notMeasured} variant="compact" />}
      {link && <p className={styles.link}><Link href={link.href}>{link.label}</Link></p>}
    </aside>
  );
}
