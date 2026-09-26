import type { CandidateFeatureDataset, CandidateRow } from './candidate-features.ts';

export interface CalibrationPartition {
  schemaVersion: 1;
  id: string;
  tuningCategories: string[];
  developmentEvaluationCategories: string[];
}

export interface FamilyCoverage {
  family: string;
  mustRedact: number;
  policy: number;
  controls: number;
  authored: number;
  generated: number;
}

const measurablePositive = (row: CandidateRow) => row.role === 'secret' && row.tier !== 'T0';
const measurableControl = (row: CandidateRow) => row.role === 'none' && row.tier !== 'T0';

export function calibrationPartitionProblems(partition: CalibrationPartition, dataset: CandidateFeatureDataset): string[] {
  const problems: string[] = [];
  if (partition.schemaVersion !== 1 || !partition.id || !Array.isArray(partition.tuningCategories) || !Array.isArray(partition.developmentEvaluationCategories)) {
    return ['partition: invalid shape'];
  }
  const development = [...new Set(dataset.corpora.filter(c => c.partition === 'development').map(c => c.category))].sort();
  const tuning = partition.tuningCategories;
  const evaluation = partition.developmentEvaluationCategories;
  if (new Set(tuning).size !== tuning.length) problems.push('partition: duplicate tuning category');
  if (new Set(evaluation).size !== evaluation.length) problems.push('partition: duplicate development-evaluation category');
  const overlap = tuning.filter(category => evaluation.includes(category));
  if (overlap.length) problems.push(`partition: categories appear in both roles: ${overlap.sort().join(', ')}`);
  const declared = [...new Set([...tuning, ...evaluation])].sort();
  const missing = development.filter(category => !declared.includes(category));
  const unknown = declared.filter(category => !development.includes(category));
  if (missing.length) problems.push(`partition: missing development categories: ${missing.join(', ')}`);
  if (unknown.length) problems.push(`partition: unknown development categories: ${unknown.join(', ')}`);

  const rows = dataset.rows.filter(row => row.partition === 'development' && tuning.includes(row.category));
  const families = [...new Set(dataset.rows.filter(row => row.partition === 'development' && measurablePositive(row)).map(row => row.family))].sort();
  for (const family of families) {
    const familyRows = rows.filter(row => row.family === family);
    if (!familyRows.some(measurablePositive)) problems.push(`coverage: family ${family} has no reviewed authored positive in tuning`);
    if (!familyRows.some(measurableControl)) problems.push(`coverage: family ${family} has no reviewed authored negative in tuning`);
  }
  if (rows.some(row => row.origin !== 'authored')) problems.push('generatedShare: tuning contains a benchmark-generated row');
  return problems;
}

export function calibrationPartitionCoverage(partition: CalibrationPartition, dataset: CandidateFeatureDataset): FamilyCoverage[] {
  const rows = dataset.rows.filter(row => row.partition === 'development' && partition.tuningCategories.includes(row.category));
  return [...new Set(rows.map(row => row.family))].sort().map(family => {
    const familyRows = rows.filter(row => row.family === family);
    return {
      family,
      mustRedact: familyRows.filter(row => measurablePositive(row) && row.kind === 'must-redact').length,
      policy: familyRows.filter(row => measurablePositive(row) && row.kind === 'policy').length,
      controls: familyRows.filter(measurableControl).length,
      authored: familyRows.filter(row => row.origin === 'authored').length,
      generated: familyRows.filter(row => row.origin === 'generated').length,
    };
  });
}
