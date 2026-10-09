import { useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import type { AppStyle } from '../domain/types';
import { AppText, Button, InlineBanner, uiStyles } from './components';
import { useTheme } from './theme';

export function AppearanceModal({ visible, title, onClose, children, dismissOnBackdrop = false, readerSheet = false }: {
  visible: boolean; title: string; onClose(): void; children: ReactNode; dismissOnBackdrop?: boolean; readerSheet?: boolean;
}) {
  const theme = useTheme();
  const { height, fontScale } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const bottom = insets?.bottom ?? 0;
  const usableHeight = Math.max(0, height - (insets?.top ?? 0) - bottom);
  // Fit short content naturally; long lists use half the safe height at normal
  // text size. Accessibility sizes can use more room without covering everything.
  const sheetLimit = usableHeight * Math.min(.75, .5 * Math.max(1, fontScale)) + bottom;
  const heading = useRef<Text>(null);
  const focusHeading = useCallback(() => {
    const handle = findNodeHandle(heading.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);
  useEffect(() => { if (visible) focusHeading(); }, [visible, title, focusHeading]);
  const headingText = <Text ref={heading} accessibilityRole="header"
    style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '600', ...(readerSheet ? { flex: 1 } : {}) }}>{title}</Text>;
  const done = <Button label={'Close ' + title.toLowerCase()} text="Done" variant={readerSheet ? 'tertiary' : 'primary'} onPress={onClose} />;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={focusHeading}>
    <View testID="appearance-overlay" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: readerSheet ? '#00000026' : '#00000066' }}>
      {dismissOnBackdrop && <Pressable testID="appearance-backdrop" accessible={false} importantForAccessibility="no" focusable={false}
        style={StyleSheet.absoluteFill} onPress={onClose} />}
      <SafeAreaView testID="appearance-panel" accessibilityViewIsModal onAccessibilityEscape={onClose}
        edges={readerSheet ? ['bottom', 'left', 'right'] : undefined}
        style={{ maxHeight: readerSheet ? sheetLimit : '90%', backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        {readerSheet && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 }}>
          {headingText}{done}
        </View>}
        <ScrollView key={title} style={readerSheet ? { flexShrink: 1 } : undefined} contentContainerStyle={{ padding: 20, gap: 20 }}>
          {!readerSheet && headingText}
          {children}
          {!readerSheet && done}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

export function AppStyleSheet({ visible, value, saving, error, onChange, onClose }: {
  visible: boolean; value: AppStyle; saving: boolean; error: string | null; onChange(value: AppStyle): void; onClose(): void;
}) {
  return <AppearanceModal visible={visible} title="App Style" onClose={onClose}>
    <AppText tone="secondary">For your library and controls. Reading appearance is separate.</AppText>
    <View style={uiStyles.actions}>{(['stowaway', 'classic'] as const).map((style) =>
      <Button key={style} label={'Use ' + (style === 'stowaway' ? 'Stowaway' : 'Classic') + ' app style'}
        text={style === 'stowaway' ? 'Stowaway' : 'Classic'} selected={value === style} disabled={saving}
        onPress={() => { if (style !== value) onChange(style); }} />)}</View>
    {error && <InlineBanner tone="error" message={error} />}
  </AppearanceModal>;
}
