import type { Page } from '@playwright/test';

export const WIDTHS: number[];
export const MAX_WORD: number;
export interface LayoutTarget {
  name: string;
  url: string;
  ready?: string;
  wait?: string;
  header?: boolean;
  gate?: boolean;
  abort?: boolean;
  loaded?: () => boolean;
  anchor?: string;
}
export function inspect(options: { maxWord: number }): string[];
export function inspectHeader(): string[];
export function pickWorkers(env?: Record<string, string | undefined>, cpus?: number): number;
export function checkTarget(page: Page, target: LayoutTarget, options?: { widths?: number[]; maxWord?: number; timeout?: number }): Promise<string[]>;
