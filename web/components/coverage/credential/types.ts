import type { PipelineStampProps } from '../../qualification/types';
export interface CredentialCoverageRow {
  id: string; name: string; href: string; description: string;
  declaration: string; qualification: string; qualificationHref?: string;
  format: string; context: string; research: string; sources: { href: string; label: string }[];
}
export interface CredentialCoverageData {
  release: string; configuration: string; binding: string; sourceRevision: string;
  counts: { label: string; value: string }[];
  providers: { id: string; name: string; href: string; rows: CredentialCoverageRow[] }[];
  scope: { title: string; statements: string[] }[];
  scopeSource: string; support: string; pipeline?: PipelineStampProps;
}
