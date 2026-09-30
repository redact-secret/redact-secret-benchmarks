'use client';

import type { ReactNode } from 'react';
import MuiTab from '@mui/material/Tab';
import MuiTabs from '@mui/material/Tabs';
import { cx } from '../../lib/cx';
import styles from './Tabs.module.css';

export interface TabItem<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface TabsProps<V extends string> {
  items: TabItem<V>[];
  /** Controlled: the parent owns the selected tab. */
  value: V;
  onChange: (value: V) => void;
  /** Names the tab list. Required. */
  label: string;
  /** Prefix for ids so each tab and its TabPanel are linked. Unique per page. */
  idPrefix: string;
  className?: string;
}

const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

/**
 * Real ARIA tabs for content that swaps in place. MUI supplies `role="tablist"`,
 * roving tabindex and arrow-key navigation; the look is from the module. If the
 * "tabs" are pages, use SegmentedNav or SectionNav (links) instead.
 */
export function Tabs<V extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<V>) {
  return (
    <MuiTabs
      className={cx(styles.tabs, className)}
      value={value}
      onChange={(_, next: V) => onChange(next)}
      aria-label={label}
      variant="scrollable"
      scrollButtons={false}
      slotProps={{ indicator: { className: styles.indicator } }}
    >
      {items.map(item => (
        <MuiTab
          key={item.value}
          className={styles.tab}
          value={item.value}
          label={item.label}
          disabled={item.disabled}
          id={tabId(idPrefix, item.value)}
          aria-controls={panelId(idPrefix, item.value)}
        />
      ))}
    </MuiTabs>
  );
}

export interface TabPanelProps {
  /** This panel's tab value. */
  value: string;
  /** The currently selected value. Inactive panels render nothing. */
  selected: string;
  idPrefix: string;
  children: ReactNode;
  className?: string;
}

/** The content for one tab, linked to it by id. Only the selected panel renders. */
export function TabPanel({ value, selected, idPrefix, children, className }: TabPanelProps) {
  const active = value === selected;
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      hidden={!active}
      tabIndex={0}
      className={cx(styles.panel, className)}
    >
      {active && children}
    </div>
  );
}
