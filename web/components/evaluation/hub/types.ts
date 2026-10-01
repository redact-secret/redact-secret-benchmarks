/** A page the hub points to besides the methods. Without `href` the page is not in this build yet. */
export interface HubPhase {
  href?: string;
  label: string;
  title: string;
  description: string;
  /** "Open the scanner page →", or "Not in this build yet". */
  action: string;
}

export interface HubMethod {
  id: string;
  href: string;
  name: string;
  question: string;
  /** What the method has to read, as a count with its noun: "1,391 pairs". Absent when no run was published. */
  fact?: string;
}

export interface HubScanner {
  id: string;
  name: string;
  version: string;
  /** The ledger's mode line, as recorded: "Published npm package · default detectors". */
  mode: string;
  /** "Fresh, 2026-10-01" or "Snapshot, 2026-09-28". */
  observed: string;
  status: 'complete' | 'unavailable' | 'unsupported' | 'error' | 'unstable';
}

export type HubRunData =
  | { state: 'recorded'; title: string; description: string; scanners: HubScanner[] }
  | { state: 'not-measured'; title: string; description: string; reason: string; command: string };

export interface HubPrinciple { title: string; text: string }
