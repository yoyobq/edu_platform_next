// src/features/ai-chat/infrastructure/ai-chat-api.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeGraphQLMock } = vi.hoisted(() => ({
  executeGraphQLMock: vi.fn(),
}));

vi.mock('@/shared/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/graphql')>();

  return { ...actual, executeGraphQL: executeGraphQLMock };
});

import { GraphQLIngressError } from '@/shared/graphql';

import { queryAiChatTurn, queueAiChatTurn } from './ai-chat-api';

describe('ai chat api', () => {
  beforeEach(() => {
    executeGraphQLMock.mockReset();
    vi.stubEnv('VITE_AI_CHAT_MODEL', 'qwen-max');
  });

  it('queues the text rewrite workflow through the configured qwen model', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      queueExampleTextRewriteWorkflow: {
        admissionStatus: 'QUEUED',
        workflowId: 'workflow-1',
        workflowStatus: 'QUEUED',
        jobId: 'job-1',
        traceId: 'chat-preview:trace-1',
        asyncTaskRecordId: 7,
        reason: null,
      },
    });

    await expect(
      queueAiChatTurn({ message: '解释一下这段代码', requestId: 'request-1', traceId: 'trace-1' }),
    ).resolves.toMatchObject({
      admissionStatus: 'QUEUED',
      workflowId: 'workflow-1',
      workflowStatus: 'QUEUED',
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('QueueExampleTextRewriteWorkflow'),
      {
        input: {
          provider: 'qwen',
          model: 'qwen-max',
          originalText: '解释一下这段代码',
          requirement: expect.stringContaining('直接给出'),
          workflowDedupKey: 'chat-preview:request-1',
          traceId: 'chat-preview:trace-1',
        },
      },
    );
  });

  it('maps a successful workflow result without leaking transport DTOs', async () => {
    executeGraphQLMock.mockResolvedValueOnce({
      aiWorkflowDemoResult: {
        workflowId: 'workflow-1',
        workflowType: 'EXAMPLE_TEXT_REWRITE_V1',
        workflowStatus: 'SUCCEEDED',
        traceId: 'trace-1',
        jobId: 'job-1',
        provider: 'qwen',
        model: 'qwen-max',
        outputPayloadKind: 'PRESENT',
        outputPayload: { 生成文本: '完整回复' },
        errorCode: null,
        errorMessage: null,
        createdAt: '2026-07-13T00:00:00.000Z',
        updatedAt: '2026-07-13T00:00:01.000Z',
      },
    });

    await expect(queryAiChatTurn('workflow-1')).resolves.toMatchObject({
      workflowId: 'workflow-1',
      workflowStatus: 'SUCCEEDED',
      outputPayloadKind: 'PRESENT',
      outputPayload: { 生成文本: '完整回复' },
    });

    expect(executeGraphQLMock).toHaveBeenCalledWith(
      expect.stringContaining('AiWorkflowDemoResult'),
      { input: { workflowId: 'workflow-1' } },
    );
  });

  it('translates malformed mutation responses into an ambiguous application error', async () => {
    executeGraphQLMock.mockRejectedValueOnce(
      new GraphQLIngressError({ type: 'malformed', message: 'missing data' }),
    );

    await expect(
      queueAiChatTurn({ message: '解释一下这段代码', requestId: 'request-1', traceId: 'trace-1' }),
    ).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      retryDisposition: 'ambiguous',
    });
  });

  it('translates malformed query responses into a retryable application error', async () => {
    executeGraphQLMock.mockRejectedValueOnce(
      new GraphQLIngressError({ type: 'malformed', message: 'missing data' }),
    );

    await expect(queryAiChatTurn('workflow-1')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      retryDisposition: 'retryable',
    });
  });
});
