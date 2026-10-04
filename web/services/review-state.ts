/**
 * How many fixtures of the accepted evidence release carry the review state `maintainer-only` (credential-evidence ADR 0020,
 * solo-maintainer period), read from the data the adoption recorded: `benchmarks/evidence-adoption.json` names the change report
 * whose `reviewState.candidate.fixtures` holds the release's own counts. Disclosure only: nothing here changes a number or a status.
 *
 * Absent (no adoption record, no review-state facts, or an adoption of another release than the one the view was built from) means
 * the disclosure is not shown for that build; it is never a zero.
 */
import { once, readJsonIfPresent } from './repo';

export interface ReviewDisclosureData {
  /** Fixtures of the release carrying the `maintainer-only` state. */
  maintainerOnly: number;
  /** Every fixture of the release, by state. */
  total: number;
  /** The evidence release the counts belong to. */
  evidenceRelease: string;
}

interface AdoptionRecord { state?: string; candidate?: { evidenceRelease?: string; changeReport?: string } }
interface ChangeReport { reviewState?: { candidate?: { present?: boolean; fixtures?: { total?: number; maintainerOnly?: number } } } }

export function loadReviewDisclosure(evidenceTag: string | undefined): Promise<ReviewDisclosureData | undefined> {
  return once(`review-disclosure:${evidenceTag ?? ''}`, async () => {
    const record = await readJsonIfPresent<AdoptionRecord>('benchmarks/evidence-adoption.json');
    const release = record?.candidate?.evidenceRelease;
    const reportPath = record?.candidate?.changeReport;
    if (record?.state !== 'accepted' || !release || !reportPath || !evidenceTag || evidenceTag !== release) return undefined;
    const report = await readJsonIfPresent<ChangeReport>(reportPath);
    const fixtures = report?.reviewState?.candidate?.present ? report.reviewState.candidate.fixtures : undefined;
    if (!fixtures || !Number.isInteger(fixtures.maintainerOnly) || !Number.isInteger(fixtures.total)) return undefined;
    return { maintainerOnly: fixtures.maintainerOnly as number, total: fixtures.total as number, evidenceRelease: release };
  });
}
