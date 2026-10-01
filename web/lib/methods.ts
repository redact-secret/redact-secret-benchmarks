/**
 * The six evaluation methods, in the order the engine runs them, and where each page lives.
 * Pure strings: the app, the resolvers and the blocks all name a method page through here.
 */
export const METHOD_IDS = ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'] as const;
export type MethodId = (typeof METHOD_IDS)[number];

export const isMethodId = (value: string): value is MethodId => (METHOD_IDS as readonly string[]).includes(value);

export const EVALUATION_HREF = '/evaluation/';
export const methodHref = (id: MethodId): string => `/evaluation/method/${id}/`;
