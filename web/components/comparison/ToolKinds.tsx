import { cx } from '../../lib/cx';
import { Grid, Section } from '../layout';
import type { ToolKind } from './types';
import styles from './ToolKinds.module.css';

export interface ToolKindsProps {
  /** "Two kinds of tools". */
  title: string;
  intro: string;
  kinds: ToolKind[];
  className?: string;
}

/** Why runtime libraries and repository scanners are compared on different pages. States facts about each kind, never quality. */
export function ToolKinds({ title, intro, kinds, className }: ToolKindsProps) {
  return (
    <Section className={cx(styles.section, className)} title={title} description={intro} rule="none">
      <Grid columns={kinds.length > 2 ? 3 : 2} divided>
        {kinds.map(kind => (
          <div key={kind.name} className={styles.kind}>
            <h3 className={styles.name}>{kind.name}</h3>
            <p className={styles.text}>{kind.description}</p>
            <ul className={styles.tools}>
              {kind.tools.map(tool => (
                <li key={tool.name}>
                  <b>{tool.name}</b>
                  {tool.detail && <span> · {tool.detail}</span>}
                </li>
              ))}
            </ul>
            <p className={styles.text}>{kind.comparedIn}</p>
          </div>
        ))}
      </Grid>
    </Section>
  );
}
