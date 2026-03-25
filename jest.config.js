/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        noUncheckedIndexedAccess: false,
        types: ['jest', 'node'],
      },
    }],
  },
  setupFiles: ['<rootDir>/src/tests/setEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/tests/**',
    '!src/jobs/**',
    '!src/scripts/**',
  ],
  coverageDirectory: 'coverage',
};
