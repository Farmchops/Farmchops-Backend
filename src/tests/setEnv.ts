// Sets environment variables before any module is loaded.
// This runs via jest's "setupFiles" option (before the test framework is installed).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '7d';
process.env.SESSION_SECRET = 'test-session-secret';
