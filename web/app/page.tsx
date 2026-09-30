import Link from 'next/link';
import { PageIntro } from '../components/shell';
import { SECTIONS } from '../lib/routes';

/** Preview index. The new site is not linked from the published one until cutover. */
export default function Page() {
  return (
    <>
      <PageIntro
        eyebrow="Preview"
        title="Redesigned benchmark site"
        lede="This is the redesign under construction. The published site is unchanged."
      />
      <ul>
        {SECTIONS.flatMap(s => s.entries).map(e => (
          <li key={e.href}><Link href={e.href}>{e.href}</Link></li>
        ))}
      </ul>
    </>
  );
}
