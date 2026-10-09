// Group C scoring (#752) is Batch 2's scorer, unchanged: no tolerance, no family special case. This module only re-exports it
// so the Group C reports and tests import from one place. A test asserts the exports are the Batch 2 functions themselves.
export { scoreCase, summarize, parity, summarizeR1 } from '../../harness/credential-carriers/score-multispan.mjs';
