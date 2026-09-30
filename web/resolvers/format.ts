/**
 * Every number, interval, count and date the report pages show is formatted
 * here, once. Blocks receive text and never format. Pure: same input, same text,
 * whatever the machine's locale (the locale is fixed to en-US).
 */
export const int = (n: number): string => n.toLocaleString('en-US');

/** "3.6%" from a fraction. One decimal, as the existing site shows rates. */
export const percent = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`;

/** `1 fixture`, `2 fixtures`. */
export const count = (n: number, singular: string, plural = `${singular}s`): string => `${int(n)} ${n === 1 ? singular : plural}`;

/** "2026-09-30" from an ISO timestamp or date. Empty for anything that is not one. */
export const isoDate = (value: string | undefined): string => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '');
  return match ? match[1] : '';
};

/** The smallest of a fixed set of round axis maxima that holds `fraction`. */
const AXIS_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
export const axisMaxFor = (fraction: number): number => AXIS_STEPS.find(step => fraction <= step) ?? 1;

/** A fraction placed on an axis `0..axisMax`, clamped to 0..1 and rounded to 4 places. */
export const onAxis = (fraction: number, axisMax: number): number => Math.round(Math.min(1, Math.max(0, fraction / axisMax)) * 10000) / 10000;
