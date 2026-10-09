'use client';

import { useId, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import type { resolvePiiOutcomeSummary } from '../../../../resolvers/pii-evidence';
import controls from '../../../report/Report.module.css';
import styles from './OutcomeComparison.module.css';

type Data = NonNullable<ReturnType<typeof resolvePiiOutcomeSummary>>;
type Row = Data['rows'][number];
const words: Record<string, string> = {
  miss: 'Missed', correct: 'Correct', unresolved: 'Evaluation unresolved', exact: 'Exact match', partial: 'Partial match', overbroad: 'Too broad',
  'not-measured': 'Not measured', 'not-applicable': 'Not applicable', 'residual-present': 'Personal data remains in output', 'output-verified': 'Output checked',
};
const word = (value: string) => words[value] ?? value;
function result(outcome: Row['baseline']) {
  return outcome.action.verification ? word(outcome.action.verification) : word(outcome.action.state);
}

export function OutcomeComparison({ data }: { data: Data }) {
  const [filter, setFilter] = useState('changed');
  const [selected, setSelected] = useState<Row | null>(null);
  const titleId = useId();
  const filterId = useId();
  const rows = data.rows.filter(row => filter === 'all' || (filter === 'changed' ? row.changed : filter === 'unchanged' ? !row.changed : row.unresolved));
  return (
    <section className={styles.section} aria-label="Version comparison">
      <h2>What changed between versions?</h2>
      <p>Published baseline {data.baselineVersion} ({data.baselineRevision}) compared with candidate build {data.candidateVersion} ({data.candidateRevision}), using the same public test variants.</p>
      <dl className={styles.summary}>
        {[['Compared', data.total], ['Changed', data.changed], ['Unchanged', data.unchanged], ['Evaluation unresolved', data.unresolved]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
      <p>Changed means a recorded result differs. It does not establish improvement or regression. Unresolved variants can also be changed or unchanged; do not add that count to the others. This measurement does not grant PII support qualification.</p>
      <div className={styles.filter}><label htmlFor={filterId}>Show variants</label><select id={filterId} value={filter} onChange={event => setFilter(event.target.value)}><option value="changed">Changed</option><option value="unchanged">Unchanged</option><option value="unresolved">Evaluation unresolved</option><option value="all">All variants</option></select></div>
      {!rows.length ? <p>{filter === 'changed' ? 'No recorded outcomes changed between these versions.' : 'No variants match this view.'}</p> : (
        <ul className={styles.rows}>{rows.map(row => <li key={row.id}>
          <div><h3>{row.label}</h3><p>{row.changed ? 'Changed' : 'Unchanged'}{row.unresolved ? ' · Evaluation unresolved' : ''}</p></div>
          <div><p>Published baseline: {result(row.baseline)}</p><p>Candidate build: {result(row.candidate)}</p></div>
          <button className={controls.sourceButton} type="button" aria-haspopup="dialog" onClick={() => setSelected(row)}>View details<span className={styles.srOnly}> for {row.label}</span></button>
        </li>)}</ul>
      )}
      <Dialog open={!!selected} onClose={() => setSelected(null)} aria-labelledby={titleId} maxWidth="md" fullWidth slotProps={{ paper: { className: controls.sourceDialog, elevation: 0 } }}>
        <DialogTitle id={titleId}>{selected?.label}</DialogTitle>
        <DialogContent>{selected && <div className={styles.details}>
          <p>Case ID: <code>{selected.caseId}</code><br />Variant ID: <code>{selected.variantId}</code></p>
          <p>Type checks the personal-data category. Range checks its location and span. Sensitivity checks the authored sensitivity and context. Output checks what remains after processing. Unresolved means the authored assertion is not resolved, not a confirmed failure.</p>
          {[['Published baseline', selected.baseline], ['Candidate build', selected.candidate]].map(([label, value]) => {
            const outcome = value as Row['baseline'];
            return <div key={label as string}><h3>{label as string}</h3><dl>
              {[['Personal-data type', outcome.typeIdentity], ['Location and range', outcome.range], ['Sensitivity and context', outcome.sensitivityContext], ['Output check', outcome.action.state], ...(outcome.action.verification ? [['Output result', outcome.action.verification]] : [])].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{word(value)} <code>({value})</code></dd></div>)}
            </dl></div>;
          })}
        </div>}</DialogContent>
        <DialogActions><button className={controls.sourceButton} type="button" onClick={() => setSelected(null)}>Close</button></DialogActions>
      </Dialog>
    </section>
  );
}
