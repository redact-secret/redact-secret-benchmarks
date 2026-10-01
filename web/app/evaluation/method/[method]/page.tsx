import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MethodPage } from '../../../../components/evaluation/methods';
import { isMethodId, METHOD_IDS } from '../../../../lib/methods';
import { METHOD_COPY } from '../../../../resolvers/evaluation-copy';
import { resolveMethodPageFor } from '../../../../resolvers/evaluation-pages';

/** The six methods are six pages, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export function generateStaticParams() {
  return METHOD_IDS.map(method => ({ method }));
}

export async function generateMetadata({ params }: { params: Promise<{ method: string }> }): Promise<Metadata> {
  const { method } = await params;
  return { title: isMethodId(method) ? `${METHOD_COPY[method].name} evaluation method` : 'Evaluation method' };
}

/** `/evaluation/method/<method>/`: what the method is, how it runs, what the run recorded, how to read it and its exact inputs. */
export default async function Page({ params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  if (!isMethodId(method)) notFound();
  return <MethodPage {...await resolveMethodPageFor(method)} />;
}
