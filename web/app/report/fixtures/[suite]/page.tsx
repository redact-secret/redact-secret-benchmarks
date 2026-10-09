import type { Metadata } from 'next';
import { resolveSuiteSlugs } from '../../../../resolvers/pages';
import { RouteRedirect } from '../../../RouteRedirect';

export const dynamicParams = false;
export const metadata: Metadata = { title: 'Credential Corpus has moved' };

export async function generateStaticParams() {
  return (await resolveSuiteSlugs()).map(suite => ({ suite }));
}

export default async function Page({ params }: { params: Promise<{ suite: string }> }) {
  return <RouteRedirect label="Credential Corpus" href={`/report/corpus/${(await params).suite}/`} />;
}
