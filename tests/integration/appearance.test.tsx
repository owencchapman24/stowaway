import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { useEffect } from 'react';
import * as Native from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Library from '../../src/app/index';
import { StorageProvider, useStorage } from '../../src/storage/context';
import { openStorage } from '../../src/storage/native';
import { migrate } from '../../src/storage/migrations';
import { createRepository } from '../../src/storage/repository';
import { profiles } from '../../src/ui/theme';
import { hostSqlite } from './host-sqlite';

jest.mock('../../src/storage/native', () => ({ openStorage: jest.fn() }));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { router: { push: jest.fn() }, useFocusEffect: (callback: () => (() => void)) => useEffect(callback, [callback]) };
});
let folder: string, host: ReturnType<typeof hostSqlite>, repo: ReturnType<typeof createRepository>;
beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), 'stowaway-appearance-')); host = hostSqlite(join(folder, 'test.db'));
  await migrate(host.db); repo = createRepository(host.db);
  await repo.savePreferences({ font: 'palatino', fontSize: 26, theme: 'paper' });
  jest.mocked(openStorage).mockResolvedValue({ repository: repo, imageWarning: null });
});
afterEach(() => {
  jest.restoreAllMocks(); host.close(); const path = resolve(folder);
  if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith('stowaway-appearance-')) throw new Error('Unexpected test root.');
  rmSync(path, { recursive: true, force: true });
});

test.each(['light', 'dark'] as const)('App Style defaults, switches, and reloads under the %s system shell without changing Paper/font', async (system) => {
  jest.spyOn(Native, 'useColorScheme').mockReturnValue(system);
  const view = render(<StorageProvider><Library /></StorageProvider>);
  await act(async () => {});
  await waitFor(() => expect(screen.getByText('App Style · Stowaway')).toBeTruthy());
  expect(screen.getByText('Stowaway')).toHaveStyle({ color: profiles.stowaway[system].textPrimary });
  fireEvent.press(screen.getByLabelText('App Style'));
  expect(screen.getByLabelText('Use Stowaway app style').props.accessibilityState.selected).toBe(true);
  fireEvent.press(screen.getByLabelText('Use Classic app style'));
  await waitFor(() => expect(screen.getByText('✓ Classic')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Close app style'));
  expect(screen.getByText('Stowaway')).toHaveStyle({ color: profiles.classic[system].textPrimary });
  view.unmount(); render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByText('App Style · Classic')).toBeTruthy());
  expect(await repo.getAppStyle()).toBe('classic');
  expect(await repo.getPreferences()).toEqual({ font: 'palatino', fontSize: 26, theme: 'paper' });
});

test('failed App Style write keeps the selected profile and offers a truthful retry', async () => {
  render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByLabelText('App Style')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('App Style')); host.failNextCommit();
  fireEvent.press(screen.getByLabelText('Use Classic app style'));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('✓ Stowaway')).toBeTruthy(); expect(await repo.getAppStyle()).toBe('stowaway');
  fireEvent.press(screen.getByLabelText('Use Classic app style'));
  await waitFor(() => expect(screen.getByText('✓ Classic')).toBeTruthy());
});

test('App Style reconciles a committed write even when its driver rejects afterward', async () => {
  const view = render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByLabelText('App Style')).toBeTruthy());
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
    await transaction(work); throw new Error('Driver rejected after COMMIT.');
  });
  fireEvent.press(screen.getByLabelText('App Style'));
  fireEvent.press(screen.getByLabelText('Use Classic app style'));
  await waitFor(() => expect(screen.getByText('✓ Classic')).toBeTruthy());
  expect(screen.queryByRole('alert')).toBeNull();
  expect(await repo.getAppStyle()).toBe('classic');
  view.unmount(); render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByText('App Style · Classic')).toBeTruthy());
});

test('an unreadable App Style outcome makes no rollback promise and reloads the persisted choice', async () => {
  const view = render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByLabelText('App Style')).toBeTruthy());
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
    await transaction(work); throw new Error('Driver rejected after COMMIT.');
  });
  jest.spyOn(repo, 'getAppStyle').mockRejectedValueOnce(new Error('Read unavailable.'));
  fireEvent.press(screen.getByLabelText('App Style'));
  fireEvent.press(screen.getByLabelText('Use Classic app style'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not confirm App Style. Please retry or reopen Stowaway.'));
  expect(screen.getByText('✓ Stowaway')).toBeTruthy();
  expect(await repo.getAppStyle()).toBe('classic');
  view.unmount(); render(<StorageProvider><Library /></StorageProvider>); await act(async () => {});
  await waitFor(() => expect(screen.getByText('App Style · Classic')).toBeTruthy());
});

let reading: ReturnType<typeof useStorage>;
function ReadingProbe() {
  const value = useStorage();
  useEffect(() => { reading = value; }, [value]);
  return <Native.Text>{JSON.stringify(value.preferences)}</Native.Text>;
}
const previousReading = { font: 'palatino', fontSize: 26, theme: 'paper' } as const;
const nextReading = { font: 'menlo', fontSize: 22, theme: 'dark' } as const;

test('reading COMMIT-then-reject holds settlement until authoritative readback confirms all preferences', async () => {
  const view = render(<StorageProvider><ReadingProbe /></StorageProvider>); await act(async () => {});
  const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
  jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
    await transaction(work); throw new Error('Driver rejected after COMMIT.');
  });
  const getPreferences = repo.getPreferences.bind(repo);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const readback = jest.spyOn(repo, 'getPreferences').mockImplementationOnce(async () => { await gate; return getPreferences(); });
  let settled = false, write!: Promise<void>;
  act(() => { write = reading.changePreferences(nextReading).then(() => { settled = true; }); });
  await waitFor(() => expect(readback).toHaveBeenCalledTimes(1));
  expect(settled).toBe(false); expect(reading.preferences).toEqual(previousReading);
  expect(await getPreferences()).toEqual(nextReading);
  await act(async () => { release(); await write; });
  expect(settled).toBe(true); expect(reading.preferences).toEqual(nextReading);
  expect(reading.appStyle).toBe('stowaway');
  view.unmount(); render(<StorageProvider><ReadingProbe /></StorageProvider>); await act(async () => {});
  expect(reading.preferences).toEqual(nextReading);
});

test('reading rollback rejects after readback, keeps prior preferences and permits a normal retry', async () => {
  render(<StorageProvider><ReadingProbe /></StorageProvider>); await act(async () => {});
  host.failNextCommit();
  await act(async () => { await expect(reading.changePreferences(nextReading)).rejects.toThrow('Injected commit failure'); });
  expect(reading.preferences).toEqual(previousReading); expect(await repo.getPreferences()).toEqual(previousReading);
  await act(async () => { await reading.changePreferences(nextReading); });
  expect(reading.preferences).toEqual(nextReading); expect(await repo.getPreferences()).toEqual(nextReading);
});

test.each([true, false])('unreadable reading outcome (committed=%s) rejects without guessing and reloads authoritative settings', async (committed) => {
  const view = render(<StorageProvider><ReadingProbe /></StorageProvider>); await act(async () => {});
  if (committed) {
    const transaction = host.db.withExclusiveTransactionAsync.bind(host.db);
    jest.spyOn(host.db, 'withExclusiveTransactionAsync').mockImplementationOnce(async (work) => {
      await transaction(work); throw new Error('Driver rejected after COMMIT.');
    });
  } else host.failNextCommit();
  jest.spyOn(repo, 'getPreferences').mockRejectedValueOnce(new Error('Read unavailable.'));
  await act(async () => { await expect(reading.changePreferences(nextReading)).rejects.toThrow('Read unavailable.'); });
  expect(reading.preferences).toEqual(previousReading);
  const saved = committed ? nextReading : previousReading;
  expect(await repo.getPreferences()).toEqual(saved);
  view.unmount(); render(<StorageProvider><ReadingProbe /></StorageProvider>); await act(async () => {});
  expect(reading.preferences).toEqual(saved);
});
