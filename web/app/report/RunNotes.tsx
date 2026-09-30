import { EmptyState, Note } from '../../components/feedback';
import { Code } from '../../components/text';
import type { RunState } from '../../resolvers/pages';
import styles from './Report.module.css';

/** What is wrong with the run behind a page's numbers, if anything. Says what is missing and the command that produces it. */
export function RunNotes({ state }: { state: RunState }) {
  if (state.kind === 'measured') {
    if (state.notes.length === 0) return null;
    return (
      <div className={styles.notes}>
        {state.notes.map(n => <Note key={n.title} tone="warning" title={n.title}>{n.text}</Note>)}
      </div>
    );
  }
  return (
    <EmptyState title={state.title} command={state.command}>
      {state.text} Run <Code>{state.command}</Code> at the repository root, then rebuild.
    </EmptyState>
  );
}
