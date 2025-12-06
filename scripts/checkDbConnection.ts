import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

console.log('=== Current Database Configuration ===\n');

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.log('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Parse and display the connection details (without showing password)
try {
  const url = new URL(mongoUri);
  const hostname = url.hostname;
  const username = url.username;
  const password = url.password ? '****' + url.password.slice(-4) : 'none';
  const database = url.pathname.slice(1) || 'default';
  const params = url.searchParams;

  console.log(`Host: ${hostname}`);
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log(`Database: ${database}`);
  console.log(`App Name: ${params.get('appName') || 'none'}`);
  console.log(`\nFull URI (masked): ${mongoUri.replace(/:[^:@]+@/, ':****@')}`);
} catch (error) {
  console.log('Could not parse MongoDB URI');
  console.log(`Connection string: ${mongoUri.replace(/:[^:@]+@/, ':****@')}`);
}
