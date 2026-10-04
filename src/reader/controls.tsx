import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Preferences } from '../domain/types';

export function ReaderControls({ preferences, disabled, onChange }: {
  preferences: Preferences; disabled: boolean; onChange: (value: Preferences) => void;
}) {
  return <View style={styles.row}>
    <Control label="Decrease reading font size" text="A−" disabled={disabled || preferences.fontSize <= 14}
      onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize - 2 })} />
    <Text style={styles.label} accessibilityLabel={`Reading font size ${preferences.fontSize}`}>{preferences.fontSize}</Text>
    <Control label="Increase reading font size" text="A+" disabled={disabled || preferences.fontSize >= 32}
      onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize + 2 })} />
    <Control label={`Use ${preferences.theme === 'light' ? 'dark' : 'light'} reading theme`}
      text={preferences.theme === 'light' ? 'Dark' : 'Light'} disabled={disabled}
      onPress={() => onChange({ ...preferences, theme: preferences.theme === 'light' ? 'dark' : 'light' })} />
  </View>;
}

export function Control({ label, text, disabled = false, onPress }: {
  label: string; text: string; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{text}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  button: { backgroundColor: '#244d73', minHeight: 44, minWidth: 44, padding: 10, borderRadius: 5, justifyContent: 'center' },
  buttonText: { color: '#ffffff', textAlign: 'center', fontSize: 16 },
  label: { fontSize: 16, color: '#22252a' },
  disabled: { opacity: 0.4 },
});
