/**
 * Evidence classes (#139, epic #138): public adversarial, protected holdout
 * and maintainer regression evidence are kept apart and queried separately,
 * never merged into one count.
 *
 * Wording is part of the contract. Only a protected, custodian-held holdout
 * may be described as independent; project-authored evidence never may, and
 * an externally authored public pack is described as "externally authored",
 * because its author may have inspected the detector implementation.
 */
import type { HoldoutManifest } from '../../holdout/types.ts';
import type { IntakeRecord } from './adversarial-intake.ts';

export type EvidenceClass = 'public-adversarial' | 'protected-holdout' | 'maintainer-regression';

export const EVIDENCE_CLASSES: Record<EvidenceClass, { label: string; description: string; mayClaimIndependence: boolean }> = {
  'maintainer-regression': {
    label: 'Maintainer-authored regression',
    description: 'Written or materially edited by project maintainers. Regression coverage only; it is not evidence of detector quality on unseen input.',
    mayClaimIndependence: false,
  },
  'public-adversarial': {
    label: 'Externally authored public adversarial fixture',
    description: 'Authored outside the project, with expectations committed before any scanner ran, and published with its frozen first run. The author may have read the detector source; see each pack\'s exposure record.',
    mayClaimIndependence: false,
  },
  'protected-holdout': {
    label: 'Custodian-held blind fixture',
    description: 'Held by a custodian outside the development loop; only aggregate results are published.',
    mayClaimIndependence: true,
  },
};

export const EVIDENCE_CLASS_IDS = Object.keys(EVIDENCE_CLASSES) as EvidenceClass[];

export interface EvidenceRow {
  evidenceClass: EvidenceClass;
  label: string;
  source: string;
  id: string;
  detail: Record<string, string | number | boolean>;
}

export interface EvidenceSources {
  regressionManifest: { categories: string[] };
  holdoutManifests: { path: string; manifest: HoldoutManifest }[];
  packs: { path: string; record: IntakeRecord }[];
}

function packRow(evidenceClass: EvidenceClass, path: string, record: IntakeRecord): EvidenceRow {
  return {
    evidenceClass,
    label: EVIDENCE_CLASSES[evidenceClass].label,
    source: path,
    id: record.id,
    detail: {
      attribution: record.author.attribution,
      inspectedDetectorImplementation: record.implementationExposure.inspectedDetectorImplementation,
      fixtures: record.fixtures.length,
      status: record.status,
    },
  };
}

/**
 * The rows of one evidence class. Sample packs are never evidence; submitted,
 * in-review, frozen-but-unaccepted and rejected packs are not evidence yet.
 * The public holdout conformance controls are engine checks, not protected
 * holdout, and appear in no class. Holdout rows carry manifest metadata only.
 */
export function queryEvidence(sources: EvidenceSources, evidenceClass: EvidenceClass): EvidenceRow[] {
  const packs = sources.packs.filter(pack => !pack.record.sample);
  switch (evidenceClass) {
    case 'public-adversarial':
      return packs
        .filter(({ record }) => record.status === 'accepted' && record.qualification === 'externally-authored')
        .map(({ path, record }) => packRow(evidenceClass, path, record));
    case 'maintainer-regression':
      return [
        ...sources.regressionManifest.categories.map(category => ({
          evidenceClass,
          label: EVIDENCE_CLASSES[evidenceClass].label,
          source: 'corpora/regression/manifest.json',
          id: category,
          detail: {},
        })),
        ...packs
          .filter(({ record }) => record.status === 'converted-to-maintainer-regression' ||
            (record.status === 'accepted' && record.qualification === 'maintainer-regression'))
          .map(({ path, record }) => packRow(evidenceClass, path, record)),
      ];
    case 'protected-holdout':
      return sources.holdoutManifests
        .filter(({ manifest }) => manifest.purpose === 'protected')
        .map(({ path, manifest }) => ({
          evidenceClass,
          label: EVIDENCE_CLASSES[evidenceClass].label,
          source: path,
          id: manifest.id,
          detail: { revision: manifest.revision, review: manifest.review, corpusHash: manifest.corpusHash },
        }));
  }
}

const NEGATION = /\b(?:not|never|no|cannot|can't|nor|without)\b/i;
const INDEPENDENCE = /(?<![-.\w])independen(?:t|tly|ce)\b/gi;

/**
 * The sentences in `text` that assert independence: they use "independent",
 * "independently" or "independence" without a preceding negation in the same
 * sentence (HTML tags also end a sentence). Hyphenated compounds such as
 * "scanner-independent" and property accesses such as `h.independence` are
 * not claims.
 */
export function independenceClaims(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+|<[^>]*>/)
    .filter(sentence => [...sentence.matchAll(INDEPENDENCE)].some(match => !NEGATION.test(sentence.slice(0, match.index))));
}

/** Problems with publishing `text` as the description of evidence in `evidenceClass`. */
export function evidenceLanguageProblems(evidenceClass: EvidenceClass, text: string): string[] {
  if (EVIDENCE_CLASSES[evidenceClass].mayClaimIndependence) return [];
  return independenceClaims(text).map(sentence => `${evidenceClass} evidence may not be described as independent: "${sentence.trim()}"`);
}
