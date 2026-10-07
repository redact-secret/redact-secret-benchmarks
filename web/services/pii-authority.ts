/**
 * Which pipeline the PII evaluation page is authoritative from (#666): the one committed value in `benchmarks/pii-authority.json`, read here
 * and nowhere else in the app. The PII evaluation asks this service; none opens the file, and nothing infers the value (no environment
 * variable, no query string, no fallback). It is independent of the credential authority (`services/authority.ts`): a credential
 * setting is not authorisation for PII, so neither service reads the other.
 *
 * `legacy`: the benchmark scorer and the frozen Beta.11 and Beta.13 evidence are the authority; the pii-eval measurement is shown beside
 * them as exploratory evidence. `new`: the pii-eval artifacts are the authority for the public/synthetic measurement, only while an owner
 * authorisation is recorded in the file; the legacy evaluator is then the bounded oracle, and the protected path (private-custodian,
 * private-ledger) is separately pending.
 * Freshness of that authorisation is held by `npm run pii:authority:check`, which reads the repository; this service refuses a `new`
 * without an authorisation record at all and never falls back to legacy under it.
 *
 * An absent file means `legacy`. A file that is present and does not validate fails the build: a malformed switch must not quietly select a
 * pipeline.
 */
import { DEFAULT_PII_AUTHORITY, PII_AUTHORITY_FILE, piiAuthorityShapeProblems, type PiiAuthority, type PiiAuthorityFile } from '../../benchmarks/evaluation/domains/pii/authority';
import { once, readJsonIfPresent } from './repo';

export type { PiiAuthority, PiiAuthorityFile };

export interface PiiAuthorityState {
  authority: PiiAuthority;
  /** `committed` when the file was read, `default` when it is absent. */
  from: 'committed' | 'default';
  file: PiiAuthorityFile | undefined;
  /** Public exit criteria still unmet, by id. Empty only when every public criterion is met. */
  unmet: string[];
  /** The number of public exit criteria. The protected path is counted apart: it never gates the public measurement. */
  total: number;
  /** Protected-scope criteria not met (the protected path is pending), by id. */
  protectedPending: string[];
  /** The recorded owner authorisation, summarised for the page; `null` when none is recorded. */
  authorisation: { acceptedBy: string; acceptedOn: string; scope: string; engine: string; officialRunId: number; source: string } | null;
  /** For `new` without an authorisation record: why the pii-eval pipeline may not be the authority. `null` otherwise. */
  refusal: string | null;
}

export function loadPiiAuthority(): Promise<PiiAuthorityState> {
  return once('pii-authority', async () => {
    const value = await readJsonIfPresent<unknown>(PII_AUTHORITY_FILE);
    if (value === undefined) return { authority: DEFAULT_PII_AUTHORITY, from: 'default', file: undefined, unmet: [], total: 0, protectedPending: [], authorisation: null, refusal: null } satisfies PiiAuthorityState;
    const problems = piiAuthorityShapeProblems(value);
    if (problems.length) throw new Error(`${PII_AUTHORITY_FILE} is invalid: ${problems.join('; ')}`);
    const file = value as PiiAuthorityFile;
    const unmet = file.exitCriteria.filter(c => c.scope === 'public' && c.state !== 'met').map(c => c.id);
    const protectedPending = file.exitCriteria.filter(c => c.scope === 'protected' && c.state !== 'met').map(c => c.id);
    const auth = file.new.authorisation;
    const authorisation = auth ? { acceptedBy: auth.acceptedBy, acceptedOn: auth.acceptedOn, scope: auth.scope, engine: file.new.target.engine, officialRunId: auth.target.officialRunId, source: auth.source.issueComment } : null;
    const refusal = file.authority === 'new' && !file.new.authorisation ? 'The authority is new but no owner authorisation is recorded. A credential authority setting is not authorisation for PII.' : null;
    return { authority: file.authority, from: 'committed', file, unmet, total: file.exitCriteria.filter(c => c.scope === 'public').length, protectedPending, authorisation, refusal } satisfies PiiAuthorityState;
  });
}
