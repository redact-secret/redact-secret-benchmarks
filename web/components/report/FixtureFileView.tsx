import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { FixtureText } from './FixtureText';
import styles from './FixtureFileView.module.css';
import type { FileLineData, FileSegment, FixtureFileData } from './fixtureTypes';

export interface FixtureFileViewProps {
  file: FixtureFileData;
  className?: string;
}

/** Index where the run of spaces that ends the line starts, over the line's text as one string; -1 when it ends in none. */
function trailingStart(segments: FileSegment[]): number {
  const text = segments.map(s => s.text).join('');
  const trimmed = text.replace(/ +$/, '');
  return trimmed.length === text.length ? -1 : trimmed.length;
}

function Segment({ segment, offset, trailingFrom }: { segment: FileSegment; offset: number; trailingFrom: number }) {
  const text = <FixtureText text={segment.text} withTitle spaces="trailing" trailingFrom={trailingFrom < 0 ? undefined : trailingFrom - offset} />;
  const masked = segment.mark === 'redacted' || segment.mark === 'partial' || segment.mark === 'extra';
  let node: ReactNode = text;
  if (masked) {
    // A masked range is a picture of where a reported range sits: the bytes under it are neither shown nor read out.
    node = (
      <span className={cx(styles.mask, segment.mark === 'partial' && styles.partial)} role="img" aria-label={segment.label} title={segment.title}>
        <span aria-hidden="true">{text}</span>
      </span>
    );
  } else if (segment.mark) {
    node = <span className={styles[segment.mark]} title={segment.title}>{text}</span>;
  }
  // The secret sits inside the envelope so the underline runs unbroken beneath it.
  return segment.envelope ? <span className={styles.envelope}>{node}</span> : <>{node}</>;
}

function Line({ line }: { line: FileLineData }) {
  const trailingFrom = trailingStart(line.segments);
  let offset = 0;
  return (
    <div className={styles.line}>
      <span className={styles.no} aria-hidden="true">{line.number}</span>
      <span className={styles.text}>
        {line.segments.map((segment, i) => {
          const at = offset;
          offset += segment.text.length;
          return <Segment key={i} segment={segment} offset={at} trailingFrom={trailingFrom} />;
        })}
        {line.segments.every(s => s.text === '') && <span className={styles.empty} title="empty line">∅</span>}
      </span>
    </div>
  );
}

/**
 * One file the way the benchmark read it: the path and size above, numbered lines below, scrolling inside
 * its own region (never the page). Marks are drawn by shape as well as colour: an expected secret is a
 * dashed frame on green, a reported range a solid bar (hatched where the secret is partly exposed), an
 * exposed secret a dashed frame with the bytes showing, a byte a twin differs by a warning box. Lines
 * nothing touches may be left out of a long file and counted in a gap row. The values are synthetic.
 */
export function FixtureFileView({ file, className }: FixtureFileViewProps) {
  return (
    <figure className={cx(styles.file, className)}>
      <figcaption className={styles.head}>
        <span className={styles.path}>{file.title}</span>
        <span className={styles.facts}>{file.facts}{file.note && <> · {file.note}</>}</span>
      </figcaption>
      <div className={styles.scroll} role="region" tabIndex={0} aria-label={file.label}>
        <div className={styles.lines}>
          {file.rows.map((row, i) => ('gap' in row
            ? (
              <div key={`gap-${i}`} className={styles.gap}>
                <span className={styles.no} aria-hidden="true">⋮</span>
                <span>{row.gap === 1 ? '1 line' : `${row.gap} lines`} nothing marks, not shown</span>
              </div>
            )
            : <Line key={row.number} line={row} />))}
        </div>
      </div>
      {file.notice && <p className={styles.notice}>{file.notice}</p>}
    </figure>
  );
}
