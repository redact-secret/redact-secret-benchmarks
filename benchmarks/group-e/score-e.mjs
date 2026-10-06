// Group E scoring (#754) is Batch 2's scorer, unchanged: the round-2 scorer is re-exported and nothing is added or wrapped.
// Which of its outputs are usable for this corpus is stated in corpus-e.mjs INEXPRESSIBLE (finding-type-and-action).
export { scoreCase, summarize, parity } from '../batch2/score-r2.mjs';
