import { fetch as expoFetch } from 'expo/fetch';
import { runDiagnostic } from './diagnostic';
import { RequestClient } from './request';
import { S1Failure } from './types';
import { BUILD_AUDIENCE } from '../../config/build-audience';
import { sourceEligibility, SPACEBATTLES_ORIGIN } from '../registry';
import { SourceOperationFailure } from '../operations';

// One queue/cooldown across screens and repeated runs. No HTML is retained by this client.
export const sourceClient = new RequestClient(expoFetch);

export function runNativeDiagnostic(value: string, options?: Parameters<typeof runDiagnostic>[2]) {
  if (!__DEV__) throw new S1Failure('blocked', 'S1 diagnostics are development-only.');
  const eligibility = sourceEligibility(SPACEBATTLES_ORIGIN, 'diagnostic', BUILD_AUDIENCE);
  if (eligibility.status !== 'allowed') throw new SourceOperationFailure(eligibility);
  return runDiagnostic(value, sourceClient, options);
}
