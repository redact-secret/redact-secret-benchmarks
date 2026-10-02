import type { Metadata } from 'next';
import { LandingHero, QuestionLinks, RulesStrip } from '../components/landing';
import { resolveLandingPage } from '../resolvers/pages';
import { LandingSpecimen } from './LandingSpecimen';

export const metadata: Metadata = { title: { absolute: 'Redact Secret Benchmarks' } };

/** The landing page: the question the site answers, one illustrated reading, and where each part of the answer is. */
export default async function Page() {
  const data = await resolveLandingPage();
  return (
    <>
      <LandingHero
        eyebrow={data.eyebrow}
        headline={data.headline}
        lede={<>{data.lede.before}<b>{data.lede.strong}</b>{data.lede.after}</>}
        caveat={data.caveat}
        aside={<LandingSpecimen {...data.specimen} />}
      />
      <QuestionLinks label={data.questionsLabel} questions={data.questions} />
      <RulesStrip label={data.rulesLabel} rules={data.rules} />
    </>
  );
}
