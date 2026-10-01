/**
 * What the qualification pages name about their source (#606), in one neutral module so the service that reads the file and the
 * pure resolver that tells a reader how to make it share one spelling without the resolver importing a service.
 */
export const QUALIFICATION_SCHEMA = 'redact-secret/qualification-view/v1';
export const QUALIFICATION_FILE = 'public/results/qualification-v1.json';
export const QUALIFICATION_COMMANDS = [
  'npm run official-runs:check',
  'node --import tsx scripts/run-official-credential-eval.ts   (once per population; see docs/specs/official-runs.md)',
  'npm run qualification:view -- --artifacts <dir>',
];
