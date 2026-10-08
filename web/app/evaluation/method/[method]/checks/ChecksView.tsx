'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { MethodCases } from '../../../../../components/evaluation/methods';
import type { MethodCasesProps } from '../../../../../components/evaluation/methods';
import { useBuildData } from '../../../../../lib/build-data';
import {
  checksBody, checksFileFits, checksNotes, checksPageCount, checksQueryOf, listKey, type ChecksContext, type ChecksEntry, type ChecksFile,
} from '../../../../../resolvers/evaluation-checks-view';
import { failureText } from '../../../../report/dataFailure';

export interface ChecksViewProps {
  /** Every list the method page links to, with its figure and head, resolved on the server. */
  entries: ChecksEntry[];
  context: ChecksContext | null;
  /** The head the page shows when the address names no list it holds. */
  fallback: Pick<MethodCasesProps, 'crumbs' | 'eyebrow' | 'title' | 'meta' | 'back'>;
}

const never = (_value: unknown): _value is ChecksFile => false;

/**
 * One list of the method, chosen by `?row=&scanner=&status=&page=`. Its checks come from one build-emitted file, fetched when the list is
 * opened and kept for the session, so paging through a list costs nothing after the first page. While the file loads the page shows the
 * list's head (its figure and filters are already known) and a skeleton; a failure says why and offers a retry; an address that names no
 * list, or a page past the last, says so. The figure is the server's and the file must hold exactly that many checks of this run.
 */
export function ChecksView({ entries, context, fallback }: ChecksViewProps) {
  const query = checksQueryOf(useSearchParams());
  const entry = useMemo(() => (query ? entries.find(e => listKey(e.row, e.scanner, e.status) === listKey(query.row, query.scanner, query.status)) : undefined), [entries, query]);
  const fits = useMemo(() => (entry && context ? checksFileFits(entry, context.runId) : never), [entry, context]);
  const pageInRange = !!query && !!entry && query.page >= 1 && query.page <= checksPageCount(entry.total);
  const load = useBuildData(entry && pageInRange ? entry.src : null, fits, 'now');
  const body = entry && context && load.data && query ? checksBody(entry, load.data, query.page, context) : null;
  const state = !query ? 'idle' : !entry || !context || !pageInRange ? 'missing' : body ? 'ready' : load.status === 'error' ? 'error' : 'loading';

  let props: MethodCasesProps | undefined;
  if (state === 'missing') {
    props = {
      ...fallback, lede: 'This address names no list of this method, or a page the list does not have.', filters: [], notes: [],
      body: {
        state: 'missing', title: 'No such list',
        text: entry ? `This list has ${checksPageCount(entry.total).toLocaleString('en-US')} ${checksPageCount(entry.total) === 1 ? 'page' : 'pages'}.` : 'Open a count on the method page, or a list from the index of this method’s checks.',
      },
    };
  } else if (state !== 'idle' && entry && context) {
    const common = { ...entry.head, notes: checksNotes(entry, context), meta: context.meta, back: context.back };
    if (body) props = { ...common, body };
    else if (state === 'error') {
      const problem = failureText(load.failure, 'this list', 'The method page and its counts are unaffected.');
      props = { ...common, body: { state: 'error', title: problem.title, detail: problem.detail, retryLabel: problem.retryLabel, onRetry: problem.reload ? () => window.location.reload() : load.retry } };
    } else props = { ...common, body: { state: 'loading', label: `Loading the ${entry.total.toLocaleString('en-US')} checks of this list` } };
  }
  return (
    // `data-checks-state` names what is drawn; `data-checks-ready` marks a settled view, which the layout check waits for.
    <div data-checks-state={state} data-checks-ready={state === 'ready' || state === 'missing' ? '' : undefined}>
      {props && <MethodCases {...props} />}
    </div>
  );
}
