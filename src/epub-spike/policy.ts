import { BUILD_AUDIENCE } from '../config/build-audience';
import { EpubFailure } from './limits';

export function diagnosticEligible(audience: unknown, flag: unknown): boolean {
  return audience === 'internal-personal' && flag === 'enabled';
}
// Exact static references are inlined by Expo. No __DEV__, settings, or remote unlock.
export const EPUB_DIAGNOSTIC_FLAG = process.env.EXPO_PUBLIC_STOWAWAY_EPUB_DIAGNOSTIC;
export function diagnosticAllowed() { return diagnosticEligible(BUILD_AUDIENCE, EPUB_DIAGNOSTIC_FLAG); }
export function requireDiagnostic() { if (!diagnosticAllowed()) throw new EpubFailure('policy'); }
