import { parseBuildAudience } from '../domain/source-capabilities';

// Expo statically inlines this exact reference in both development and release JS.
export const BUILD_AUDIENCE = parseBuildAudience(process.env.EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE);
