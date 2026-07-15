// src/features/ai-chat/application/workflow.ts

import { isAiChatRequestError } from './request-error';
import type { AiChatEnqueueResult, AiChatTurnPresentation, AiChatWorkflowResult } from './types';

export const AI_CHAT_INPUT_MAX_LENGTH = 12_000;

const FAST_POLL_WINDOW_MS = 10_000;
const NORMAL_POLL_WINDOW_MS = 60_000;

function readGeneratedText(outputPayload: unknown): string | null {
  if (!outputPayload || typeof outputPayload !== 'object' || Array.isArray(outputPayload)) {
    return null;
  }

  const generatedText = (outputPayload as Record<string, unknown>)['生成文本'];

  return typeof generatedText === 'string' && generatedText.trim() ? generatedText.trim() : null;
}

export function resolveAiChatAdmissionPresentation(
  result: AiChatEnqueueResult,
): AiChatTurnPresentation {
  if (!result.workflowId.trim()) {
    return {
      content: 'AI 任务没有返回有效标识，请主动重试。',
      outcome: 'error',
      status: 'failed',
      terminal: true,
    };
  }

  switch (result.admissionStatus) {
    case 'QUEUED':
    case 'EXISTING_ACTIVE':
      return {
        content: '已进入 Qwen 生成队列，正在等待处理。',
        outcome: null,
        status: 'queued',
        terminal: false,
      };
    case 'ADMISSION_WAITING':
      return {
        content: '任务已保存，正在等待 AI 服务恢复。',
        outcome: null,
        status: 'waiting_for_service',
        terminal: false,
      };
    case 'STALE_QUEUED':
      return {
        content: '任务仍在等待后台修复，我会降低查询频率。',
        outcome: null,
        status: 'waiting_for_service',
        terminal: false,
      };
    case 'CONFLICT':
      return {
        content: '检测到已有任务，正在继续查询它的状态。',
        outcome: null,
        status: 'waiting',
        terminal: false,
      };
    default:
      return {
        content: '任务已保存，正在确认队列状态。',
        outcome: null,
        status: 'waiting',
        terminal: false,
      };
  }
}

export function resolveAiChatWorkflowPresentation(
  result: AiChatWorkflowResult,
): AiChatTurnPresentation {
  switch (result.workflowStatus) {
    case 'CREATED':
      return {
        content: '任务已创建，正在等待进入队列。',
        outcome: null,
        status: 'waiting',
        terminal: false,
      };
    case 'ADMISSION_WAITING':
      return {
        content: '任务已保存，正在等待 AI 服务恢复。',
        outcome: null,
        status: 'waiting_for_service',
        terminal: false,
      };
    case 'QUEUED':
      return {
        content: '已进入 Qwen 生成队列，正在等待处理。',
        outcome: null,
        status: 'queued',
        terminal: false,
      };
    case 'PROCESSING':
      return {
        content: 'Qwen 正在生成完整回复。',
        outcome: null,
        status: 'generating',
        terminal: false,
      };
    case 'SUCCEEDED': {
      if (result.outputPayloadKind === 'PURGED') {
        return {
          content: '这次回复的短期结果已经清理，当前无法恢复正文，请重新发送。',
          outcome: 'error',
          status: 'failed',
          terminal: true,
        };
      }

      const generatedText =
        result.outputPayloadKind === 'PRESENT' ? readGeneratedText(result.outputPayload) : null;

      return generatedText
        ? {
            content: generatedText,
            outcome: 'success',
            status: 'completed',
            terminal: true,
          }
        : {
            content: 'AI 任务已完成，但没有返回可展示的正文，请重新发送。',
            outcome: 'error',
            status: 'failed',
            terminal: true,
          };
    }
    case 'FAILED':
      return {
        content: '这次生成失败了，请稍后重新发送。',
        outcome: 'error',
        status: 'failed',
        terminal: true,
      };
    case 'CANCELLED':
      return {
        content: '这次生成已取消。',
        outcome: 'error',
        status: 'cancelled',
        terminal: true,
      };
    default:
      return {
        content: '正在确认 AI 任务状态。',
        outcome: null,
        status: 'waiting',
        terminal: false,
      };
  }
}

export function resolveAiChatPollDelay(input: {
  elapsedMs: number;
  status: AiChatTurnPresentation['status'];
}): number {
  if (input.status === 'waiting_for_service') {
    if (input.elapsedMs < FAST_POLL_WINDOW_MS) {
      return 3_000;
    }

    if (input.elapsedMs < NORMAL_POLL_WINDOW_MS) {
      return 10_000;
    }

    return 30_000;
  }

  if (input.elapsedMs < FAST_POLL_WINDOW_MS) {
    return 900;
  }

  if (input.elapsedMs < NORMAL_POLL_WINDOW_MS) {
    return 2_500;
  }

  return 5_000;
}

export function resolveAiChatRetryDelay(input: { elapsedMs: number; randomValue: number }): number {
  const baseDelay = resolveAiChatPollDelay({
    elapsedMs: input.elapsedMs,
    status: 'waiting_for_service',
  });
  const boundedRandomValue = Math.min(1, Math.max(0, input.randomValue));
  const jitterFactor = 0.8 + boundedRandomValue * 0.4;

  return Math.round(baseDelay * jitterFactor);
}

export function shouldRetryAiChatQuery(error: unknown): boolean {
  return isAiChatRequestError(error) && error.retryDisposition !== 'none';
}

export function shouldRetryAiChatAdmission(error: unknown): boolean {
  return isAiChatRequestError(error) && error.retryDisposition !== 'none';
}

export function resolveAiChatRequestErrorMessage(error: unknown): string {
  if (isAiChatRequestError(error)) {
    return error.userMessage;
  }

  return 'AI 服务暂时无法处理这次请求，请稍后重试。';
}
