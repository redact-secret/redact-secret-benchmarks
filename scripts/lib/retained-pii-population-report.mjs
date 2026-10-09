/** Bind the retained human report to the accepted machine record and its current renderer. */
import { createHash } from 'node:crypto';
import { renderReport } from './pii-population-report.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
export function retainedPiiPopulationReportProblems(receipt, recordBytes) {
  const problems = [];
  if (receipt?.schema !== 'redact-secret/pii-population-report-receipt/v1' || !/^[0-9a-f]{40}$/.test(receipt.sourceCommit ?? '') || !/^[0-9a-f]{64}$/.test(receipt.markdownSha256 ?? '') || !/^[0-9a-f]{64}$/.test(receipt.recordSha256 ?? '')) return ['invalid retained PII report receipt'];
  if (digest(recordBytes) !== receipt.recordSha256) problems.push('retained report is bound to different machine-record bytes');
  try { if (digest(renderReport(JSON.parse(recordBytes))) !== receipt.markdownSha256) problems.push('current renderer differs from the accepted historical report'); }
  catch { problems.push('accepted machine record cannot be rendered'); }
  return problems;
}
