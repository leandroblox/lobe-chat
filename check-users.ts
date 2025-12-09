/* eslint-disable unicorn/no-process-exit */
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import { users } from './packages/database/src/schemas';
import * as schema from './packages/database/src/schemas';

const main = async () => {
  // Hardcoded for debugging
  const connectionString = 'postgres://postgres:mysecretpassword@127.0.0.1:5433/postgres';
  console.log('Connecting to:', connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle(client, { schema });

  // Auto-promote the user
  console.log('Promoting leandro@blox.education to admin...');
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, 'leandro@blox.education'));

  const allUsers = await db.query.users.findMany();
  console.log('Total Users:', allUsers.length);
  console.table(
    allUsers.map((u: any) => ({ email: u.email, id: u.id, quota: u.tokenQuota, role: u.role })),
  );
  process.exit(0);
};

main();
