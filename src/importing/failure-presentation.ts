import type { S1Failure } from '../sources/spacebattles/types';
import type { ImportFailure } from './ownership';

/** Keep the typed detail, with a short product explanation of what failed. */
export function failureContext(failure: S1Failure | ImportFailure): string {
  switch (failure.code) {
    case 'blocked': case 'challenge': return 'Source access blocked. Requests stopped; do not retry around an access or login challenge.';
    case 'incomplete': return 'Incomplete primary index. The previous complete contents are retained; this is not a no-updates result.';
    case 'parser': case 'unsupported-structure': return 'Source content could not be parsed safely. Existing downloaded content is retained.';
    case 'network': case 'transient': return 'Network request failed. Earlier local commits are retained; retry deliberately when access is available.';
    case 'storage': return 'Local storage failed. Earlier successful commits are retained; check local storage and retry.';
    case 'busy': return 'Another story operation is settling. Wait for it to finish and retry.';
    case 'unsupported-url': return 'This source URL or stored story identity is not supported.';
    case 'cancelled': return 'Stopped at your request. Completed local commits are retained.';
  }
}
