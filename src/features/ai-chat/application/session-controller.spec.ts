// src/features/ai-chat/application/session-controller.spec.ts

import { describe, expect, it, vi } from 'vitest';

import type { AiChatGateway, AiChatPendingTurnStore, AiChatSessionRuntime } from './ports';
import { AiChatRequestError } from './request-error';
import { AiChatSessionController } from './session-controller';
import type { AiChatEnqueueResult, AiChatWorkflowResult, PendingAiChatTurn } from './types';

function buildEnqueueResult(): AiChatEnqueueResult {
  return {
    admissionStatus: 'EXISTING_ACTIVE',
    asyncTaskRecordId: 1,
    jobId: 'job-1',
    reason: null,
    traceId: 'trace-1',
    workflowId: 'workflow-1',
    workflowStatus: 'QUEUED',
  };
}

function buildWorkflowResult(): AiChatWorkflowResult {
  return {
    createdAt: '2026-07-13T00:00:00.000Z',
    errorCode: null,
    errorMessage: null,
    jobId: 'job-1',
    model: 'qwen-plus',
    outputPayload: { 生成文本: '幂等恢复成功。' },
    outputPayloadKind: 'PRESENT',
    provider: 'qwen',
    traceId: 'trace-1',
    updatedAt: '2026-07-13T00:00:01.000Z',
    workflowId: 'workflow-1',
    workflowStatus: 'SUCCEEDED',
    workflowType: 'EXAMPLE_TEXT_REWRITE_V1',
  };
}

function createHarness(
  options: {
    queryTurn?: AiChatGateway['queryTurn'];
    queueTurn?: AiChatGateway['queueTurn'];
  } = {},
) {
  const pendingTurns = new Map<number, PendingAiChatTurn>();
  const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
  let id = 0;
  let now = 1_000;
  const gateway: AiChatGateway = {
    queryTurn: options.queryTurn ?? vi.fn().mockResolvedValue(buildWorkflowResult()),
    queueTurn: options.queueTurn ?? vi.fn().mockResolvedValue(buildEnqueueResult()),
  };
  const pendingTurnStore: AiChatPendingTurnStore = {
    clear: (accountId) => pendingTurns.delete(accountId),
    load: (accountId) => pendingTurns.get(accountId) ?? null,
    save: (turn) => pendingTurns.set(turn.accountId, turn),
  };
  const runtime: AiChatSessionRuntime = {
    createId: (prefix) => `${prefix}-${++id}`,
    now: () => now,
    random: () => 0.5,
    schedule: (callback, delayMs) => {
      const scheduledOperation = { callback, delayMs };

      scheduled.push(scheduledOperation);
      return () => {
        const index = scheduled.indexOf(scheduledOperation);

        if (index >= 0) {
          scheduled.splice(index, 1);
        }
      };
    },
  };

  return {
    controller: new AiChatSessionController({ gateway, pendingTurnStore, runtime }),
    gateway,
    pendingTurns,
    scheduled,
    setNow: (nextNow: number) => {
      now = nextNow;
    },
  };
}

describe('AiChatSessionController', () => {
  it('persists admission before dispatch and retries an ambiguous response with the same ids', async () => {
    const queueTurn = vi
      .fn<AiChatGateway['queueTurn']>()
      .mockRejectedValueOnce(
        new AiChatRequestError({
          code: 'UNAVAILABLE',
          message: 'response lost',
          retryDisposition: 'ambiguous',
          userMessage: 'response lost',
        }),
      )
      .mockResolvedValueOnce(buildEnqueueResult());
    const harness = createHarness({ queueTurn });

    harness.controller.configure({ accountId: 9527, enabled: true });
    expect(harness.controller.submit('解释异步工作流')).toBe(true);

    await vi.waitFor(() => expect(queueTurn).toHaveBeenCalledTimes(1));
    expect(harness.pendingTurns.get(9527)).toMatchObject({
      phase: 'admission',
      requestId: 'request-2',
      traceId: 'trace-3',
    });
    expect(harness.scheduled[0]?.delayMs).toBe(3_000);

    harness.scheduled.shift()?.callback();

    await vi.waitFor(() => expect(queueTurn).toHaveBeenCalledTimes(2));
    expect(queueTurn.mock.calls[1]?.[0]).toEqual(queueTurn.mock.calls[0]?.[0]);
    await vi.waitFor(() => expect(harness.controller.getState().status).toBe('ready'));
    expect(harness.controller.getState().messages.at(-1)?.content).toBe('幂等恢复成功。');
    expect(harness.pendingTurns.has(9527)).toBe(false);
  });

  it('uses accumulated retry backoff for workflow query failures', async () => {
    const queryTurn = vi
      .fn<AiChatGateway['queryTurn']>()
      .mockRejectedValueOnce(
        new AiChatRequestError({
          code: 'UNAVAILABLE',
          message: 'offline',
          retryDisposition: 'retryable',
          userMessage: 'offline',
        }),
      )
      .mockResolvedValueOnce(buildWorkflowResult());
    const harness = createHarness({ queryTurn });

    harness.pendingTurns.set(9527, {
      accountId: 9527,
      assistantMessageId: 'assistant-recovered',
      phase: 'workflow',
      startedAt: 1_000,
      userMessage: '恢复任务',
      userMessageId: 'user-recovered',
      workflowId: 'workflow-1',
    });
    harness.setNow(62_000);
    harness.controller.configure({ accountId: 9527, enabled: true });

    await vi.waitFor(() => expect(queryTurn).toHaveBeenCalledTimes(1));
    expect(harness.scheduled[0]?.delayMs).toBe(30_000);

    harness.scheduled.shift()?.callback();
    await vi.waitFor(() => expect(harness.controller.getState().status).toBe('ready'));
  });

  it('does not resurrect an admission that was explicitly reset before the response', async () => {
    let resolveAdmission: ((result: AiChatEnqueueResult) => void) | undefined;
    const queueTurn = vi.fn<AiChatGateway['queueTurn']>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdmission = resolve;
        }),
    );
    const queryTurn = vi.fn<AiChatGateway['queryTurn']>();
    const harness = createHarness({ queryTurn, queueTurn });

    harness.controller.configure({ accountId: 9527, enabled: true });
    harness.controller.submit('不要恢复');
    harness.controller.reset();
    resolveAdmission?.(buildEnqueueResult());

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.controller.getState().messages).toEqual([]);
    expect(harness.pendingTurns.has(9527)).toBe(false);
    expect(queryTurn).not.toHaveBeenCalled();
  });
});
