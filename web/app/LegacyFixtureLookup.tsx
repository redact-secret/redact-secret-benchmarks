'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { EmptyState } from '../components/feedback';
import { Code } from '../components/text';
import { BuildDataError, loadBuildData } from '../lib/build-data';
import { recordsDataPath } from '../lib/data-paths';
import { legacyFixtureTarget, parseLegacyFixturePath, parseSuiteLandingPath, type LegacyFixtureRef } from '../lib/legacy-fixture';
import { isSuiteRecordsFile } from '../resolvers/fixtures';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** What the suite's own records say about a legacy address: open it, no such suite, no such fixture in the suite, or the check could not be made. */
export type LegacyFixtureOutcome = 'found' | 'unknown-suite' | 'unknown-fixture' | 'unchecked';

/**
 * Check a legacy fixture against the build-emitted records file of its suite (the file the suite page reads, one request, kept for the session). The
 * suite is known when the file exists (the host answers 404 for a suite that is not a page); the fixture is known when one of its records has the id.
 * A network failure is `unchecked`, never "unknown": the reader is not told a fixture does not exist when the page could not find out.
 */
export async function lookupLegacyFixture(ref: LegacyFixtureRef, load: typeof loadBuildData = loadBuildData): Promise<LegacyFixtureOutcome> {
  try {
    const file = await load(recordsDataPath(ref.suite), isSuiteRecordsFile);
    return file.records.some(record => record.id === ref.id) ? 'found' : 'unknown-fixture';
  } catch (error) {
    if (error instanceof BuildDataError && error.status === 404) return 'unknown-suite';
    return 'unchecked';
  }
}

type State = { kind: 'idle' } | { kind: 'checking'; ref: LegacyFixtureRef } | { kind: 'missing'; ref: LegacyFixtureRef; outcome: 'unknown-suite' | 'unknown-fixture' | 'unchecked' };

/**
 * The 404 page's answer to an old `/fixture/<suite>--<id>` link (#594). A static host cannot rewrite it (the export holds a page per suite, not per
 * fixture), so the page that was served in its place looks at its own address: a well-formed one is checked against the suite's records, and a known
 * fixture is replaced by its suite page (`?fixture=<id>`, original query and hash kept). Anything else stays a 404 that says what it looked for, and
 * links to the suite when the suite exists. Renders its children (the ordinary 404) for an address that is not a legacy fixture link, and in place of them for one that is.
 */
export function LegacyFixtureLookup({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  useEffect(() => {
    // Served as the 404 page, so a suite landing address is a suite this export does not have: no request is needed to know it.
    const landing = parseSuiteLandingPath(window.location.pathname, window.location.search, BASE_PATH);
    if (landing) {
      setState({ kind: 'missing', ref: landing, outcome: 'unknown-suite' });
      return undefined;
    }
    const ref = parseLegacyFixturePath(window.location.pathname, BASE_PATH);
    if (!ref) return undefined;
    let cancelled = false;
    setState({ kind: 'checking', ref });
    lookupLegacyFixture(ref).then(outcome => {
      if (cancelled) return;
      if (outcome === 'found') window.location.replace(legacyFixtureTarget(ref, window.location.search, window.location.hash, BASE_PATH));
      else setState({ kind: 'missing', ref, outcome });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.kind === 'idle') return <>{children}</>;
  const { ref } = state;
  if (state.kind === 'checking') {
    return <EmptyState title={`Opening fixture ${ref.id}`}>This is an old fixture address. Looking for <Code>{ref.id}</Code> in the suite <Code>{ref.suite}</Code>.</EmptyState>;
  }
  const suiteLink = <Link href={`/report/fixtures/${ref.suite}/`}>Fixtures in {ref.suite}</Link>;
  if (state.outcome === 'unknown-fixture') {
    return <EmptyState title={`No fixture “${ref.id}” in the suite ${ref.suite}`} action={suiteLink}>This is an old fixture address. The suite exists, and none of its fixtures has this id.</EmptyState>;
  }
  if (state.outcome === 'unknown-suite') {
    return <EmptyState title={`No suite “${ref.suite}”`} action={<Link href="/report/fixtures/">All suites</Link>}>An old fixture address names a suite and a fixture id. This report publishes no suite with this id, so there is no page for fixture <Code>{ref.id}</Code>. Suites are the groups of the report's current population; an older corpus that is not one of them has no fixture pages.</EmptyState>;
  }
  return <EmptyState title={`Could not check fixture “${ref.id}”`} action={suiteLink}>This is an old fixture address, but the suite’s records could not be loaded. Try again, or open the suite.</EmptyState>;
}
