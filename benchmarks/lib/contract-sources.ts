import type { FieldClaim } from '../types.ts';

// Source helpers shared by the registry contracts (assessment.ts) and the
// per-issue Beta.8 contract modules (benchmarks/lib/beta8/*.ts), so both cite
// the pinned peer rules and provider pages the same way.
export const observedAt = '2026-09-17';
export const th = (path: string, label?: string) => ({ tool: 'trufflehog 3.97.4', label: label ?? path, url: `https://github.com/trufflesecurity/trufflehog/blob/v3.97.4/pkg/detectors/${path}.go` });
export const gl = { tool: 'gitleaks 8.30.1', label: 'gitleaks.toml', url: 'https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml' };
export const unprobeable = (reason: string, at = '2026-09-20') => ({ reason, observedAt: at });
export const provider = (url: string, formatVersion: string, covers: string, observedAtOverride = observedAt) => ({ url, observedAt: observedAtOverride, formatVersion, covers });
/** One field of a contract and the evidence behind it; see `FieldClaim`. */
export const field = (claim: FieldClaim): FieldClaim => claim;
