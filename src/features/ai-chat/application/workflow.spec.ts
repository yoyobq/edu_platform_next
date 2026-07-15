// src/features/ai-chat/application/workflow.spec.ts

import { describe, expect, it } from 'vitest';

import { GraphQLIngressError } from '@/shared/graphql';

import type { AiChatEnqueueResult, AiChatWorkflowResult } from './types';
import {
  resolveAiChatAdmissionPresentation,
  resolveAiChatPollDelay,
  resolveAiChatWorkflowPresentation,
  shouldRetryAiChatQuery,
} from './workflow';

function buildEnqueueResult(overrides: Partial<AiChatEnqueueResult> = {}): AiChatEnqueueResult {
  return {
    admissionStatus: 'QUEUED',
    workflowId: 'workflow-1',
    workflowStatus: 'QUEUED',
    jobId: 'job-1',
    traceId: 'trace-1',
    asyncTaskRecordId: 1,
    reason: null,
    ...overrides,
  };
}

function buildWorkflowResult(overrides: Partial<AiChatWorkflowResult> = {}): AiChatWorkflowResult {
  return {
    workflowId: 'workflow-1',
    workflowType: 'EXAMPLE_TEXT_REWRITE_V1',
    workflowStatus: 'PROCESSING',
    traceId: 'trace-1',
    jobId: 'job-1',
    provider: 'qwen',
    model: 'qwen-plus',
    outputPayloadKind: 'NONE',
    outputPayload: null,
    errorCode: null,
    errorMessage: null,
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:01.000Z',
    ...overrides,
  };
}

describe('ai chat workflow presentation', () => {
  it('keeps admission waiting and stale queue states non-terminal', () => {
    expect(
      resolveAiChatAdmissionPresentation(
        buildEnqueueResult({ admissionStatus: 'ADMISSION_WAITING' }),
      ),
    ).toMatchObject({ status: 'waiting_for_service', terminal: false });

    expect(
      resolveAiChatAdmissionPresentation(buildEnqueueResult({ admissionStatus: 'STALE_QUEUED' })),
    ).toMatchObject({ status: 'waiting_for_service', terminal: false });
  });

  it('rejects an admission response without a workflow id', () => {
    expect(
      resolveAiChatAdmissionPresentation(buildEnqueueResult({ workflowId: '' })),
    ).toMatchObject({
      status: 'failed',
      terminal: true,
    });
  });

  it('returns generated text only for a successful present output', () => {
    expect(
      resolveAiChatWorkflowPresentation(
        buildWorkflowResult({
          workflowStatus: 'SUCCEEDED',
          outputPayloadKind: 'PRESENT',
          outputPayload: { 生成文本: '  Qwen 的完整回复。  ' },
        }),
      ),
    ).toEqual({
      content: 'Qwen 的完整回复。',
      outcome: 'success',
      status: 'completed',
      terminal: true,
    });
  });

  it('treats purged or missing output as an unrecoverable result', () => {
    expect(
      resolveAiChatWorkflowPresentation(
        buildWorkflowResult({
          workflowStatus: 'SUCCEEDED',
          outputPayloadKind: 'PURGED',
        }),
      ),
    ).toMatchObject({ status: 'failed', terminal: true });

    expect(
      resolveAiChatWorkflowPresentation(
        buildWorkflowResult({
          workflowStatus: 'SUCCEEDED',
          outputPayloadKind: 'NONE',
        }),
      ),
    ).toMatchObject({ status: 'failed', terminal: true });
  });

  it('uses fast, normal, and low-frequency polling windows', () => {
    expect(resolveAiChatPollDelay({ elapsedMs: 1_000, status: 'queued' })).toBe(900);
    expect(resolveAiChatPollDelay({ elapsedMs: 11_000, status: 'generating' })).toBe(2_500);
    expect(resolveAiChatPollDelay({ elapsedMs: 61_000, status: 'generating' })).toBe(5_000);
    expect(resolveAiChatPollDelay({ elapsedMs: 1_000, status: 'waiting_for_service' })).toBe(3_000);
    expect(resolveAiChatPollDelay({ elapsedMs: 11_000, status: 'waiting_for_service' })).toBe(
      10_000,
    );
    expect(resolveAiChatPollDelay({ elapsedMs: 61_000, status: 'waiting_for_service' })).toBe(
      30_000,
    );
  });

  it('retries query transport failures and stable internal server errors', () => {
    expect(
      shouldRetryAiChatQuery(
        new GraphQLIngressError({ type: 'network', message: 'network unavailable' }),
      ),
    ).toBe(true);

    expect(
      shouldRetryAiChatQuery(
        new GraphQLIngressError({
          type: 'graphql',
          message: 'internal',
          graphqlErrors: [
            {
              message: 'internal',
              extensions: { code: 'INTERNAL_SERVER_ERROR' },
            },
          ],
        }),
      ),
    ).toBe(true);

    expect(
      shouldRetryAiChatQuery(
        new GraphQLIngressError({
          type: 'graphql',
          message: 'forbidden',
          graphqlErrors: [{ message: 'forbidden', extensions: { code: 'FORBIDDEN' } }],
        }),
      ),
    ).toBe(false);
  });
});
