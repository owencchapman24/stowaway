import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { ContinueReadingTarget, StoryContentsEntry, StorySummary } from '../domain/types';
import { useTheme } from './theme';

export function AppScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvas }}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />{children}
  </SafeAreaView>;
}
export function AppText({ children, tone = 'body', style }: {
  children: ReactNode; tone?: 'body' | 'secondary' | 'caption'; style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return <Text style={[typeStyles[tone], { color: tone === 'body' ? theme.textPrimary : theme.textSecondary }, style]}>{children}</Text>;
}
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export function Button({ label, text, disabled = false, variant = 'secondary', onPress, selected }: {
  label: string; text: string; disabled?: boolean; variant?: ButtonVariant; onPress: () => void; selected?: boolean;
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [uiStyles.button, {
      backgroundColor: variant === 'primary' ? (pressed ? theme.accentPressed : theme.accent)
        : pressed || selected ? theme.accentSoft : variant === 'secondary' ? theme.surfaceSubtle : 'transparent',
      borderColor: variant === 'destructive' ? theme.destructive : 'transparent', borderWidth: 1, opacity: disabled ? .45 : 1,
    }]}><Text style={[typeStyles.body, { fontWeight: '600', textAlign: 'center', color: variant === 'primary' ? theme.onAccent
      : variant === 'destructive' ? theme.destructive : theme.accent }]}>{selected ? '✓ ' : ''}{text}</Text></Pressable>;
}
export function ScreenHeader({ title, large = false, back, action }: {
  title: string; large?: boolean; back?: ReactNode; action?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={{ gap: 12 }}>{back && <View style={{ alignItems: 'flex-start' }}>{back}</View>}
    <View style={uiStyles.header}><Text accessibilityRole="header" style={{ flex: 1, color: theme.textPrimary,
      fontSize: large ? 34 : 28, fontWeight: '700' }}>{title}</Text>{action}</View>
  </View>;
}
export function SectionHeader({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 12 }}>{children}</Text>;
}
export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[uiStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}
export function InlineBanner({ title, message, tone = 'info', children }: {
  title?: string; message?: string; tone?: 'info' | 'success' | 'warning' | 'error'; children?: ReactNode;
}) {
  const theme = useTheme();
  const color = tone === 'error' ? theme.destructive : tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : theme.textPrimary;
  return <View style={[uiStyles.banner, { backgroundColor: tone === 'error' ? theme.errorSurface : theme.surfaceSubtle, borderLeftColor: color }]}>
    <View accessible accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ gap: 6 }}>
    {title && <Text style={[typeStyles.secondary, { color, fontWeight: '600' }]}>{title}</Text>}
    {message && <AppText tone="secondary">{message}</AppText>}</View>{children}
  </View>;
}
export function LoadingState({ text }: { text: string }) {
  const theme = useTheme();
  return <View style={uiStyles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.accent} /><AppText tone="secondary">{text}</AppText></View>;
}
export function OperationPanel({ title, message, completed, total, cancelLabel, onCancel }: {
  title: string; message: string; completed?: number; total?: number; cancelLabel: string; onCancel(): void;
}) {
  const theme = useTheme();
  const fraction = total && completed !== undefined ? Math.max(0, Math.min(1, completed / total)) : null;
  return <Card><View accessibilityLiveRegion="polite"><AppText>{title}</AppText><AppText tone="secondary">{message}</AppText></View>
    {fraction === null ? <ActivityIndicator color={theme.accent} /> : <View accessibilityRole="progressbar"
      accessibilityLabel={title} accessibilityValue={{ min: 0, max: total, now: completed }}
      style={{ height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' }}>
      <View style={{ height: 4, width: `${fraction * 100}%`, backgroundColor: theme.accent }} />
    </View>}
    <Button label={cancelLabel} text="Cancel" variant="tertiary" onPress={onCancel} />
  </Card>;
}
export function storySummary(story: Pick<StorySummary, 'downloaded' | 'total' | 'unread'>) {
  return `${story.downloaded < story.total ? `${story.downloaded} of ${story.total} downloaded` : `${story.total} chapters`} · ${story.unread ? `${story.unread} unread` : 'All read'}`;
}
export function StoryRow({ story, onPress }: { story: StorySummary; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${story.title}`}
    accessibilityValue={{ text: [story.author, storySummary(story)].filter(Boolean).join('. ') }} onPress={onPress}
    style={({ pressed }) => [uiStyles.listRow, { backgroundColor: pressed ? theme.accentSoft : theme.surface, borderColor: theme.border }]}>
    <View style={uiStyles.flex}><Text style={[typeStyles.rowTitle, { color: theme.textPrimary }]}>{story.title}</Text>
      {story.author && <AppText tone="secondary">{story.author}</AppText>}<AppText tone="secondary">{storySummary(story)}</AppText></View>
    <Text accessible={false} style={{ color: theme.textSecondary, fontSize: 24 }}>›</Text>
  </Pressable>;
}
export function ContinueReadingCard({ target, disabled = false, onPress }: { target: ContinueReadingTarget; disabled?: boolean; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Continue Reading: ${target.storyTitle}, ${target.chapterTitle}${target.currentlyListed ? '' : ', Saved chapter no longer listed'}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [uiStyles.card, { backgroundColor: pressed ? theme.surfaceSubtle : theme.accentSoft, borderColor: theme.border, opacity: disabled ? .45 : 1 }]}>
    <Text style={[typeStyles.rowTitle, { color: theme.textPrimary }]}>{target.storyTitle}</Text>
    <AppText tone="secondary">{target.chapterTitle}</AppText>
    {!target.currentlyListed && <AppText tone="caption">Saved chapter no longer listed</AppText>}
    <Text style={[typeStyles.body, { color: theme.accent, fontWeight: '600' }]}>Continue Reading ›</Text>
  </Pressable>;
}
export function ChapterRow({ entry, saved = false, disabled, readingDisabled = false, onOpen, onToggle }: {
  entry: StoryContentsEntry; saved?: boolean; disabled: boolean; readingDisabled?: boolean; onOpen(): void; onToggle(): void;
}) {
  const theme = useTheme();
  const state = `${entry.isRead ? 'Read' : 'Unread'} · ${entry.downloaded ? 'Downloaded' : 'Not downloaded'}`;
  return <View style={[uiStyles.chapter, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Read ${entry.title}`}
      accessibilityValue={{ text: `${saved ? 'Saved chapter no longer listed' : 'Chapter ' + (entry.position + 1)}. ${state}` }}
      accessibilityState={{ disabled: disabled || readingDisabled || !entry.downloaded }} disabled={disabled || readingDisabled || !entry.downloaded} onPress={onOpen}
      style={({ pressed }) => [uiStyles.chapterTarget, { backgroundColor: pressed ? theme.accentSoft : 'transparent', opacity: disabled ? .55 : 1 }]}>
      <Text style={[typeStyles.rowTitle, { color: theme.textPrimary }]}>{saved ? entry.title : `${entry.position + 1}. ${entry.title}`}</Text>
      <AppText tone="caption">{state}</AppText>
    </Pressable>
    <Button label={`Mark ${entry.title} as ${entry.isRead ? 'unread' : 'read'}`} text={entry.isRead ? '✓ Read' : '○ Unread'}
      variant="tertiary" disabled={disabled} onPress={onToggle} />
  </View>;
}
export const uiStyles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 0 },
  section: { gap: 12, marginBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { minWidth: 44, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', flexShrink: 1 },
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: 1 },
  banner: { padding: 12, gap: 6, borderRadius: 10, borderLeftWidth: 3 },
  loading: { padding: 12, gap: 8, alignItems: 'center' },
  listRow: { minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, gap: 4 },
  chapter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingRight: 4 },
  chapterTarget: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minHeight: 56, minWidth: 44, padding: 12, gap: 4 },
});
const typeStyles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 24 }, secondary: { fontSize: 15, lineHeight: 20 }, caption: { fontSize: 13, lineHeight: 18 }, rowTitle: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
});
