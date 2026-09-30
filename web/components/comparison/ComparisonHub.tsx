import { cx } from '../../lib/cx';
import { Stack } from '../layout';
import { PageHead } from '../page';
import { ComparisonQuestions } from './ComparisonQuestions';
import { HowWeCompare } from './HowWeCompare';
import { ToolKinds } from './ToolKinds';
import type { ComparisonQuestion, Principle, RunLine, ToolKind } from './types';
import styles from './ComparisonHub.module.css';

export interface ComparisonHubProps {
  eyebrow: string;
  title: string;
  lede: string;
  questions: ComparisonQuestion[];
  kindsTitle: string;
  kindsIntro: string;
  kinds: ToolKind[];
  methodTitle: string;
  principles: Principle[];
  runsLabel: string;
  runs: RunLine[];
  className?: string;
}

/** `/comparison`: the page is a router. Three questions are the page; the rest is quiet context below them. */
export function ComparisonHub({ eyebrow, title, lede, questions, kindsTitle, kindsIntro, kinds, methodTitle, principles, runsLabel, runs, className }: ComparisonHubProps) {
  return (
    <Stack gap="xl" className={cx(styles.hub, className)}>
      <PageHead eyebrow={eyebrow} title={title} lede={lede} />
      <ComparisonQuestions questions={questions} label="Comparisons" />
      <ToolKinds title={kindsTitle} intro={kindsIntro} kinds={kinds} />
      <HowWeCompare title={methodTitle} principles={principles} runsLabel={runsLabel} runs={runs} />
    </Stack>
  );
}
