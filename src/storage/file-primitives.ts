/** Relative operations beneath one injected document root; native and host adapters use real files. */
export interface LocalFiles {
  root: string;
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  size(path: string): number;
  mkdir(path: string): void;
  read(path: string): Promise<Uint8Array>;
  write(path: string, bytes: Uint8Array | string): void;
  writeNew(path: string, bytes: Uint8Array): void;
  list(path: string): string[];
  remove(path: string): void;
}
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function relativeFile(path: string): string {
  if (!path || path.split('/').some((part) => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9_.-]+$/.test(part))) throw new Error('Invalid relative file path.');
  return path;
}
