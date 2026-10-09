import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReaderFont } from '../domain/types';
import { READER_FONT_STACKS } from '../reader/appearance';
import { AppText } from './components';
import { useTheme } from './theme';

export const READING_FONT_LABELS: Record<ReaderFont, string> = {
  "baskerville": "Baskerville",
  "charter": "Charter",
  "cochin": "Cochin",
  "didot": "Didot",
  "georgia": "Georgia",
  "hoefler-text": "Hoefler Text",
  "palatino": "Palatino",
  "times": "Times New Roman",
  "serif": "System Serif",
  "avenir": "Avenir",
  "avenir-next": "Avenir Next",
  "futura": "Futura",
  "gill-sans": "Gill Sans",
  "helvetica-neue": "Helvetica Neue",
  "optima": "Optima",
  "sans": "System Sans",
  "american-typewriter": "American Typewriter",
  "courier-new": "Courier New",
  "menlo": "Menlo",
  "bradley-hand": "Bradley Hand",
  "chalkboard-se": "Chalkboard SE",
  "marker-felt": "Marker Felt",
  "noteworthy": "Noteworthy",
  "copperplate": "Copperplate",
  "papyrus": "Papyrus",
  "snell-roundhand": "Snell Roundhand",
};
// Named iOS system families, not downloaded assets or source-provided names.
// React Native's UIFont family path cannot request WebKit's ui-serif design.
const IOS_PREVIEWS: Partial<Record<ReaderFont, string>> = {
  "baskerville": "Baskerville",
  "charter": "Charter",
  "cochin": "Cochin",
  "didot": "Didot",
  "georgia": "Georgia",
  "hoefler-text": "Hoefler Text",
  "palatino": "Palatino",
  "times": "Times New Roman",
  "avenir": "Avenir",
  "avenir-next": "Avenir Next",
  "futura": "Futura",
  "gill-sans": "Gill Sans",
  "helvetica-neue": "Helvetica Neue",
  "optima": "Optima",
  "sans": "System",
  "american-typewriter": "American Typewriter",
  "courier-new": "Courier New",
  "menlo": "Menlo",
  "bradley-hand": "Bradley Hand",
  "chalkboard-se": "Chalkboard SE",
  "marker-felt": "Marker Felt",
  "noteworthy": "Noteworthy",
  "copperplate": "Copperplate",
  "papyrus": "Papyrus",
  "snell-roundhand": "Snell Roundhand",
};
function previewFamily(font: ReaderFont): string | undefined {
  return Platform.OS === 'ios' ? IOS_PREVIEWS[font] : Platform.OS === 'web' ? READER_FONT_STACKS[font] : undefined;
}
export const READING_FONT_GROUPS: { title: string; fonts: readonly ReaderFont[] }[] = [
  { title: "Bookish Serif", fonts: ["baskerville", "charter", "cochin", "didot", "georgia", "hoefler-text", "palatino", "times", "serif"] },
  { title: "Sans Serif", fonts: ["avenir", "avenir-next", "futura", "gill-sans", "helvetica-neue", "optima", "sans"] },
  { title: "Typewriter & Mono", fonts: ["american-typewriter", "courier-new", "menlo"] },
  { title: "Handwritten", fonts: ["bradley-hand", "chalkboard-se", "marker-felt", "noteworthy"] },
  { title: "Character & Decorative", fonts: ["copperplate", "papyrus", "snell-roundhand"] },
];

export function CurrentReadingFont({ font, disabled, onPress }: { font: ReaderFont; disabled: boolean; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel="Reading font" accessibilityValue={{ text: READING_FONT_LABELS[font] }}
    accessibilityHint="Choose a reading font" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.current, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceSubtle : theme.surface, opacity: disabled ? .5 : 1 }]}>
    <Text style={{ flex: 1, color: theme.textPrimary, fontSize: 17, fontFamily: previewFamily(font) }}>{READING_FONT_LABELS[font]}</Text>
    <Text accessible={false} style={{ color: theme.textSecondary, fontSize: 20 }}>›</Text>
  </Pressable>;
}

export function ReadingFontList({ font, disabled, onSelect }: { font: ReaderFont; disabled: boolean; onSelect(value: ReaderFont): void }) {
  const theme = useTheme();
  return <View style={{ gap: 20 }}>{READING_FONT_GROUPS.map((group) => <View key={group.title}>
    <Text accessibilityRole="header" style={{ color: theme.textSecondary, fontSize: 16 }}>{group.title}</Text>
    {group.fonts.map((value) => {
      const family = previewFamily(value);
      return <Pressable key={value} accessibilityRole="button" accessibilityLabel={'Use ' + READING_FONT_LABELS[value] + ' reading font'}
        accessibilityHint={!family ? 'Preview this font in the reader' : undefined}
        accessibilityState={{ selected: font === value, disabled }} disabled={disabled}
        onPress={() => { if (value !== font) onSelect(value); }}
        style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceSubtle : undefined, opacity: disabled ? .5 : 1 }]}>
        <Text accessible={false} style={{ minWidth: 24, flexShrink: 0, color: theme.accent, fontSize: 17 }}>{font === value ? '✓' : ''}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontFamily: family }}>{READING_FONT_LABELS[value]}</Text>
          {!family && <AppText tone="caption">Preview in reader</AppText>}
        </View>
      </Pressable>;
    })}
  </View>)}</View>;
}

const styles = StyleSheet.create({
  current: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  row: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
