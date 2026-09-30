'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AccuracyDifferences } from '../../../components/comparison';
import { Disclosure } from '../../../components/disclosure';
import { RetryNote, Skeleton, SkeletonBlock } from '../../../components/feedback';
import { useBuildData } from '../../../lib/build-data';
import { differenceColumns, differencesOf, isDiffFileOf, type DiffSource, type DifferencesSlot } from '../../../resolvers/accuracy';
import { failureText } from '../../report/dataFailure';

const Source = createContext<DiffSource | null>(null);

/** Tells every list below where the differing files are and what the file must be; nothing is fetched until a list is opened. */
export function DifferencesProvider({ source, children }: { source: DiffSource; children: ReactNode }) {
  return <Source.Provider value={source}>{children}</Source.Provider>;
}

/**
 * "Show the n files with different results". The many pre-rendered panels carry a closed button each; the
 * first list a reader opens fetches the one build-emitted file (kept for the session, so every other list is
 * instant) and the lists are built from it. While it loads a skeleton stands where the lists go; a failure says
 * why and offers a retry. The counts above it are in the page and unaffected.
 */
export function Differences({ slot }: { slot: DifferencesSlot }) {
  const source = useContext(Source);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<boolean[]>([false, false]);
  const guard = useMemo(() => isDiffFileOf({ runId: source?.runId ?? '', fixtures: source?.fixtures ?? 0 }), [source?.runId, source?.fixtures]);
  const load = useBuildData(open && source ? source.src : null, guard, 'now');
  if (!source) return null;
  const lists = open && load.data ? differencesOf(load.data, slot.peer, slot.level, slot.scope, slot.q) : undefined;
  const problem = open && load.status === 'error' ? failureText(load.failure, 'the list of files', 'The counts above are unaffected.') : undefined;
  return (
    <Disclosure variant="plain" summary={slot.summary} onToggle={setOpen}>
      {open && !lists && !problem && (
        <Skeleton label="Loading the list of files">
          <SkeletonBlock shape="line" width="half" />
          <SkeletonBlock shape="line" />
          <SkeletonBlock shape="line" width="half" />
        </Skeleton>
      )}
      {problem && <RetryNote title={problem.title} retryLabel={problem.retryLabel} onRetry={problem.reload ? () => window.location.reload() : load.retry}>{problem.detail}</RetryNote>}
      {lists && (
        <AccuracyDifferences
          columns={differenceColumns(lists, slot.q, slot.peerName, all)}
          none="None here."
          onShowAll={column => setAll(held => held.map((v, i) => v || i === column))}
        />
      )}
    </Disclosure>
  );
}
