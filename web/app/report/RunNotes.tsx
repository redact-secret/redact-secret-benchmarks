'use client';

import { useId, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { EmptyState, Note } from '../../components/feedback';
import { PipelineStamp } from '../../components/qualification';
import { Code } from '../../components/text';
import type { RunState } from '../../resolvers/run';
import styles from './Report.module.css';

/**
 * Which pipeline produced the numbers on a page and what is wrong with the run behind them, if anything. The stamp is always
 * first: no number on a credential page is shown without the name of the pipeline behind it (#608). A missing run says what is
 * missing and the command that produces it.
 */
export function RunNotes({ state, detailsInDialog = false }: { state: RunState; detailsInDialog?: boolean }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const stamp = detailsInDialog ? (
    <>
      <aside data-pipeline={state.pipeline.pipeline} data-role={state.pipeline.role} aria-label="Report source">
        <button className={styles.sourceButton} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          Where these numbers come from
        </button>
      </aside>
      <div hidden><PipelineStamp {...state.pipeline} /></div>
      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={titleId} maxWidth="md" fullWidth slotProps={{ paper: { className: styles.sourceDialog, elevation: 0 } }}>
        <DialogTitle id={titleId}>Where these numbers come from</DialogTitle>
        <DialogContent><PipelineStamp {...state.pipeline} /></DialogContent>
        <DialogActions>
          <button className={styles.sourceButton} type="button" onClick={() => setOpen(false)}>Close</button>
        </DialogActions>
      </Dialog>
    </>
  ) : <PipelineStamp {...state.pipeline} />;
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
