import { EmptyState, Note } from '../../components/feedback';
import { PipelineStamp } from '../../components/qualification';
import { Code } from '../../components/text';
import type { RunState } from '../../resolvers/pages';
import styles from './Report.module.css';

/**
 * Which pipeline produced the numbers on a page and what is wrong with the run behind them, if anything. The stamp is always
 * first: no number on a credential page is shown without the name of the pipeline behind it (#608). A missing run says what is
 * missing and the command that produces it.
 */
export function RunNotes({ state }: { state: RunState }) {
  const stamp = <PipelineStamp {...state.pipeline} />;
  if (state.kind === 'measured') {
    return (
      <div className={styles.notes}>
        {stamp}
        {state.notes.map(n => <Note key={n.title} tone="warning" title={n.title}>{n.text}</Note>)}
      </div>
    );
  }
  return (
    <>
      <div className={styles.notes}>{stamp}</div>
      <EmptyState title={state.title} command={state.command}>
        {state.text} Run <Code>{state.command}</Code> at the repository root, then rebuild.
      </EmptyState>
    </>
  );
}
