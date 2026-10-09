'use client';

import { useEffect, useId, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DomainStatus } from '../../../components/evaluation/domain/DomainStatus';
import { DomainCoverage } from '../../../components/evaluation/domain/DomainCoverage';
import type { DomainStatusData, DomainCoverageData } from '../../../components/evaluation/domain/types';
import controls from '../../report/Report.module.css';
import styles from './PiiExplorer.module.css';

export function PiiStatusExplorer({ data }: { data: DomainStatusData }) {
  const resultGroups = data.groups.slice(1).map(group => ({ ...group, rows: group.rows.filter(row => row.anchor || !/identity|projection-binding|bound report/i.test(`${row.id} ${row.label}`)) })).filter(group => group.rows.length);
  const [groupIndex, setGroupIndex] = useState(0);
  const [rowIndex, setRowIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    const sync = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      for (const [g, group] of resultGroups.entries()) {
        const r = group.rows.findIndex(row => row.anchor === hash);
        if (r >= 0) { setGroupIndex(g); setRowIndex(r); return; }
      }
    };
    sync(); window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [data]);
  const group = resultGroups[groupIndex];
  const row = group?.rows[rowIndex];
  return <section className={styles.explorer} aria-label="PII measurement results">
    <h2>Explore measurement results</h2>
    <p>Select a population or report, then a metric or personal-data category. Each value keeps its own denominator. Public measurement does not establish product support qualification.</p>
    <label htmlFor={`${id}-group`}>Population or report</label>
    <select id={`${id}-group`} value={groupIndex} onChange={event => { setGroupIndex(Number(event.target.value)); setRowIndex(0); }}>
      {resultGroups.map((group, index) => <option key={group.title} value={index}>{group.title}</option>)}
    </select>
    {group && <><label htmlFor={`${id}-row`}>Metric or category</label><select id={`${id}-row`} value={rowIndex} onChange={event => setRowIndex(Number(event.target.value))}>
      {group.rows.map((row, index) => <option key={row.id} value={index}>{row.label}</option>)}
    </select></>}
    {row && <DomainStatus title="Selected result" groups={[{ title: group.title, rows: [row] }]} links={data.links} />}
    <button className={controls.sourceButton} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>Sources and execution details</button>
    <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={`${id}-title`} maxWidth="md" fullWidth slotProps={{ paper: { className: controls.sourceDialog, elevation: 0 } }}>
      <DialogTitle id={`${id}-title`}>Sources and execution details</DialogTitle>
      <DialogContent><DomainStatus {...data} title="Measurement provenance" groups={data.groups.filter((_, index) => index === 0 || data.groups[index].title === group?.title).map(group => ({ ...group, navigation: undefined, rows: group.rows.filter(row => /identity|binding|authority|custodian|protected|evidence|record|source/i.test(`${row.id} ${row.label}`)) }))} /></DialogContent>
      <DialogActions><button className={controls.sourceButton} type="button" onClick={() => setOpen(false)}>Close</button></DialogActions>
    </Dialog>
  </section>;
}

export function PiiCoverageExplorer({ data }: { data: DomainCoverageData }) {
  const [index, setIndex] = useState(Math.max(0, data.tables.findIndex(table => 'rows' in table && table.rows.length > 0)));
  const id = useId();
  return <section className={styles.explorer} aria-label="PII measurement coverage">
    <h2>Coverage of the recorded populations</h2>
    <p>Public measurement coverage and product qualification are separate records. Select one coverage table; counts from different populations are never added.</p>
    <label htmlFor={id}>Population and coverage</label><select id={id} value={index} onChange={event => setIndex(Number(event.target.value))}>
      {data.tables.map((table, index) => <option key={table.id} value={index}>{table.caption}</option>)}
    </select>
    <DomainCoverage {...data} title="Selected coverage" mode="Each table describes its own population. Missing coverage is not zero, and public coverage does not qualify product support." tables={data.tables[index] ? [data.tables[index]] : []} />
  </section>;
}
