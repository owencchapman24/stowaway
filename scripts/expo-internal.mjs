import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Explicit internal development command; does not infer an audience inside the app.
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE: 'internal-personal' },
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
