import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import * as Native from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Library from '../../src/app/index';
import { StorageProvider } from '../../src/storage/context';
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
