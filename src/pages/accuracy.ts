import { fixtures } from '../catalog';
import { comparison, fixtureList, stats, readingNote } from './browse';
import { escape as e, type Report, type Run } from '../types';

export function accuracy(report: Report, run?: Run): string {
  const selected = fixtures.filter(f => f.category === report.category);
  const review = report.milestoneReview;
  return `<div class="notice"><div><strong>Schema v4 · run ${e(report.runId.slice(0, 19))}</strong><p>${e(report.reviewStatus)}. ${e(report.scope ?? '')}</p>${review ? `<p>Release regression context: ${e(review.targetRelease)}. ${e(review.validation)}</p><p>Not evaluated: ${review.unverifiedSurfaces.map(e).join(' · ')}</p>` : ''}</div></div>` + stats(selected) + readingNote() + comparison(selected, [report], run) + fixtureList(selected, [report], run);
}
