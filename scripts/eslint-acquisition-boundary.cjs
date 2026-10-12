/* global __dirname */
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '../src');
const protectedModules = new Set([
  'importing/native',
  'importing/import-story',
  'images/native',
  'images/download',
  'sources/spacebattles/native',
  'sources/spacebattles/diagnostic',
  'sources/spacebattles/request',
  'storage/management-native',
]);

function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

// Resolve only the repository's relative imports and @/ alias. No filesystem or
// module loading: computed paths and transitive re-export graphs need review.
function moduleId(filename, source) {
  const value = staticString(source);
  if (!value) return null;
  const target = value.startsWith('@/') ? path.resolve(sourceRoot, value.slice(2))
    : value.startsWith('.') ? path.resolve(path.dirname(filename), value) : null;
  return target === null ? null : path.relative(sourceRoot, target).split(path.sep).join('/')
    .replace(/\.[cm]?[jt]sx?$/, '');
}

module.exports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      acquisition: 'UI code must use sources/native-operations instead of direct acquisition implementations; type-only imports are permitted.',
      factory: 'UI code must not obtain createSourceOperations or its module namespace; use sources/native-operations. Named non-factory and type-only imports are permitted.',
    },
  },
  create(context) {
    function check(node, source, specifiers) {
      if (node.importKind === 'type' || node.exportKind === 'type') return;
      const values = specifiers?.filter(item => item.importKind !== 'type' && item.exportKind !== 'type');
      if (specifiers?.length && values.length === 0) return;

      const id = moduleId(context.physicalFilename, source);
      if (protectedModules.has(id)) {
        context.report({ node, messageId: 'acquisition' });
      } else if (id === 'sources/operations') {
        // Unknown/namespace access exposes the factory too. Named imports and
        // re-exports of the failure class remain useful to UI presentation.
        const exposesFactory = values === undefined || values.some(item => {
          if (item.type !== 'ImportSpecifier' && item.type !== 'ExportSpecifier') return true;
          const name = item.imported ?? item.local;
          return (name.name ?? name.value) === 'createSourceOperations';
        });
        if (exposesFactory) context.report({ node, messageId: 'factory' });
      }
    }

    return {
      ImportDeclaration(node) { check(node, node.source, node.specifiers); },
      ExportNamedDeclaration(node) { if (node.source) check(node, node.source, node.specifiers); },
      ExportAllDeclaration(node) { check(node, node.source); },
      ImportExpression(node) { check(node, node.source); },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node, node.arguments[0]);
        }
      },
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type === 'TSExternalModuleReference') {
          check(node, node.moduleReference.expression);
        }
      },
    };
  },
};
