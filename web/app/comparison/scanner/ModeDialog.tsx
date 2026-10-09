'use client';

import { useId, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { ScannerModeNote } from '../../../components/evaluation/scanner/ScannerModeNote';
import type { ScannerModeNoteData } from '../../../components/evaluation/scanner/types';
import styles from '../../report/Report.module.css';

export function ModeDialog({ note }: { note: ScannerModeNoteData }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button type="button" className={styles.sourceButton} aria-haspopup="dialog" onClick={() => setOpen(true)}>{note.title}</button>
      <div hidden><ScannerModeNote {...note} /></div>
      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={titleId} maxWidth="md" fullWidth slotProps={{ paper: { className: styles.sourceDialog, elevation: 0 } }}>
        <DialogTitle id={titleId}>{note.title}</DialogTitle>
        <DialogContent><ScannerModeNote {...note} /></DialogContent>
        <DialogActions><button type="button" className={styles.sourceButton} onClick={() => setOpen(false)}>Close</button></DialogActions>
      </Dialog>
    </>
  );
}
