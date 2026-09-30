'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { AccuracyDifferences } from '../../../components/comparison';
import { Disclosure } from '../../../components/disclosure';
import { differenceColumns, differencesOf, type DiffData, type DifferencesSlot } from '../../../resolvers/accuracy';

const Diffs = createContext<DiffData | null>(null);

/** Holds the compact differences once for every panel below it; nothing is fetched. */
export function DifferencesProvider({ data, children }: { data: DiffData; children: ReactNode }) {
  return <Diffs.Provider value={data}>{children}</Diffs.Provider>;
}

/**
 * "Show the n files with different results": the lists are built from the shared compact data
 * only when the reader opens it, so the many pre-rendered panels carry a closed button each.
 */
export function Differences({ slot }: { slot: DifferencesSlot }) {
  const data = useContext(Diffs);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState<boolean[]>([false, false]);
  if (!data) return null;
  const lists = open ? differencesOf(data, slot.peer, slot.level, slot.scope, slot.q) : undefined;
  return (
    <Disclosure variant="plain" summary={slot.summary} onToggle={setOpen}>
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
