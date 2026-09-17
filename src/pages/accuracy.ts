import { fixtures } from '../catalog';
import { comparison, fixtureList, stats } from './browse';
import { escape as e, type Report } from '../types';

export function accuracy(report: Report): string {
  const selected = fixtures.filter(f => f.category === report.category);
  const review = report.milestoneReview;
  return `<div class="notice"><div><strong>Purpose-separated results · schema v3</strong><p>${e(report.reviewStatus)}. ${e(report.scope ?? '')}</p>${review ? `<p>Release regression context: ${e(review.targetRelease)}. ${e(review.validation)}</p><p>Not evaluated: ${review.unverifiedSurfaces.map(e).join(' · ')}</p>` : ''}</div></div>` + stats(selected) + comparison(selected, [report]) + fixtureList(selected, [report]);
}
