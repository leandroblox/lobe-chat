import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';


export const invites = pgTable('invites', {
  
createdAt: timestamp('created_at').defaultNow().notNull(), 
  // UUID
email: text('email').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  id: text('id').primaryKey().notNull(),
  role: text('role').default('user'),
  token: text('token').notNull().unique(),
  tokenQuota: integer('token_quota'),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  usedAt: timestamp('used_at'),
});
