import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const serverConfigs = pgTable('server_configs', {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  



enableSignup: boolean('enable_signup').default(true).notNull(),

  
  
  

  
  // Single row enforcement usually done via application logic or unique constraint on a constant column
// For simplicity, we just use a key-value store approach or a single row with specific columns.
// Let's use specific columns for type safety.
// Singleton ID to ensure only one config row
id: text('id').primaryKey().default('1'),

  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
