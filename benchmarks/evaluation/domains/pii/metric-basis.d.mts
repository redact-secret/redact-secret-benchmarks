export interface PiiQuantityDefinition { name: string; population: string; numerator: string; denominator: string; sensitiveOnly?: boolean; method?: string; unit?: string; note?: string; coercesNotEstablished?: boolean }
export interface PiiQuantity extends PiiQuantityDefinition { quantity: string; protocol: 'pii-v1' | 'b11'; id: string; owner: string }
export const PII_PROTOCOLS: Readonly<Record<'pii-v1' | 'b11', { owner: string; contract: string }>>;
export const PII_V1_QUANTITIES: Readonly<Record<string, PiiQuantityDefinition>>;
export const B11_QUANTITIES: Readonly<Record<string, PiiQuantityDefinition>>;
export const PII_QUANTITIES: Readonly<Record<'pii-v1' | 'b11', Readonly<Record<string, PiiQuantityDefinition>>>>;
export function quantityId(protocol: string, id: string): string;
export function quantityOf(protocol: 'pii-v1' | 'b11', id: string): PiiQuantity;
export function ambiguousIds(): string[];
