// Tests run against a dedicated database. Never point TEST_DATABASE_URL at real data.
const url = process.env.TEST_DATABASE_URL ?? '';
if (!url) throw new Error('Set TEST_DATABASE_URL (a disposable PostgreSQL database whose name contains "test")');
const dbName = new URL(url).pathname.replace('/', '');
if (!dbName.includes('test')) throw new Error('Refusing to run: TEST_DATABASE_URL database name must contain "test"');
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
