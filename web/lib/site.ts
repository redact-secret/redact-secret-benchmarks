import type { FooterLink } from '../components/shell/SiteFooter';

/** Where the footer sends a reader beyond this site. */
export const FOOTER_LINKS: FooterLink[] = [
  { label: 'redactsecret.com', href: 'https://redactsecret.com' },
  { label: 'GitHub · redact-secret', href: 'https://github.com/redact-secret/redact-secret' },
  { label: 'GitHub · benchmarks', href: 'https://github.com/redact-secret/redact-secret-benchmarks' },
  { label: 'Security', href: 'https://github.com/redact-secret/redact-secret-benchmarks/blob/main/SECURITY.md' },
];

export const LICENSE_HREF = 'https://github.com/redact-secret/redact-secret-benchmarks/blob/main/LICENSE';

/** Full site directory; quick navigation above the content stays deliberately small. */
export const FOOTER_GROUPS = [
  { label: 'Coverage', links: [
    { label: 'Providers', href: '/report/providers/' },
    { label: 'Detectors', href: '/report/detectors/' },
    { label: 'Credentials', href: '/report/families/' },
    { label: 'PII + PHI', href: '/evaluation/pii/' },
    { label: 'Internationalization', href: '/report/internationalization/' },
  ] },
  { label: 'Evaluation', links: [
    { label: 'Methods', href: '/evaluation/method/' },
    { label: 'Credential Eval', href: '/evaluation/credential/' },
    { label: 'PII Eval', href: '/evaluation/pii/' },
  ] },
  { label: 'Evidence', links: [
    { label: 'Providers', href: '/report/providers/' },
    { label: 'Cases', href: '/report/fixtures/' },
    { label: 'Resources', href: '/evidence/resources/' },
  ] },
  { label: 'Comparison', links: [
    { label: 'Scanners', href: '/evaluation/scanner/' },
    { label: 'Performance', href: '/comparison/performance/' },
    { label: 'Accuracy', href: '/comparison/accuracy/' },
  ] },
  { label: 'Development', links: [
    { label: 'Release candidate', href: '/evaluation/rc/' },
    { label: 'Qualification', href: '/evaluation/qualification/' },
  ] },
];
