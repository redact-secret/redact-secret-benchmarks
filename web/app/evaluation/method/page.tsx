import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumb, PageHead } from '../../../components/page';
import { METHOD_IDS, methodHref } from '../../../lib/methods';
import { METHOD_COPY } from '../../../resolvers/evaluation-copy';
import styles from './Methods.module.css';

export const metadata: Metadata = { title: 'Evaluation methods' };

const PII_METHODS = [
  { id: 'schema-only', name: 'Schema validation', description: 'Checks whether the authored case follows the PII contract before its observations are evaluated.' },
  { id: 'type-validation', name: 'Type validation', description: 'Uses a reference validator to check the authored personal-data type and compares the scanner’s observation with that expectation.' },
  { id: 'context-discrimination', name: 'Context discrimination', description: 'Checks whether the same kind of personal data is treated according to its authored sensitivity and surrounding context.' },
  { id: 'pii-benign', name: 'Benign controls', description: 'Checks authored harmless values that resemble personal data, keeping type and sensitivity expectations separate.' },
  { id: 'jurisdiction-collision', name: 'Jurisdiction collisions', description: 'Checks values that can match competing identifier formats, against the authored family and jurisdiction expectations.' },
  { id: 'mutation', name: 'Mutation', description: 'Applies recorded changes to an authored input and evaluates each generated variant against its expected result.' },
  { id: 'reference-differential', name: 'Reference differential', description: 'Compares scanner observations with authored reference evidence and validator observations.' },
];

export default function Page() {
  return (
    <div className={styles.page}>
      <PageHead before={<Breadcrumb items={[{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Methods' }]} />} eyebrow="Evaluation" title="Evaluation methods" lede="Choose a domain to understand how its test inputs are authored, varied and evaluated. A method listed here is not a claim that it ran or that a product passed." />
      <section className={styles.section} aria-labelledby="credential-methods">
        <header><h2 id="credential-methods">Credentials</h2><p>Methods for secrets, harmless lookalikes and changes to credential-bearing text. Open a card for its procedure and recorded evidence.</p></header>
        <div className={styles.cards}>
          {METHOD_IDS.map(id => <Link key={id} href={methodHref(id)} className={styles.card}>
            <h3>{METHOD_COPY[id].name}</h3><p>{METHOD_COPY[id].question}</p><span className={styles.action}>View method →</span>
          </Link>)}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="pii-methods">
        <header><h2 id="pii-methods">PII</h2><p>Methods for personal-data type, location, sensitivity and context. Coverage and measurement are recorded separately for each population.</p></header>
        <div className={styles.cards}>
          {PII_METHODS.map(method => <article key={method.id} className={styles.card} id={method.id}>
            <h3>{method.name}</h3><p>{method.description}</p>
          </article>)}
        </div>
        <Link className={styles.action} href="/evaluation/pii/">Explore PII method coverage and results →</Link>
      </section>
    </div>
  );
}
