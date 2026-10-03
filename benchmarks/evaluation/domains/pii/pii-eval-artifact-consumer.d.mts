export function loadPins(text: string): any;
export function consume(pins: any, artifacts: Array<{ name: string; text: string }>): any;
export function parseStrictJson(text: string): any;
export function semanticDigest(document: any): string;
export function verifyArtifact(document: any, pins: any): { pin?: any; reasons: Array<{ code: string; field?: string }> };
