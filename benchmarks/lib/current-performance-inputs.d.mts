import type input from '../inputs/performance/current.json';
import type { CurrentPerformanceSummary, CurrentMeasuredSummary } from './current-performance-inputs.ts';
export function validateCurrentPerformanceInputs(value: unknown): typeof input;
export function currentPerformanceInputs(): typeof input & { baseline: CurrentPerformanceSummary; accepted: CurrentMeasuredSummary };
