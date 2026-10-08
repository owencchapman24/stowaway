import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStyle } from '../domain/types';
import { AppText, Button, InlineBanner, uiStyles } from './components';
import { useTheme } from './theme';

export function AppearanceModal({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose(): void; children: ReactNode;
}) {
  const theme = useTheme();
  const heading = useRef<Text>(null);
  const focusHeading = useCallback(() => {
    const handle = findNodeHandle(heading.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);
  useEffect(() => { if (visible) focusHeading(); }, [visible, title, focusHeading]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} onShow={focusHeading}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' }}>
      <SafeAreaView accessibilityViewIsModal onAccessibilityEscape={onClose} style={{ maxHeight: '90%', backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <ScrollView key={title} contentContainerStyle={{ padding: 20, gap: 20 }}>
          <Text ref={heading} accessibilityRole="header" style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '600' }}>{title}</Text>
          {children}
          <Button label={'Close ' + title.toLowerCase()} text="Done" variant="primary" onPress={onClose} />
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
