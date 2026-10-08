import { createContext, useContext } from 'react';
import { Platform, useColorScheme } from 'react-native';
import type { AppStyle } from '../domain/types';

export const palettes = {
  light: {
    canvas: '#F7F4EE', surface: '#FFFFFF', surfaceSubtle: '#EEE9E0', textPrimary: '#1F2428',
    textSecondary: '#606970', accent: '#315E79', accentPressed: '#24485E', accentSoft: '#E5EEF3',
    border: '#D9D3C8', warning: '#9A5A12', success: '#3F6B55', destructive: '#B3261E', errorSurface: '#FBE9E7', onAccent: '#FFFFFF',
  },
  dark: {
    canvas: '#121416', surface: '#1B1E21', surfaceSubtle: '#24282C', textPrimary: '#F2F0EA',
    textSecondary: '#AEB6BD', accent: '#8DB9D2', accentPressed: '#AED2E5', accentSoft: '#223A47',
    border: '#343A3F', warning: '#E5AD62', success: '#83B79A', destructive: '#FF8A80', errorSurface: '#3A2222', onAccent: '#121416',
  },
} as const;

export const profiles = {
  classic: palettes,
  stowaway: {
    light: { ...palettes.light, canvas: '#F5F0E6', surface: '#FCF8F0', surfaceSubtle: '#EBE3D4', textPrimary: '#26313A',
      textSecondary: '#665E54', accent: '#795B2C', accentPressed: '#614721', accentSoft: '#E9DFC9', border: '#D8CEBC', onAccent: '#FCF8F0', warning: '#8B5110' },
    dark: { ...palettes.dark, canvas: '#171D24', surface: '#202933', surfaceSubtle: '#29333D', textPrimary: '#F4EBDD',
      textSecondary: '#BEB4A6', accent: '#D0AD72', accentPressed: '#E1C494', accentSoft: '#37352F', border: '#384048', onAccent: '#171D24' },
  },
};
// Storage owns persistence; this context only distributes the selected visual profile.
export const AppStyleContext = createContext<AppStyle>('stowaway');
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  const profile = useContext(AppStyleContext);
  return { ...profiles[profile][dark ? 'dark' : 'light'], dark, profile,
    displayFont: profile === 'stowaway' ? Platform.select({ ios: 'Georgia', default: 'serif' }) : undefined,
    cardRadius: profile === 'stowaway' ? 18 : 16, sectionGap: profile === 'stowaway' ? 28 : 24 };
}
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, inset: 20, section: 24, large: 32 };
