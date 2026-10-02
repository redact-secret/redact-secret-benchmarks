/**
 * Which pipeline the credential report pages are built from (#608): the one committed value in
 * `benchmarks/qualification-authority.json`, read here and nowhere else in the app. Every consumer asks this service for the
 * answer; none opens the file, and nothing infers it (no environment variable, no query string, no fallback to the other path).
 *
 * `legacy` builds the pages from the legacy run files and the committed fixture corpora (`services/run.ts`, `catalog.ts`).
 * `new` builds them from the qualification view the RunArtifact adapter derived from the official credential-eval runs
 * (`services/qualification.ts`), and only while that view is the one the authorisation names.
 *
 * An absent file means `legacy`, the state before the switch. A file that is present and does not validate fails the build: a
 * malformed switch must not quietly select a pipeline.
 */
import { AUTHORITY_FILE, DEFAULT_AUTHORITY, authorityShapeProblems, type Authority, type QualificationAuthority } from '../../benchmarks/qualification/authority';
import { once, readJsonIfPresent } from './repo';

export { AUTHORITY_FILE };
export type { Authority, QualificationAuthority };

export interface AuthorityState {
  authority: Authority;
  /** `committed` when the file was read, `default` when it is absent. */
  from: 'committed' | 'default';
  /** The parsed file, or `undefined` when there is none. */
  file: QualificationAuthority | undefined;
}

export function loadAuthority(): Promise<AuthorityState> {
  return once('authority', async () => {
    const value = await readJsonIfPresent<unknown>(AUTHORITY_FILE);
    if (value === undefined) return { authority: DEFAULT_AUTHORITY, from: 'default', file: undefined } satisfies AuthorityState;
    const problems = authorityShapeProblems(value);
    if (problems.length) throw new Error(`${AUTHORITY_FILE} is invalid: ${problems.join('; ')}`);
    const file = value as QualificationAuthority;
    return { authority: file.authority, from: 'committed', file } satisfies AuthorityState;
  });
}
