import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { StatusBadge } from '../feedback';
import { cx } from '../../lib/cx';
import { FixtureText } from './FixtureText';
import styles from './FixtureBytes.module.css';
import type { ByteLineData, ByteSegment, FixtureScannerData, LanePiece } from './types';

export interface FixtureBytesProps {
  /** The lines of the fixture, each with one lane per scanner where a line is touched. */
  lines: ByteLineData[];
  /** The scanners in lane order, with the outcome word(s) shown beside the first touched line. */
  scanners: FixtureScannerData[];
  /** Names the region: "Fixture bytes and scanner redactions". */
  label?: string;
  /** Says what the secret bytes and envelope are; the parent formatted it. */
  caption: ReactNode;
  className?: string;
}

function Bytes({ segments }: { segments: ByteSegment[] }) {
  const empty = segments.every(s => s.text === '');
  return (
    <span className={styles.bytes}>
      {empty && <span className={styles.ws} title="empty">∅</span>}
      {segments.map((segment, i) => {
        let node: ReactNode = <FixtureText text={segment.text} withTitle />;
        // The secret sits inside the envelope so the underline runs unbroken beneath the highlight.
        if (segment.role === 'companion') node = <span className={styles.companion}>{node}</span>;
        if (segment.role === 'secret') node = <span className={styles.secret}>{node}</span>;
        if (segment.envelope) node = <span className={styles.envelope}>{node}</span>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </span>
  );
}

function Lane({ pieces, label }: { pieces: LanePiece[]; label: string }) {
  return (
    <span className={styles.lane} role="img" aria-label={label}>
      {pieces.map((piece, i) => (piece.shape
        ? <i key={i} className={styles[piece.shape]}><FixtureText text={piece.text} withTitle={false} /></i>
        : <Fragment key={i}><FixtureText text={piece.text} withTitle={false} /></Fragment>))}
    </span>
  );
}

/**
 * Exact fixture bytes, one source line at a time, with what each scanner covered
 * drawn under the line. A secret span is a green highlight (the only meaning green
 * has in data), an envelope is an underline. A finding is a solid bar, a partly
 * exposed secret a hatched bar and a missed one a dashed empty frame, so the shape
 * carries the outcome and colour never does. Whitespace is drawn as symbols; offsets
 * are UTF-8 bytes, [start, end). It scrolls inside its own region, never the page.
 */
export function FixtureBytes({ lines, scanners, label = 'Fixture bytes and scanner redactions', caption, className }: FixtureBytesProps) {
  const firstTouched = lines.findIndex(line => line.lanes.length > 0);
  return (
    <div className={cx(styles.wrap, className)}>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={label}>
        <div className={styles.grid}>
          {lines.map((line, index) => (
            <Fragment key={line.number}>
              <span className={cx(styles.label, styles.number)} aria-label={`Line ${line.number}`}>{line.number}</span>
              <Bytes segments={line.segments} />
              <span />
              {line.lanes.map((lane, i) => (
                <Fragment key={i}>
                  <span className={styles.label}>{scanners[i]?.name}</span>
                  <Lane pieces={lane.pieces} label={lane.label} />
                  <span className={styles.verdict}>
                    {index === firstTouched && scanners[i]?.verdict.map((v, j) => <StatusBadge key={j} status={v.status}>{v.label}</StatusBadge>)}
                  </span>
                </Fragment>
              ))}
              {line.lanes.length > 0 && <span className={styles.gap} />}
            </Fragment>
          ))}
        </div>
      </div>
      <p className={styles.caption}>{caption}</p>
      <ul className={styles.legend} aria-label="Legend">
        <li><span className={cx(styles.key, styles.keySecret)} />Secret bytes, must be redacted</li>
        <li><span className={cx(styles.key, styles.keyEnvelope)} />Envelope, may be redacted</li>
        <li><span className={cx(styles.key, styles.fill)} />Scanner redacted</li>
        <li><span className={cx(styles.key, styles.hatch)} />Partly exposed</li>
        <li><span className={cx(styles.key, styles.outline)} />Missed</li>
      </ul>
    </div>
  );
}
