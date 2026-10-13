module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  transformIgnorePatterns: [
    '/node_modules/(?!(react-native|@react-native|@react-native-community|expo|@expo|@react-navigation|@noble/hashes|@rgrove/parse-xml|htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/.tools/', '<rootDir>/.scaffold/'],
};
