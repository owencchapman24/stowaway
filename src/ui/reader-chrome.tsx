import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { normalizePreferences } from '../domain/preferences';
import { AppearanceModal } from './appearance-modal';
import { CurrentReadingFont, ReadingFontList } from './reading-fonts';
import type { Preferences } from '../domain/types';
import { AppText, Button, uiStyles } from './components';
import { useTheme } from './theme';

export function ReaderTopBar({ title, disabled, appearanceDisabled, onContents, onAppearance }: {
  title: string; disabled: boolean; appearanceDisabled: boolean; onContents(): void; onAppearance(): void;
}) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
    <Button label="Return to story contents" text="‹ Contents" variant="tertiary" quiet disabled={disabled} onPress={onContents} />
    <Text accessibilityRole="header" accessibilityLabel={title} numberOfLines={1}
      style={{ flex: 1, minWidth: 60, color: theme.textPrimary, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>{title}</Text>
    <Button label="Reading appearance" text="Aa" variant="tertiary" quiet disabled={appearanceDisabled} onPress={onAppearance} />
  </View>;
}
export function ReaderBottomBar({ position, previousDisabled, nextDisabled, onPrevious, onNext }: {
  position: string; previousDisabled: boolean; nextDisabled: boolean; onPrevious(): void; onNext(): void;
}) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 4,
    padding: 4, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}>
    <Button label="Previous chapter" text="‹ Previous" variant="tertiary" quiet disabled={previousDisabled} onPress={onPrevious} />
    <AppText tone="caption">{position}</AppText>
    <Button label="Next chapter" text="Next ›" variant="tertiary" quiet disabled={nextDisabled} onPress={onNext} />
  </View>;
}
export function AppearanceSheet({ visible, preferences, disabled, onChange, onClose }: {
  visible: boolean; preferences: Preferences; disabled: boolean; onChange(value: Preferences): void; onClose(): void;
}) {

  const theme = useTheme();
  const [pickingFont, setPickingFont] = useState(false);
  if (!visible && pickingFont) setPickingFont(false);
  const font = normalizePreferences(preferences).font;
  return <AppearanceModal visible={visible} dismissOnBackdrop readerSheet title={pickingFont ? 'Reading Font' : 'Reading Appearance'}
    onClose={pickingFont ? () => setPickingFont(false) : onClose}>
    {pickingFont ? <ReadingFontList font={font} disabled={disabled} onSelect={(value) => onChange({ ...preferences, font: value })} /> : <>
          <AppText>Font</AppText>
          <CurrentReadingFont font={font} disabled={disabled} onPress={() => setPickingFont(true)} />
          <AppText>Text Size</AppText>
          <View style={uiStyles.actions}>
            <Button label="Decrease reading font size" text="A−" disabled={disabled || preferences.fontSize <= 14}
              onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize - 2 })} />
            <Text accessibilityLabel={'Reading font size ' + preferences.fontSize} style={{ color: theme.textPrimary, fontSize: 20 }}>{preferences.fontSize}</Text>
            <Button label="Increase reading font size" text="A+" disabled={disabled || preferences.fontSize >= 32}
              onPress={() => onChange({ ...preferences, fontSize: preferences.fontSize + 2 })} />
          </View>
          <AppText>Theme</AppText><View style={uiStyles.actions}>
            {(['light', 'paper', 'dark'] as const).map((value) => <Button key={value} label={'Use ' + value + ' reading theme'} text={value.charAt(0).toUpperCase() + value.slice(1)}
              disabled={disabled} selected={preferences.theme === value} onPress={() => { if (preferences.theme !== value) onChange({ ...preferences, theme: value }); }} />)}
          </View>
    </>}
  </AppearanceModal>;
}
