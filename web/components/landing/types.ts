/** One line of a specimen: plain text, or text around the expected secret. */
export type SpecimenLine = string | { before: string; secret: string; after: string };

/** An illustrated input. Synthetic; the secret is assembled from parts and was never issued. */
export interface SpecimenExample {
  id: string;
  /** The choice's label: "Credential". */
  label: string;
  /** The file's name in the card header. */
  name: string;
  lines: SpecimenLine[];
  /** Byte range of the expected secret, as text: "bytes 48-141". */
  expected: string;
  /** What a redaction of exactly that range is called in the report: "Exact". */
  result: string;
  caption: string;
}

export interface Question {
  href: string;
  kicker: string;
  title: string;
  text: string;
  action: string;
}

export interface Rule { strong: string; rest: string }
