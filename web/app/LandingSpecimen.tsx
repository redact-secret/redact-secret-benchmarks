'use client';

import { useState } from 'react';
import { Specimen, type SpecimenExample } from '../components/landing';

export interface LandingSpecimenProps {
  eyebrow: string;
  choiceLabel: string;
  replayLabel: string;
  examples: SpecimenExample[];
}

/** Holds the one piece of state the landing page has: which example is shown and how many times it was replayed. */
export function LandingSpecimen({ eyebrow, choiceLabel, replayLabel, examples }: LandingSpecimenProps) {
  const [active, setActive] = useState(examples[0]?.id ?? '');
  const [run, setRun] = useState(0);
  return (
    <Specimen
      eyebrow={eyebrow}
      choiceLabel={choiceLabel}
      replayLabel={replayLabel}
      examples={examples}
      active={active}
      onChange={id => { setActive(id); setRun(r => r + 1); }}
      runKey={run}
      onReplay={() => setRun(r => r + 1)}
    />
  );
}
