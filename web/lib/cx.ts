/** Join class names, skipping anything falsy. The only class helper primitives use. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
