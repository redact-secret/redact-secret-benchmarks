import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FamilyScannerRules.module.css';
import type { FamilyRuleRow, FamilyRulesData } from './types';

export interface FamilyScannerRulesProps extends FamilyRulesData {
  className?: string;
}

const columns: DataTableColumn<FamilyRuleRow>[] = [
  { key: 'scanner', header: 'Scanner', rowHeader: true, cell: r => r.scanner },
  { key: 'rule', header: 'Rule', cell: r => <Code>{r.rule}</Code> },
  { key: 'basis', header: 'What the rule matches', cell: r => r.basis },
];

/**
 * The peer scanners' own rules that can match a credential of this family, with the pattern evidence the
 * reviewed map records for each (`scanners/peer-rule-families.json`). It reads the rule files, not the
 * results: it says where a scanner's rules point, never what it found or which scanner is better.
 */
export function FamilyScannerRules({ rules, withoutRules, reviewed, className }: FamilyScannerRulesProps) {
  return (
    <Section title="Scanner rules for this family" description={reviewed} className={cx(styles.rules, className)}>
      {rules.length > 0 ? (
        <DataTable<FamilyRuleRow> columns={columns} rows={rules} getRowKey={r => `${r.scanner}/${r.rule}`} caption="Peer scanner rules that target this family" wide stackOnPhone />
      ) : (
        <EmptyState title="No peer rule maps to this family">
          <p>None of the reviewed peer scanners has a rule that can match a credential of this family.</p>
          <p><StatusBadge status="none">None mapped</StatusBadge></p>
        </EmptyState>
      )}
      {rules.length > 0 && withoutRules.length > 0 && (
        <p className={styles.small}>No rule maps to this family in {withoutRules.join(', ')}.</p>
      )}
    </Section>
  );
}
