import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { invites, messages, serverConfigs, users } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const adminProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const user = await ctx.serverDB.query.users.findFirst({
    where: eq(users.id, ctx.userId),
  });

  if (!user || user.role !== 'admin') {
    // TODO: For bootstrapping, maybe allow if NO admins exist?
    // For now, strict check. User can update DB manually to make themselves admin.
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

export const adminRouter = router({
  createInvite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(['user', 'admin']).default('user'),
        tokenQuota: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token =
        Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
      // Valid for 7 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await ctx.serverDB.insert(invites).values({
        email: input.email,
        expiresAt: expiresAt,
        id: crypto.randomUUID(),
        role: input.role,
        token: token,
        tokenQuota: input.tokenQuota,
      });

      return { token };
    }),

  deleteUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(users).where(eq(users.id, input.userId));

      return { success: true };
    }),

  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const usersCount = await ctx.serverDB.select({ count: sql<number>`count(*)` }).from(users);
    const messagesCount = await ctx.serverDB
      .select({ count: sql<number>`count(*)` })
      .from(messages);

    let config = await ctx.serverDB.query.serverConfigs.findFirst();
    if (!config) {
      // Initialize if missing
      await ctx.serverDB.insert(serverConfigs).values({ id: '1' });
      config = await ctx.serverDB.query.serverConfigs.findFirst();
    }

    return {
      enableSignup: config?.enableSignup ?? true,
      totalMessages: Number(messagesCount[0].count),
      totalUsers: Number(usersCount[0].count),
    };
  }),

  getInvites: adminProcedure.query(async ({ ctx }) => {
    return await ctx.serverDB.query.invites.findMany({
      orderBy: (invites, { desc }) => [desc(invites.createdAt)],
    });
  }),

  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const allUsers = await ctx.serverDB.query.users.findMany({
        limit: pageSize,
        offset: offset,
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      });

      return allUsers;
    }),

  revokeInvite: adminProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(invites).where(eq(invites.id, input.id));
      return { success: true };
    }),

  toggleSignup: adminProcedure
    .input(
      z.object({
        enable: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Upsert config with ID '1'
      await ctx.serverDB
        .insert(serverConfigs)
        .values({ enableSignup: input.enable, id: '1' })
        .onConflictDoUpdate({
          set: { enableSignup: input.enable },
          target: serverConfigs.id,
        });

      return { success: true };
    }),

  toggleUserBlock: adminProcedure
    .input(
      z.object({
        isBlocked: z.boolean(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ isBlocked: input.isBlocked })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  updateUserQuota: adminProcedure
    .input(
      z.object({
        tokenQuota: z.number().nullable(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ tokenQuota: input.tokenQuota })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  updateUserRole: adminProcedure
    .input(
      z.object({
        role: z.enum(['user', 'admin']),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.update(users).set({ role: input.role }).where(eq(users.id, input.userId));

      return { success: true };
    }),
});
