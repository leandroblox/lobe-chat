import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { invites, users } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

export const inviteRouter = router({
  claimInvite: authedProcedure
    .use(serverDatabase)
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find valid invite
      const invite = await ctx.serverDB.query.invites.findFirst({
        where: and(
          eq(invites.token, input.token),
          isNull(invites.usedAt),
          // valid time check not strictly supported by drizzle-orm helper in query helper easily,
          // but we can query then check or use raw sql. For simplicity, query then check.
        ),
      });

      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid or used invite token' });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite expired' });
      }

      // Check if email matches?
      // User requested "Creation", so strict email match is safer.
      // We check if the logged in user's email matches the invite email.
      const currentUser = await ctx.serverDB.query.users.findFirst({
        where: eq(users.id, ctx.userId),
      });

      if (!currentUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Strict email match check - Optional but good for security.
      // Let's enforce it if the invite has an email.
      if (invite.email && invite.email.toLowerCase() !== currentUser.email?.toLowerCase()) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This invite is for a different email address',
        });
      }

      // Apply changes
      await ctx.serverDB.transaction(async (tx) => {
        // Update user
        await tx
          .update(users)
          .set({
            role: invite.role,
            tokenQuota: invite.tokenQuota,
          })
          .where(eq(users.id, ctx.userId));

        // Mark invite used
        await tx.update(invites).set({ usedAt: new Date() }).where(eq(invites.id, invite.id));
      });

      return { success: true };
    }),
});
