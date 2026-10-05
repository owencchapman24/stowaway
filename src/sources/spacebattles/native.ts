import { fetch as expoFetch } from 'expo/fetch';
import { runDiagnostic } from './diagnostic';
import { RequestClient } from './request';
import { S1Failure } from './types';

// One queue/cooldown across screens and repeated runs. No HTML is retained by this client.
export const sourceClient = new RequestClient(expoFetch);

export function runNativeDiagnostic(value: string, options?: Parameters<typeof runDiagnostic>[2]) {
  if (!__DEV__) throw new S1Failure('blocked', 'S1 diagnostics are development-only.');
  return runDiagnostic(value, sourceClient, options);
}
