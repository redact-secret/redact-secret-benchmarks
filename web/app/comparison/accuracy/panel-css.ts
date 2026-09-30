/**
 * The rules that show exactly one panel: the one whose `data-key` equals the root's
 * `data-acc-key`. One rule per panel key, so a new scanner in the run needs no stylesheet edit.
 * Panel keys are built from ids and levels (`credentials.gitleaks.T1.all.0`), never from free text.
 */
export function panelCss(keys: string[]): string {
  const safe = keys.filter(key => /^[a-z0-9.-]+$/i.test(key));
  return [
    ":root[data-acc-key] [data-acc-panel][data-default]{display:none}",
    ...safe.map(key => `:root[data-acc-key='${key}'] [data-acc-panel][data-key='${key}']{display:block}`),
  ].join('\n');
}
