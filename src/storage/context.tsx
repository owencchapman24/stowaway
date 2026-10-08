import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_PREFERENCES, type Preferences } from '../domain/types';
import { Control } from '../reader/controls';
import { useTheme } from '../ui/theme';
import { openStorage } from './native';
import type { Repository } from './repository';

interface StorageContext {
  repository: Repository;
  preferences: Preferences;
  changePreferences: (value: Preferences) => Promise<void>;
  imageWarning: string | null;
}
const Context = createContext<StorageContext | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof openStorage>> | null>(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    openStorage().then(async (result) => {
      const prefs = await result.repository.getPreferences();
      if (active) { setPreferences(prefs); setStorage(result); }
    }).catch(() => { if (active) setError('Local storage could not open. Your data has not been reset.'); });
    return () => { active = false; };
  }, [attempt]);
  if (!storage) return <View style={[styles.status, { backgroundColor: theme.canvas }]}>
    {error ? <><Text style={{ color: theme.textPrimary }} accessibilityRole="alert">{error}</Text><Control label="Retry opening local storage" text="Retry" onPress={() => { setError(null); setAttempt(attempt + 1); }} /></>
      : <><ActivityIndicator color={theme.accent} /><Text style={{ color: theme.textPrimary }}>Opening local library…</Text></>}
  </View>;
  return <Context.Provider value={{ ...storage, preferences, changePreferences: async (value) => {
    await storage.repository.savePreferences(value);
    setPreferences(value);
  } }}>{children}</Context.Provider>;
}

export function useStorage(): StorageContext {
  const storage = useContext(Context);
  if (!storage) throw new Error('Storage must initialize before opening a screen.');
  return storage;
}

const styles = StyleSheet.create({ status: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 } });
