'use client';

import type { ReactNode } from 'react';
import { Stack, Section } from '../../../../components/layout';
import { Chip, ChipList } from '../../../../components/feedback';
import { FamilyBenchmark, FamilyFormat, FamilyNotes, FamilyResearchRecord, FamilyScannerRules, FamilySources } from '../../../../components/family';
import type { FamilyBenchmarkData, FamilyFormatData, FamilyNoteItem, FamilyResearchRecordData, FamilyRulesData, FamilySourcesData } from '../../../../components/family';

export interface FamilyViewProps {
  name: string;
  providerName: string;
  /** The canonical research record (#591). */
  research: FamilyResearchRecordData;
  canonicalFormat: FamilyFormatData;
  format: FamilyNoteItem[];
  open: FamilyNoteItem[];
  lookAlikes: FamilyNoteItem[];
  benchmark: FamilyBenchmarkData;
  rules: FamilyRulesData;
  sources: FamilySourcesData;
  siblings: { name: string; href: string }[];
  /** The fixture rows (`RowsView`), drawn between the scanner rules and the sources. */
  children: ReactNode;
}

/**
 * The family page's reading column below the head: the canonical research record (#591), format notes, benchmark counts, open questions, look-alikes,
 * scanner rules, the rows, then sources. It is a client component only so the page's data travels once as compact
 * props instead of as a server-rendered element tree, which Next writes again in three files per page (the
 * export budget in `check-export-rows.mjs`). It fetches nothing and keeps no state; the first paint is its HTML.
 */
export function FamilyView({ name, providerName, research, canonicalFormat, format, open, lookAlikes, benchmark, rules, sources, siblings, children }: FamilyViewProps) {
  return (
    <Stack gap="lg">
      <FamilyResearchRecord name={name} {...research} />
      <FamilyFormat name={name} {...canonicalFormat} />
      <FamilyNotes
        title="Benchmark dossier notes"
        description="From the provider dossier, as written. The evidence level above says how well the format is backed; a fact the dossier does not record is not shown."
        items={format}
        emptyTitle="No format notes recorded"
        emptyText="The provider dossier has no shape, basis or issuance note for this family, so nothing is stated about its format here."
      />
      <FamilyBenchmark {...benchmark} />
      {open.length > 0 && (
        <FamilyNotes title="Benchmark dossier questions" description="Things the sources do not settle. They are listed so nobody reads them as settled." items={open} emptyTitle="" emptyText="" />
      )}
      {lookAlikes.length > 0 && (
        <FamilyNotes title="Looks like it, but isn't" description="Values the dossier records as resembling this credential without being one." items={lookAlikes} emptyTitle="" emptyText="" />
      )}
      <FamilyScannerRules {...rules} />
      {children}
      <FamilySources {...sources} />
      {siblings.length > 0 && (
        <Section title={`Other ${providerName} families`} rule="hairline">
          <ChipList label={`Other ${providerName} families`} items={siblings.map(s => <Chip key={s.href} href={s.href} mono={false}>{s.name}</Chip>)} />
        </Section>
      )}
    </Stack>
  );
}
