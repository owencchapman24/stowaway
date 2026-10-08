
import * as Native from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button, ChapterRow, InlineBanner, StoryRow, storySummary } from '../src/ui/components';
import { AppearanceSheet, ReaderBottomBar, ReaderTopBar } from '../src/ui/reader-chrome';
import { AppStyleContext, profiles } from '../src/ui/theme';
import { READER_FONTS } from '../src/domain/preferences';

const entry = { id: 'spacebattles:thread:1:post:2', postId: '2', title: 'A very long chapter title that should wrap naturally at larger text sizes',
  position: 13, sourceUrl: '', downloaded: true, isRead: false };
const story = { id: 'spacebattles:thread:1', source: 'spacebattles' as const, threadId: '1', title: entry.title, author: 'Synthetic author',
  sourceUrl: '', categoryId: '9', total: 38, downloaded: 4, unread: 34, lastUpdateAttemptAt: null, lastUpdateSuccessAt: null };
afterEach(() => jest.restoreAllMocks());

test.each(READER_FONTS)('the %s reader font exposes selected state and keeps a full target', (font) => {
  const change = jest.fn(); render(<AppearanceSheet visible preferences={{ theme: 'paper', fontSize: 20, font }} disabled={false} onChange={change} onClose={() => {}} />);
  const name = font.charAt(0).toUpperCase() + font.slice(1);
  expect(screen.getByText('✓ ' + name)).toBeTruthy();
  expect(screen.getByLabelText('Use ' + font + ' reading font').props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('Use ' + font + ' reading font')).toHaveStyle({ minWidth: 44, minHeight: 44 });
  fireEvent.press(screen.getByLabelText('Use paper reading theme')); expect(change).not.toHaveBeenCalled();
  expect(screen.getByText('✓ Paper')).toBeTruthy();
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
