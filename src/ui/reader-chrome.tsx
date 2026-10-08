import { useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Preferences } from '../domain/types';
import { AppText, Button, uiStyles } from './components';
import { useTheme } from './theme';

export function ReaderTopBar({ title, disabled, appearanceDisabled, onContents, onAppearance }: {
  title: string; disabled: boolean; appearanceDisabled: boolean; onContents(): void; onAppearance(): void;
}) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: 1, borderColor: theme.border }}>
    <Button label="Return to story contents" text="‹ Contents" variant="tertiary" disabled={disabled} onPress={onContents} />
    <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={1}
      style={{ flex: 1, minWidth: 60, color: theme.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
    <Button label="Reading appearance" text="Aa" variant="tertiary" disabled={appearanceDisabled} onPress={onAppearance} />
  </View>;
}
export function ReaderBottomBar({ position, previousDisabled, nextDisabled, onPrevious, onNext }: {
  position: string; previousDisabled: boolean; nextDisabled: boolean; onPrevious(): void; onNext(): void;
}) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4,
    padding: 4, borderTopWidth: 1, borderColor: theme.border }}>
    <Button label="Previous chapter" text="‹ Previous" variant="tertiary" disabled={previousDisabled} onPress={onPrevious} />
    <AppText tone="caption">{position}</AppText>
    <Button label="Next chapter" text="Next ›" variant="tertiary" disabled={nextDisabled} onPress={onNext} />
  </View>;
}
export function AppearanceSheet({ visible, preferences, disabled, onChange, onClose }: {
  visible: boolean; preferences: Preferences; disabled: boolean; onChange(value: Preferences): void; onClose(): void;
}) {
  const theme = useTheme();
  const heading = useRef<Text>(null);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={() => {
    const handle = findNodeHandle(heading.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
      <SafeAreaView accessibilityViewIsModal style={{ maxHeight: '90%', backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <Text ref={heading} accessibilityRole="header" style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '600' }}>Reading Appearance</Text>
          <AppText>Text Size</AppText>
          <View style={uiStyles.actions}>
            <Button label="Decrease reading font size" text="A−" disabled={disabled || preferences.fontSize <= 14}
              onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize - 2 })} />
            <Text accessibilityLabel={'Reading font size ' + preferences.fontSize} style={{ color: theme.textPrimary, fontSize: 20 }}>{preferences.fontSize}</Text>
            <Button label="Increase reading font size" text="A+" disabled={disabled || preferences.fontSize >= 32}
              onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize + 2 })} />
          </View>
          <AppText>Reader Theme</AppText><View style={uiStyles.actions}>
            {(['light', 'dark'] as const).map((value) => <Button key={value} label={'Use ' + value + ' reading theme'} text={value === 'light' ? 'Light' : 'Dark'}
              disabled={disabled} selected={preferences.theme === value} onPress={() => { if (preferences.theme !== value) onChange({ ...preferences, theme: value }); }} />)}
          </View>
          <Button label="Close reading appearance" text="Done" variant="primary" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
