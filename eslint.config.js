const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const acquisitionBoundary = require('./scripts/eslint-acquisition-boundary.cjs');

module.exports = defineConfig([
  expo,
  { ignores: ['.tools/**', '.scaffold/**', 'dist/**', 'coverage/**', '.expo/**'] },
  {
    files: [
      'src/{app,ui,reader}/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}',
      'src/importing/{failure-presentation,update-summary}.ts',
      'src/images/summary.ts',
    ],
    plugins: { stowaway: { rules: { 'acquisition-boundary': acquisitionBoundary } } },
    rules: {
      'stowaway/acquisition-boundary': 'error',
    },
  },
]);
