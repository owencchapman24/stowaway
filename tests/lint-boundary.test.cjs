/* global __dirname */
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { ESLint } = require('eslint');

const root = path.resolve(__dirname, '..');
const eslint = new ESLint({ cwd: root }); // Real configuration; no rule overrides or mocks.
const rule = 'stowaway/acquisition-boundary';
const route = 'src/app/m0-lint-probe.ts';
const implementations = [
  ['importing/native', 'importNativeStory'],
  ['importing/import-story', 'importStory'],
  ['images/native', 'downloadNativeImages'],
  ['images/download', 'downloadImages'],
  ['sources/spacebattles/native', 'sourceClient'],
  ['sources/spacebattles/diagnostic', 'runDiagnostic'],
  ['sources/spacebattles/request', 'RequestClient'],
  ['storage/management-native', 'manageNativeStory'],
];

const denied = [
  ...implementations.map(([module, name]) => [module, `import { ${name} } from '../${module}'; export { ${name} };`]),
  ['dynamic literal', "export const load = () => import('../importing/native');"],
  ['dynamic template', 'export const load = () => import(`../images/native.ts`);'],
  ['require', "export const service = require('../importing/native');"],
  ['require template', 'export const service = require(`../images/native`);'],
  ['require destructuring', "export const { importNativeStory } = require('../importing/native');"],
  ['TypeScript require', "import service = require('../importing/native'); export { service };"],
  ['namespace import', "import * as service from '../importing/native'; export { service };"],
  ['side-effect import', "import '../importing/native';"],
  ['named re-export', "export { importNativeStory as service } from '../importing/native';"],
  ['star re-export', "export * from '../importing/native';"],
  ['namespace re-export', "export * as service from '../importing/native';"],
  ['mixed type/value', "import { type ImportProgress, importStory } from '../importing/import-story'; export { importStory }; export type { ImportProgress };"],
  ['normalized relative path', "export * from '../importing/../images/./native.ts';"],
  ['source alias', "export * from '@/sources/spacebattles/request.ts';"],
  ['nested UI helper', "export const load = () => import('../../images/./native.ts');", 'src/ui/nested/m0-lint-probe.tsx'],
  ['reader helper', "export * from '../images/native';", 'src/reader/m0-lint-probe.ts'],
  ...['src/importing/failure-presentation.ts', 'src/importing/update-summary.ts', 'src/images/summary.ts'].map(file => [
    `presentation helper ${file}`, "export * from '../importing/native';", file,
  ]),
  ['JavaScript UI helper', "export const service = require('../importing/native');", 'src/ui/m0-lint-probe.js'],
  ...['ts', 'tsx', 'js', 'jsx', 'mts', 'cts', 'mjs', 'cjs'].map(extension => [
    `explicit .${extension}`, `export * from '../importing/native.${extension}';`,
  ]),
  ['factory import', "import { createSourceOperations as create } from '../sources/operations'; export { create };"],
  ['factory re-export', "export { createSourceOperations as create } from '@/sources/operations.ts';"],
  ['factory star re-export', "export * from '../sources/operations';"],
  ['factory namespace import', "import * as operations from '../sources/operations'; export { operations };"],
  ['factory dynamic import', "export const load = () => import('../sources/operations');"],
  ['factory require', "export const create = require('../sources/operations').createSourceOperations;"],
];

const allowed = [
  ['facade', "import { sourceOperations } from '../sources/native-operations'; export { sourceOperations };"],
  ['facade dynamic', "export const load = () => import('../sources/native-operations');"],
  ['facade require', "export const service = require('../sources/native-operations');"],
  ['facade re-export', "export * from '../sources/native-operations';"],
  ['failure class', "import { SourceOperationFailure, type SourceImportResult } from '../sources/operations'; export { SourceOperationFailure }; export type { SourceImportResult };"],
  ['failure re-export', "export { SourceOperationFailure } from '../sources/operations';"],
  ['ownership helper', "export { ImportFailure } from '../importing/ownership';"],
  ['local management helper', "export { CLEANUP_WARNING } from '../storage/management';"],
  ['type declaration', "import type { ImportProgress } from '../importing/import-story.ts'; export type { ImportProgress };"],
  ['inline type', "import { type ImportProgress } from '../importing/import-story'; export type { ImportProgress };"],
  ['type namespace', "import type * as service from '../images/download'; export type { service };"],
  ['type re-export', "export type { ImportProgress } from '../importing/import-story';"],
  ['inline type re-export', "export { type ImportProgress } from '../importing/import-story';"],
  ['type star re-export', "export type * from '../images/download';"],
  ['type import expression', "export type Options = import('../images/download').ImageOptions;"],
  ['type require', "import type service = require('../images/download'); export type { service };"],
  ['factory type import', "import type { createSourceOperations } from '../sources/operations'; export type Factory = typeof createSourceOperations;"],
  ['UI progress types', "export type { ImageProgress } from '../images/download';", 'src/ui/m0-lint-probe.ts'],
  ['native composition', "export * from '../importing/native'; export * from '../sources/operations';", 'src/sources/m0-lint-probe.ts'],
  ['local cleanup composition', "export { getSourceImageFiles } from '../images/native';", 'src/storage/m0-lint-probe.ts'],
  ['unrelated same basename', "export * from '../storage/native';"],
];

for (const [name, source, filePath = route] of denied) {
  test(`rejects ${name}`, async () => {
    const [result] = await eslint.lintText(source, { filePath: path.join(root, filePath) });
    assert.ok(result.errorCount > 0, JSON.stringify(result.messages));
    assert.ok(result.messages.some(message => message.ruleId === rule && message.severity === 2),
      JSON.stringify(result.messages));
  });
}

for (const [name, source, filePath = route] of allowed) {
  test(`permits ${name}`, async () => {
    const [result] = await eslint.lintText(source, { filePath: path.join(root, filePath) });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
    assert.ok(!result.messages.some(message => message.ruleId === rule), JSON.stringify(result.messages));
  });
}

test('documents computed-path static-analysis limit', async () => {
  const [result] = await eslint.lintText("export const load = (name: string) => import('../importing/' + name);", {
    filePath: path.join(root, route),
  });
  assert.ok(!result.messages.some(message => message.ruleId === rule));
});
