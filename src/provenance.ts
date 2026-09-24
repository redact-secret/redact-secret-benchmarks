import { escape as e } from './types';

/**
 * Page-level provenance (#155): which environment served this page, which
 * benchmarks commit built it, and what product it measured. The environment
 * and commit are fixed at build time (VITE_SITE_ENV, VITE_BUILD_COMMIT); the
 * product facts are read from the published results, never restated here.
 */
export type SiteEnv = 'production' | 'staging' | 'local';

export const BENCHMARKS_REPOSITORY = 'https://github.com/redact-secret/redact-secret-benchmarks';
export const PRODUCT_REPOSITORY = 'https://github.com/redact-secret/redact-secret';
export const PRODUCTION_HOST = 'https://benchmarks.redactsecret.dev';

/** Anything but an explicit "production" or "staging" is a local build: an unset variable must never claim production. */
export const siteEnvOf = (value: string | undefined): SiteEnv =>
  value === 'production' || value === 'staging' ? value : 'local';

/** A full or abbreviated hex commit id, lower-cased; anything else is treated as unknown. */
export function commitOf(value: unknown): string | null {
  const commit = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[0-9a-f]{7,40}$/.test(commit) ? commit : null;
}

export interface Provenance {
  env: SiteEnv;
  /** Benchmarks commit that produced the build. */
  commit: string | null;
  /** Released product version the published run measured (run.json scannerVersions). */
  productVersion?: string | null;
  /** redact-secret commit measured by the candidate evidence, when a valid report is published. */
  candidateCommit?: string | null;
  /** Version that commit declares (the release in development, e.g. 0.1.0-beta.7). */
  candidateVersion?: string | null;
}

const commitLink = (repository: string, commit: string) =>
  `<a class="mono" href="${e(`${repository}/commit/${commit}`)}" rel="noreferrer">${e(commit.slice(0, 7))}</a>`;

/** Staging and local builds carry a banner on every route; production carries none. */
export function envBanner(env: SiteEnv): string {
  if (env === 'production') return '';
  const body = env === 'staging'
    ? `<b>Staging.</b> Provisional numbers, not public evidence. The published results are at <a href="${PRODUCTION_HOST}">${PRODUCTION_HOST.replace('https://', '')}</a>.`
    : '<b>Local build.</b> Not a published site; these numbers are not public evidence.';
  return `<div class="env-banner" data-env="${env}" role="note" aria-label="Site environment"><div class="env-banner-in">${body}</div></div>`;
}

const ENV_LABEL: Record<SiteEnv, string> = { production: 'Production', staging: 'Staging', local: 'Local build' };

/** The footer's one-line statement: environment, build commit, and what was measured. */
export function buildLine(p: Provenance): string {
  const parts = [
    `<span data-env="${p.env}">${ENV_LABEL[p.env]}</span>`,
    p.commit ? `benchmarks ${commitLink(BENCHMARKS_REPOSITORY, p.commit)}` : 'benchmarks commit unrecorded',
  ];
  if (p.productVersion) parts.push(`measured released redact-secret <b>${e(p.productVersion)}</b>`);
  // Candidate evidence is a staging concern; production states only the released version it measured.
  if (p.env !== 'production' && p.candidateCommit) {
    const version = p.candidateVersion ? ` <b>${e(p.candidateVersion)}</b> in development,` : '';
    parts.push(`candidate evidence for redact-secret${version} main ${commitLink(PRODUCT_REPOSITORY, p.candidateCommit)}`);
  }
  return parts.join(' · ');
}
