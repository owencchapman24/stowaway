import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_PREFERENCES, type Preferences, type AppStyle } from '../domain/types';
import { Control } from '../reader/controls';
import { normalizePreferences } from '../domain/preferences';
import { AppStyleContext, useTheme } from '../ui/theme';
import { openStorage } from './native';
import type { Repository } from './repository';

interface StorageContext {
  repository: Repository;
  preferences: Preferences;
  appStyle: AppStyle;
  changeAppStyle: (value: AppStyle) => Promise<void>;
  changePreferences: (value: Preferences) => Promise<void>;
  imageWarning: string | null;
}
const Context = createContext<StorageContext | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof openStorage>> | null>(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [appStyle, setAppStyle] = useState<AppStyle>('stowaway');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    openStorage().then(async (result) => {
      const [prefs, style] = await Promise.all([result.repository.getPreferences(), result.repository.getAppStyle()]);
      if (active) { setPreferences(prefs); setAppStyle(style); setStorage(result); }
    }).catch(() => { if (active) setError('Local storage could not open. Your data has not been reset.'); });
    return () => { active = false; };
  }, [attempt]);
  if (!storage) return <View style={[styles.status, { backgroundColor: theme.canvas }]}>
    {error ? <><Text style={{ color: theme.textPrimary }} accessibilityRole="alert">{error}</Text><Control label="Retry opening local storage" text="Retry" onPress={() => { setError(null); setAttempt(attempt + 1); }} /></>
      : <><ActivityIndicator color={theme.accent} /><Text style={{ color: theme.textPrimary }}>Opening local library…</Text></>}
  </View>;
  return <AppStyleContext.Provider value={appStyle}><Context.Provider value={{ ...storage, preferences, appStyle,
    changeAppStyle: async (value) => {
      try { await storage.repository.saveAppStyle(value); }
      catch (error) {
        // A driver may reject after COMMIT. Keep the caller's write gate held
        // until the persisted choice is known; never assume rejection rolled back.
        const saved = await storage.repository.getAppStyle();
        setAppStyle(saved);
        if (saved !== value) throw error;
        return;
      }
      setAppStyle(value);
    }, changePreferences: async (value) => {
      const next = normalizePreferences(value);
      try { await storage.repository.savePreferences(next); }
      catch (error) {
        // Rejection alone cannot distinguish rollback from COMMIT-then-reject.
        // Resolve only after readback confirms every requested reading setting,
        // so the caller can apply its existing restyle without losing the gate.
        const saved = await storage.repository.getPreferences();
        setPreferences(saved);
        if (saved.font !== next.font || saved.fontSize !== next.fontSize || saved.theme !== next.theme) throw error;
        return;
      }
      setPreferences(next);
    } }}>{children}</Context.Provider></AppStyleContext.Provider>;
}

export function useStorage(): StorageContext {
  const storage = useContext(Context);
  if (!storage) throw new Error('Storage must initialize before opening a screen.');
  return storage;
}

const styles = StyleSheet.create({ status: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 } });
