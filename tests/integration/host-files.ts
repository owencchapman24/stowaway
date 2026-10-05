import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { relativeFile, type LocalFiles } from '../../src/storage/local-files';

export function hostFiles(root: string): LocalFiles {
  const path = (relative: string) => join(root, relativeFile(relative));
  return {
    root: root.replace(/\\/g, '/'),
    exists: (relative) => existsSync(path(relative)),
    isDirectory: (relative) => existsSync(path(relative)) && statSync(path(relative)).isDirectory(),
    mkdir: (relative) => { mkdirSync(path(relative), { recursive: true }); },
    read: async (relative) => new Uint8Array(readFileSync(path(relative))),
    write: (relative, bytes) => { writeFileSync(path(relative), bytes); },
    list: (relative) => existsSync(path(relative)) ? readdirSync(path(relative)) : [],
    remove: (relative) => {
      // Caller owns and scopes each target; adapter never accepts parent/absolute paths.
      rmSync(path(relative), { recursive: statSync(path(relative)).isDirectory() });
    },
  };
}
