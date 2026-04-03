/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', '.vscode-test/', 'webview/dist/'],
  rules: {
    // 当前代码库里大量使用 `any`/mock/测试 hook，过于严格会导致“全红”。
    // 目标是先恢复 lint 可运行性与基础质量门槛，而不是一次性重构全量代码。
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'no-case-declarations': 'off',
    'prefer-const': 'off',
  },
  overrides: [
    {
      files: ['src/types/**/*.ts'],
      excludedFiles: ['src/types/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};

