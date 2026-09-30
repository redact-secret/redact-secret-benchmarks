import { resolveAccuracyDifferencesFile } from '../../../../../resolvers/pages';

/**
 * Writes `data/comparison/accuracy/differences.json` into the static export: for every pair of
 * `/comparison/accuracy`, the files where redact-secret and the other tool differ (one shared table of
 * files, one short list of references per tool). Fetched by the page's lists through `lib/build-data.ts`
 * only when a reader opens one. No file text and no value: slugs, levels and providers.
 */
export const dynamic = 'force-static';

export async function GET() {
  return Response.json(await resolveAccuracyDifferencesFile());
}
