/* eslint-disable unicorn/no-process-exit */
import { and, eq, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import { messages, users } from './packages/database/src/schemas';
import * as schema from './packages/database/src/schemas';

const main = async () => {
  // Hardcoded for debugging
  const connectionString = 'postgres://postgres:mysecretpassword@127.0.0.1:5433/postgres';
  console.log('Connecting to:', connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle(client, { schema });

  const targetEmail = 'berchielli@berchielli.com.br';
  const user = await db.query.users.findFirst({ where: eq(users.email, targetEmail) });

  if (!user) {
    console.log('User not found:', targetEmail);
    process.exit(1);
  }

  console.log(`User: ${user.email}, ID: ${user.id}, Quota: ${user.tokenQuota}`);

  // Start/End of month matching UsageRecordService logic (roughly)
  const now = new Date();
  // Start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // End of next month's 0th day (which is last day of this month)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  console.log(`Checking usage from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);

  const usageRecords = await db
    .select({
      metadata: messages.metadata,
    })
    .from(messages)
    .where(
      and(
        eq(messages.userId, user.id),
        eq(messages.role, 'assistant'),
        gte(messages.createdAt, startOfMonth),
        lte(messages.createdAt, endOfMonth),
      ),
    );

  let totalTokens = 0;
  usageRecords.forEach((r) => {
    const m = r.metadata as any;
    const input = m?.totalInputTokens || 0;
    const output = m?.totalOutputTokens || 0;
    // console.log(`Msg: Input=${input}, Output=${output}`);
    totalTokens += input + output;
  });

  console.log(`Total Usage for ${targetEmail}: ${totalTokens}`);

  if (user.tokenQuota && user.tokenQuota > 0) {
    const remaining = user.tokenQuota - totalTokens;
    console.log(`Remaining: ${remaining}`);
    console.log(`Quota Exceeded: ${totalTokens >= user.tokenQuota}`);
  } else {
    console.log('User has UNLIMITED quota (or 0/null/undefined).');
  }

  process.exit(0);
};

main();
