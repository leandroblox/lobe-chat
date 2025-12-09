/* eslint-disable unicorn/no-process-exit */
import { Client } from 'pg';

const connectionString = 'postgres://postgres:mysecretpassword@127.0.0.1:5432/postgres';
console.log('Testing connection to:', connectionString);

const client = new Client({ connectionString });

try {
  await client.connect();
  console.log('✅ Connected successfully');
  const res = await client.query('SELECT NOW()');
  console.log('Query result:', res.rows[0]);
  await client.end();
} catch (err) {
  console.error('❌ Connection failed:', err);
  process.exit(1);
}
