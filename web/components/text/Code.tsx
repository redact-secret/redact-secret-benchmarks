import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Code.module.css';

export interface CodeProps {
  children: ReactNode;
  className?: string;
}

/** Inline monospace text: ids, versions, file paths, commands in a sentence. */
export function Code({ children, className }: CodeProps) {
  return <code className={cx(styles.code, className)}>{children}</code>;
}

export interface CodeBlockProps {
  /** Plain text. Rendered verbatim; never markup. */
  children: string;
  /** `command` is an inverse block for something to run; `snippet` is a bordered excerpt. */
  variant?: 'command' | 'snippet';
  /** Names the scrollable region for assistive tech. */
  label: string;
  className?: string;
}

/** A preformatted block. It scrolls inside its own box and is keyboard focusable. */
export function CodeBlock({ children, variant = 'command', label, className }: CodeBlockProps) {
  return (
    <pre className={cx(styles.block, variant === 'command' ? styles.command : styles.snippet, className)} tabIndex={0} aria-label={label}>
      <code>{children}</code>
    </pre>
  );
}
