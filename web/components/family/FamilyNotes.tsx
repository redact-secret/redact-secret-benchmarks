import { KeyValueList } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FamilyNotes.module.css';
import type { FamilyNoteItem, InlinePart } from './types';

export interface FamilyNotesProps {
  title: string;
  /** A short sentence under the title: where the notes come from. */
  description?: string;
  items: FamilyNoteItem[];
  /** Shown when the dossier records nothing for this heading: a dashed "Not recorded", never a blank. */
  emptyTitle: string;
  emptyText: string;
  className?: string;
}

/** Dossier prose as written: text, code spans and source links (which leave the site). */
function InlineText({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return part;
        if ('code' in part) return <Code key={i}>{part.code}</Code>;
        return <a key={i} href={part.href} rel="noreferrer">{part.text}</a>;
      })}
    </>
  );
}

/**
 * Notes the provider dossier records for a family, one labelled row each, shown as written
 * (Shape, Sources, Collisions, Open caveat). Nothing is summarised or completed: a family the
 * dossier has not researched gets the dashed empty state, so a missing fact is never read as a settled one.
 */
export function FamilyNotes({ title, description, items, emptyTitle, emptyText, className }: FamilyNotesProps) {
  return (
    <Section title={title} description={description} className={cx(styles.notes, className)}>
      {items.length > 0 ? (
        <KeyValueList
          variant="rows"
          className={styles.list}
          items={items.map(item => ({ term: item.term, description: <span className={styles.text}><InlineText parts={item.parts} /></span> }))}
        />
      ) : (
        <EmptyState title={emptyTitle}>
          <p>{emptyText}</p>
          <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
        </EmptyState>
      )}
    </Section>
  );
}
// measurement probe, not merged
