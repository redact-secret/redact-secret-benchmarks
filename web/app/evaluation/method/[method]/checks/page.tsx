import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MethodCases } from '../../../../../components/evaluation/methods';
import { isMethodId, METHOD_IDS } from '../../../../../lib/methods';
import { METHOD_COPY } from '../../../../../resolvers/evaluation-copy';
import { resolveMethodChecksPageFor } from '../../../../../resolvers/evaluation-pages';
import { CHECKS_SCRIPT } from './checks-script';
import { ChecksSync } from './ChecksSync';
import { ChecksView } from './ChecksView';
import styles from './Checks.module.css';

/** The five methods whose counts open checks; holdout has none (a holdout case cannot be opened). */
export const dynamicParams = false;

export function generateStaticParams() {
  return METHOD_IDS.filter(m => m !== 'holdout').map(method => ({ method }));
}

export async function generateMetadata({ params }: { params: Promise<{ method: string }> }): Promise<Metadata> {
  const { method } = await params;
  return { title: isMethodId(method) ? `${METHOD_COPY[method].name} checks` : 'Evaluation checks' };
}

/**
 * `/evaluation/method/<method>/checks/` (#623): the index of the method's lists and, when the address names one
 * (`?row=&scanner=&status=&page=`), that list: the checks behind one count of the method page, fetched from its own build-emitted file
 * when opened. One page per method keeps the export small (a page per list and page would be thousands); the index is the server HTML,
 * so a reader without script still sees every list and its figure.
 */
export default async function Page({ params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  if (!isMethodId(method) || method === 'holdout') notFound();
  const data = await resolveMethodChecksPageFor(method);
  const loading = { ...data.index, lede: ' ', filters: [], notes: [], body: { state: 'loading' as const, label: 'Loading the checks of this list' } };
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: CHECKS_SCRIPT }} />
      <Suspense fallback={null}><ChecksSync /></Suspense>
      <div className={styles.indexView}>
        <MethodCases {...data.index} />
      </div>
      {/* The fallback is what a direct visit to a list shows until the page has hydrated; it is hidden when no list is named. */}
      <Suspense fallback={<div className={styles.listView}><MethodCases {...loading} /></div>}>
        <div className={styles.listView}>
          <ChecksView entries={data.entries} context={data.context} fallback={{ crumbs: data.index.crumbs, eyebrow: data.index.eyebrow, title: data.index.title, meta: data.index.meta, back: data.index.back }} />
        </div>
      </Suspense>
    </>
  );
}
