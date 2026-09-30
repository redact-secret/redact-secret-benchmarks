import { resolveSuiteRecordsFile, resolveSuiteSlugs } from '../../../../../resolvers/pages';

/**
 * Writes `data/fixtures/<suite>/records.json` into the static export: the compact records (bytes,
 * expected spans, each scanner's packed row) and the shared text of one suite, from which the
 * browser builds the page of the one fixture `?fixture=<id>` names. Served once per suite, fetched
 * by `FixtureView` through `lib/build-data.ts` only when a fixture is opened.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveSuiteSlugs()).map(suite => ({ suite }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ suite: string }> }) {
  const file = await resolveSuiteRecordsFile((await params).suite);
  if (!file) return new Response('Not found', { status: 404 });
  return Response.json(file);
}
