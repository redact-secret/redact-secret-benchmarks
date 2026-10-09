'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { PerformancePicker } from '../../../components/comparison/PerformancePicker';
import type { PerformancePickerProps } from '../../../components/comparison/PerformancePicker';
import type { PerformancePairProps } from '../../../components/comparison/PerformancePair';
import { Note } from '../../../components/feedback';
import controls from '../../report/Report.module.css';
import styles from './Performance.module.css';

export function PerformanceDropdowns({ picker }: { picker: PerformancePickerProps }) {
  const router = useRouter();
  return <PerformancePicker {...picker} onSelect={href => router.push(href, { scroll: false })} />;
}

export function PerformanceReadingDialog({ note }: { note: PerformancePairProps['first'] }) {
  const [open, setOpen] = useState(false);
  const title = useId();
  const content = <Note title={note.title}><ul>{note.items.map(item => <li key={item}>{item}</li>)}</ul></Note>;
  return <>
    <button className={styles.infoButton} type="button" aria-label="How to read performance results" title="How to read performance results" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>
    </button>
    <div hidden>{content}</div>
    <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={title} maxWidth="md" fullWidth slotProps={{ paper: { className: controls.sourceDialog, elevation: 0 } }}>
      <DialogTitle id={title}>{note.title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions><button className={controls.sourceButton} type="button" onClick={() => setOpen(false)}>Close</button></DialogActions>
    </Dialog>
  </>;
}
