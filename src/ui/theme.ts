import { useColorScheme } from 'react-native';

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

export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return { ...palettes[dark ? 'dark' : 'light'], dark };
}
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, inset: 20, section: 24, large: 32 };
