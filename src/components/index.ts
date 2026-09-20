/** The benchmark-app components (redesign plan section 10, plus the pager). Tokens only; no data access. */
export { figure, directionWord, isWithheld, withheldReason, type FigureInput, type FigureRate, type FigureWithheld } from './figure';
export { interval, scaleMax, type IntervalInput } from './interval';
export { statusMark, DEFAULT_WORD, type StatusKind } from './status-mark';
export { byteView, byteLines, displayText, segment, describeSpans, type ByteLine, type ByteRange, type ByteSpan } from './byte-view';
export { redactionLane, laneMarks, OUTCOME_NAME, OUTCOME_SHAPE, type LaneMark, type LaneShape, type Outcome } from './redaction-lane';
export { evidenceCrumb, type CrumbPart } from './evidence-crumb';
export { actionEmptyState, type ActionEmptyStateInput } from './action-empty-state';
export { pager, bindPager } from './pager';
export { escapeHtml, formatPercent, formatCount } from './html';
