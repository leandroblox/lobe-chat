import {
  AGENT_RUNTIME_ERROR_SET,
  ChatCompletionErrorPayload,
  ModelRuntime,
} from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { checkAuth } from '@/app/(backend)/middleware/auth';
import { users } from '@/database/schemas';
import { serverDB } from '@/database/server';
import { createTraceOptions, initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { UsageRecordService } from '@/server/services/usage';
import { ChatStreamPayload } from '@/types/openai/chat';
import { createErrorResponse } from '@/utils/errorResponse';
import { getTracePayload } from '@/utils/trace';

export const maxDuration = 300;

export const POST = checkAuth(async (req: Request, { params, jwtPayload, createRuntime }) => {
  const provider = (await params)!.provider!;

  try {
    // ============  0. Check User Quota   ============ //
    const userId = jwtPayload.userId!;
    const user = await serverDB.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user?.tokenQuota && user.tokenQuota > 0) {
      const usageService = new UsageRecordService(serverDB, userId);
      const usage = await usageService.findByMonth();

      const totalUsed = usage.reduce((acc, item) => acc + (item.totalTokens || 0), 0);

      if (totalUsed >= user.tokenQuota) {
        return createErrorResponse(ChatErrorType.SubscriptionPlanLimit, {
          error: { message: 'Monthly token quota exceeded' },
          provider,
        });
      }
    }

    // ============  1. init chat model   ============ //
    let modelRuntime: ModelRuntime;
    if (createRuntime) {
      modelRuntime = createRuntime(jwtPayload);
    } else {
      modelRuntime = await initModelRuntimeWithUserPayload(provider, jwtPayload);
    }

    // ============  2. create chat completion   ============ //

    const data = (await req.json()) as ChatStreamPayload;

    const tracePayload = getTracePayload(req);

    let traceOptions = {};
    // If user enable trace
    if (tracePayload?.enabled) {
      traceOptions = createTraceOptions(data, { provider, trace: tracePayload });
    }

    return await modelRuntime.chat(data, {
      user: jwtPayload.userId,
      ...traceOptions,
      signal: req.signal,
    });
  } catch (e) {
    const {
      errorType = ChatErrorType.InternalServerError,
      error: errorContent,
      ...res
    } = e as ChatCompletionErrorPayload;

    const error = errorContent || e;

    const logMethod = AGENT_RUNTIME_ERROR_SET.has(errorType as string) ? 'warn' : 'error';
    // track the error at server side
    console[logMethod](`Route: [${provider}] ${errorType}:`, error);

    return createErrorResponse(errorType, { error, ...res, provider });
  }
});
