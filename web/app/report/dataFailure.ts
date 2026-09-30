import type { LoadFailure } from '../../lib/build-data';

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export interface FailureText {
  title: string;
  detail: string;
  /** The button: ask again, or reload when the file and the page come from different builds (asking again cannot fix that). */
  retryLabel: string;
  reload: boolean;
}

/** The words for a failed load, by cause. `what` is what did not arrive ("the rest of the rows"); `still` is what still works. */
export function failureText(failure: LoadFailure | undefined, what: string, still: string): FailureText {
  if (failure === 'offline') return { title: 'You are offline', detail: `${sentence(what)} will load when the connection is back, or try again now. ${still}`, retryLabel: 'Try again', reload: false };
  if (failure === 'invalid') return { title: `Could not use ${what}`, detail: `The file is not from the same build as this page, which happens when the site was updated while it was open. Reload to get both from the same build. ${still}`, retryLabel: 'Reload the page', reload: true };
  return { title: `Could not load ${what}`, detail: `The file did not arrive. ${still}`, retryLabel: 'Try again', reload: false };
}
