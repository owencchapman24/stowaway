
import * as Native from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Button, ChapterRow, InlineBanner, StoryRow, storySummary } from '../src/ui/components';
import { AppearanceSheet, ReaderBottomBar, ReaderTopBar } from '../src/ui/reader-chrome';
import { AppStyleContext, profiles } from '../src/ui/theme';
import { READER_FONTS } from '../src/domain/preferences';
import { READING_FONT_GROUPS, READING_FONT_LABELS } from '../src/ui/reading-fonts';
import { AppStyleSheet } from '../src/ui/appearance-modal';
import { expectedReadingFonts, FONT_AVAILABILITY_SOURCES } from './fixtures/reader-fonts';

const entry = { id: 'spacebattles:thread:1:post:2', postId: '2', title: 'A very long chapter title that should wrap naturally at larger text sizes',
  position: 13, sourceUrl: '', downloaded: true, isRead: false };
const story = { id: 'spacebattles:thread:1', source: 'spacebattles' as const, threadId: '1', title: entry.title, author: 'Synthetic author',
  sourceUrl: '', categoryId: '9', total: 38, downloaded: 4, unread: 34, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
afterEach(() => jest.restoreAllMocks());

test('font catalog and categories uniquely cover the reviewed platform allowlist', () => {
  const keys = expectedReadingFonts.map((font) => font.key);
  expect(keys).toHaveLength(26); expect(new Set(keys).size).toBe(26);
  expect([...READER_FONTS].sort()).toEqual([...keys].sort());
  const grouped = READING_FONT_GROUPS.flatMap((group) => group.fonts.map((key) => ({ key, group: group.title })));
  expect(grouped).toEqual(expectedReadingFonts.map(({ key, group }) => ({ key, group })));
  expect(new Set(grouped.map((font) => font.key)).size).toBe(26);
  expect(new Set(READING_FONT_GROUPS.map((group) => group.title)).size).toBe(5);
  for (const font of expectedReadingFonts) {
    expect(READING_FONT_LABELS[font.key]).toBe(font.name);
    expect(font.platformFace.length).toBeGreaterThan(0);
    expect(FONT_AVAILABILITY_SOURCES[font.evidence]).toMatch(/^https:\/\/(developer\.apple\.com|webkit\.org)\//);
    if (font.key !== 'serif' && font.key !== 'sans') expect(font.evidence).toBe('apple');
  }
});

test.each(READER_FONTS)('the %s reader font exposes selected state and keeps a full target', (font) => {
  const change = jest.fn(); render(<AppearanceSheet visible preferences={{ theme: 'paper', fontSize: 20, font }} disabled={false} onChange={change} onClose={() => {}} />);
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: READING_FONT_LABELS[font] });
  fireEvent.press(screen.getByLabelText('Reading font'));
  const row = screen.getByLabelText('Use ' + READING_FONT_LABELS[font] + ' reading font');
  expect(within(row).getByText('✓')).toBeTruthy();
  expect(row.props.accessibilityState.selected).toBe(true);
  expect(row).toHaveStyle({ minWidth: 44, minHeight: 44 });
  fireEvent.press(row); expect(change).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close reading font'));
  fireEvent.press(screen.getByLabelText('Use paper reading theme')); expect(change).not.toHaveBeenCalled();
  expect(screen.getByText('✓ Paper')).toBeTruthy();
});

test('one current-font row opens a grouped picker within one modal and selection follows persisted props', () => {
  const change = jest.fn(), close = jest.fn();
  const props = { visible: true, preferences: { theme: 'paper' as const, fontSize: 24, font: 'georgia' as const }, disabled: false, onChange: change, onClose: close };
  const view = render(<AppearanceSheet {...props} />);
  expect(screen.queryByLabelText(/Use .* reading font/)).toBeNull();
  expect(screen.getByLabelText('Reading font')).toHaveStyle({ minHeight: 44, minWidth: 44 });
  fireEvent.press(screen.getByLabelText('Reading font'));
  expect(screen.UNSAFE_getAllByType(Native.Modal)).toHaveLength(1);
  expect(screen.getByRole('header', { name: 'Reading Font' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Bookish Serif' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Sans Serif' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Typewriter & Mono' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Handwritten' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Character & Decorative' })).toBeTruthy();
  expect(screen.queryByLabelText('Increase reading font size')).toBeNull();
  const names = expectedReadingFonts.map((font) => font.name);
  for (const name of names) expect(screen.getByLabelText('Use ' + name + ' reading font')).toBeTruthy();
  expect(screen.getAllByLabelText(/Use .* reading font/)).toHaveLength(26);
  fireEvent.press(screen.getByLabelText('Use Avenir Next reading font'));
  expect(change).toHaveBeenLastCalledWith({ theme: 'paper', fontSize: 24, font: 'avenir-next' });
  expect(screen.getByLabelText('Use Georgia reading font').props.accessibilityState.selected).toBe(true);
  view.rerender(<AppearanceSheet {...props} preferences={{ ...props.preferences, font: 'avenir-next' }} disabled />);
  expect(within(screen.getByLabelText('Use Avenir Next reading font')).getByText('✓')).toBeTruthy();
  expect(screen.getByLabelText('Use Baskerville reading font')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Use Baskerville reading font')); expect(change).toHaveBeenCalledTimes(1);
  fireEvent(screen.UNSAFE_getByType(Native.Modal), 'requestClose');
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: 'Avenir Next' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close reading appearance')); expect(close).toHaveBeenCalledTimes(1);
  view.rerender(<AppearanceSheet {...props} />); fireEvent.press(screen.getByLabelText('Reading font'));
  view.rerender(<AppearanceSheet {...props} visible={false} />); view.rerender(<AppearanceSheet {...props} />);
  expect(screen.getByRole('header', { name: 'Reading Appearance' })).toBeTruthy();
  expect(screen.queryByLabelText(/Use .* reading font/)).toBeNull();
});

test('iOS font rows preview addressable families and disclose the system-serif preview limitation', () => {
  jest.replaceProperty(Native.Platform, 'OS', 'ios');
  render(<AppearanceSheet visible preferences={{ theme: 'light', fontSize: 20 }} disabled={false} onChange={jest.fn()} onClose={jest.fn()} />);
  fireEvent.press(screen.getByLabelText('Reading font'));
  for (const { name, nativeFamily } of expectedReadingFonts) {
    if (nativeFamily !== null) expect(screen.getByText(name)).toHaveStyle({ fontFamily: nativeFamily });
  }
  expect(within(screen.getByLabelText('Use System Serif reading font')).getByText('Preview in reader')).toBeTruthy();
  expect(Native.StyleSheet.flatten(screen.getByText('System Serif').props.style).fontFamily).toBeUndefined();
});

test('font picker moves accessibility focus on entry and return without presenting another modal', async () => {
  jest.spyOn(jest.requireActual<typeof Native>('react-native'), 'findNodeHandle').mockReturnValue(17);
  const focus = jest.spyOn(Native.AccessibilityInfo, 'setAccessibilityFocus');
  render(<AppearanceSheet visible preferences={{ theme: 'light', fontSize: 20 }} disabled={false} onChange={jest.fn()} onClose={jest.fn()} />);
  focus.mockClear(); fireEvent.press(screen.getByLabelText('Reading font'));
  await waitFor(() => expect(focus).toHaveBeenCalledWith(17)); expect(screen.UNSAFE_getAllByType(Native.Modal)).toHaveLength(1);
  focus.mockClear(); fireEvent.press(screen.getByLabelText('Close reading font'));
  await waitFor(() => expect(focus).toHaveBeenCalledWith(17));
  expect(screen.getByRole('header', { name: 'Reading Appearance' })).toBeTruthy();
});

test('font picker keeps scrollable, wrapping rows and Done reachable at large text scale', () => {
  const original = Native.Dimensions.get('window');
  act(() => Native.Dimensions.set({ window: { ...original, fontScale: 2.5 } }));
  try {
    render(<AppearanceSheet visible preferences={{ theme: 'dark', fontSize: 32 }} disabled={false} onChange={jest.fn()} onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Reading font'));
    const scroll = screen.UNSAFE_getByType(Native.ScrollView);
    expect(scroll.props.scrollEnabled).not.toBe(false);
    expect(screen.getAllByLabelText(/Use .* reading font/)).toHaveLength(26);
    for (const row of screen.getAllByLabelText(/Use .* reading font/)) {
      expect(row).toBeEnabled(); expect(row).toHaveStyle({ minHeight: 44, minWidth: 44 });
      expect(Native.StyleSheet.flatten(row.props.style).height).toBeUndefined();
    }
    expect(screen.getByText('Times New Roman').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Times New Roman').props.allowFontScaling).not.toBe(false);
    expect(within(scroll).getByLabelText('Close reading font')).toBeEnabled();
    expect(within(scroll).getByLabelText('Use Snell Roundhand reading font')).toBeEnabled();
  } finally { act(() => Native.Dimensions.set({ window: original })); }
});

test('appearance backdrop dismisses only outside taps and keeps Done available', () => {
  const close = jest.fn(), change = jest.fn();
  render(<AppearanceSheet visible preferences={{ theme: 'paper', fontSize: 20 }} disabled={false} onChange={change} onClose={close} />);
  const backdrop = screen.getByTestId('appearance-backdrop', { includeHiddenElements: true });
  expect(backdrop.props.accessible).toBe(false); expect(backdrop.props.importantForAccessibility).toBe('no');
  fireEvent.press(screen.getByTestId('appearance-panel'));
  fireEvent.press(screen.getByText('Reading Appearance'));
  fireEvent.press(screen.getByText('Font'));
  fireEvent.press(screen.getByLabelText('Increase reading font size'));
  fireEvent.press(screen.getByLabelText('Use dark reading theme'));
  expect(change).toHaveBeenCalledTimes(2); expect(close).not.toHaveBeenCalled();
  fireEvent.press(backdrop); expect(close).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Close reading appearance')).toBeEnabled();
});

test('font backdrop returns to Appearance while inside picker taps never dismiss it', () => {
  const close = jest.fn(), change = jest.fn();
  const props = { visible: true, disabled: false, onChange: change, onClose: close };
  const view = render(<AppearanceSheet {...props} preferences={{ theme: 'paper', fontSize: 24, font: 'georgia' }} />);
  fireEvent.press(screen.getByLabelText('Reading font'));
  fireEvent.press(screen.getByTestId('appearance-panel'));
  fireEvent.press(screen.getByRole('header', { name: 'Handwritten' }));
  fireEvent.press(screen.getByLabelText('Use Marker Felt reading font'));
  expect(change).toHaveBeenCalledWith({ theme: 'paper', fontSize: 24, font: 'marker-felt' });
  expect(screen.getByRole('header', { name: 'Reading Font' })).toBeTruthy(); expect(close).not.toHaveBeenCalled();
  view.rerender(<AppearanceSheet {...props} preferences={{ theme: 'paper', fontSize: 24, font: 'marker-felt' }} />);
  fireEvent.press(screen.getByTestId('appearance-backdrop', { includeHiddenElements: true }));
  expect(screen.getByRole('header', { name: 'Reading Appearance' })).toBeTruthy();
  expect(screen.getByLabelText('Reading font')).toHaveAccessibilityValue({ text: 'Marker Felt' }); expect(close).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('appearance-backdrop', { includeHiddenElements: true })); expect(close).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledTimes(1);
});

test('App Style keeps its existing dismissal behavior', () => {
  const close = jest.fn();
  render(<AppStyleSheet visible value="stowaway" saving={false} error={null} onChange={jest.fn()} onClose={close} />);
  expect(screen.queryByTestId('appearance-backdrop', { includeHiddenElements: true })).toBeNull();
  fireEvent.press(screen.getByTestId('appearance-panel')); expect(close).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Close app style')); expect(close).toHaveBeenCalledTimes(1);
});

test.each([['stowaway', 'light'], ['stowaway', 'dark'], ['classic', 'light'], ['classic', 'dark']] as const)('%s %s active text/background pairs meet normal-text contrast', (profile, mode) => {
  const palette = profiles[profile][mode];
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  };
  const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const background of [palette.canvas, palette.surface, palette.surfaceSubtle, palette.accentSoft]) {
    for (const foreground of [palette.textPrimary, palette.textSecondary, palette.accent]) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  }
  for (const color of [palette.warning, palette.success, palette.destructive]) expect(contrast(color, palette.surfaceSubtle)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.onAccent, palette.accentPressed)).toBeGreaterThanOrEqual(4.5);
});

test.each(['primary', 'secondary', 'tertiary', 'destructive'] as const)('%s buttons wrap, expose disabled state and keep a 44-point minimum target', (variant) => {
  const press = jest.fn();
  const view = render(<Button label="A deliberately long action label" text="A deliberately long action label" variant={variant} disabled onPress={press} />);
  const button = screen.getByRole('button', { name: 'A deliberately long action label' });
  expect(button).toBeDisabled(); expect(button).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(screen.getByText('A deliberately long action label').props.numberOfLines).toBeUndefined();
  fireEvent.press(button); expect(press).not.toHaveBeenCalled();
  view.rerender(<Button label="A deliberately long action label" text="A deliberately long action label" variant={variant} onPress={press} />);
  fireEvent.press(screen.getByRole('button')); expect(press).toHaveBeenCalledTimes(1);
});

test.each([['stowaway', 'light'], ['stowaway', 'dark'], ['classic', 'light'], ['classic', 'dark']] as const)('%s %s shell tokens apply to primary controls and readable banner text', (profile, theme) => {
  jest.spyOn(Native, 'useColorScheme').mockReturnValue(theme);
  render(<AppStyleContext.Provider value={profile}><Button label="Read" text="Read" variant="primary" onPress={() => {}} /><InlineBanner tone="error" title="Local storage error" /></AppStyleContext.Provider>);
  expect(screen.getByLabelText('Read')).toHaveStyle({ backgroundColor: profiles[profile][theme].accent });
  expect(screen.getByText('Read')).toHaveStyle({ color: profiles[profile][theme].onAccent });
  expect(screen.getByRole('alert')).toBeTruthy();
});

test('chapter rows separate navigation/manual targets and expose availability/read state without hints', () => {
  const open = jest.fn(), toggle = jest.fn();
  const view = render(<ChapterRow entry={entry} disabled={false} onOpen={open} onToggle={toggle} />);
  expect(screen.getByLabelText('Read ' + entry.title).props.accessibilityValue.text).toBe('Chapter 14. Unread · Downloaded');
  expect(screen.getByText(entry.title).props.numberOfLines).toBeUndefined();
  expect(screen.queryByText(/Downloaded/)).toBeNull();
  expect(screen.getByText('○')).toHaveStyle({ fontSize: 18 });
  expect(screen.getByLabelText('Mark ' + entry.title + ' as read')).toHaveStyle({ minWidth: 44, minHeight: 44 });
  fireEvent.press(screen.getByLabelText('Mark ' + entry.title + ' as read'));
  expect(toggle).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  view.rerender(<ChapterRow entry={{ ...entry, downloaded: false }} disabled={false} onOpen={open} onToggle={toggle} />);
  expect(screen.getByLabelText('Read ' + entry.title)).toBeDisabled();
  expect(screen.getByText('↓ Not downloaded')).toBeTruthy();
  expect(screen.getByLabelText('Read ' + entry.title).props.accessibilityValue.text).toContain('Not downloaded');
  fireEvent.press(screen.getByLabelText('Read ' + entry.title)); expect(open).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Mark ' + entry.title + ' as read')).toBeEnabled();
});

test('Story rows preserve wrapped titles and accurate partial/all-read summaries', () => {
  const press = jest.fn(); render(<StoryRow story={story} onPress={press} />);
  expect(screen.getByText(story.title).props.numberOfLines).toBeUndefined();
  expect(screen.getByLabelText('Open ' + story.title).props.accessibilityValue.text).toContain('4 of 38 downloaded · 34 unread');
  fireEvent.press(screen.getByLabelText('Open ' + story.title)); expect(press).toHaveBeenCalledTimes(1);
  expect(storySummary({ ...story, downloaded: 38, unread: 0 })).toBe('38 chapters · All read');
});

test('appearance modal exposes size bounds, selected themes and dismissal', () => {
  const change = jest.fn(), close = jest.fn();
  const view = render(<AppearanceSheet visible preferences={{ fontSize: 32, theme: 'light' }} disabled={false} onChange={change} onClose={close} />);
  expect(screen.getByLabelText('Increase reading font size')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Decrease reading font size')); expect(change).toHaveBeenLastCalledWith({ fontSize: 30, theme: 'light' });
  fireEvent.press(screen.getByLabelText('Use dark reading theme')); expect(change).toHaveBeenLastCalledWith({ fontSize: 32, theme: 'dark' });
  expect(screen.getByLabelText('Use light reading theme').props.accessibilityState.selected).toBe(true);
  expect(screen.getByText('✓ Light')).toBeTruthy();
  view.rerender(<AppearanceSheet visible preferences={{ fontSize: 14, theme: 'dark' }} disabled={false} onChange={change} onClose={close} />);
  expect(screen.getByLabelText('Decrease reading font size')).toBeDisabled();
  expect(screen.getByText('✓ Dark')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close reading appearance')); expect(close).toHaveBeenCalledTimes(1);
});

test('Reader bars retain full accessible title and disable saved/unlisted navigation', () => {
  const navigate = jest.fn(); render(<><ReaderTopBar title={entry.title} disabled={false} appearanceDisabled={false} onContents={navigate} onAppearance={() => {}} />
    <ReaderBottomBar position="Saved chapter" previousDisabled nextDisabled onPrevious={navigate} onNext={navigate} /></>);
  expect(screen.getByRole('header').props.accessibilityLabel).toBe(entry.title);
  expect(screen.getByLabelText('Next chapter')).toBeDisabled(); expect(screen.getByLabelText('Previous chapter')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Return to story contents')); expect(navigate).toHaveBeenCalledTimes(1);
});

test('large font scale leaves long actions and chapter controls renderable with no fixed row height', async () => {
  const original = Native.Dimensions.get('window');
  act(() => Native.Dimensions.set({ window: { ...original, fontScale: 2.5 } }));
  try {
    render(<ChapterRow entry={entry} disabled={false} onOpen={() => {}} onToggle={() => {}} />);
    expect(screen.getByLabelText('Read ' + entry.title)).toBeEnabled();
    expect(screen.getByLabelText('Mark ' + entry.title + ' as read')).toHaveStyle({ minHeight: 44 });
    expect(screen.getByText(entry.title).props.numberOfLines).toBeUndefined();
  } finally { act(() => Native.Dimensions.set({ window: original })); }
});
