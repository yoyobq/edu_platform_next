// src/features/ai-chat/infrastructure/ai-chat-api.ts

import { executeGraphQL } from '@/shared/graphql';

import type { AiChatGateway } from '../application/ports';
import type {
  AiChatAdmissionStatus,
  AiChatEnqueueResult,
  AiChatOutputPayloadKind,
  AiChatRuntimeConfig,
  AiChatWorkflowResult,
  AiChatWorkflowStatus,
} from '../application/types';

import { toAiChatRequestError } from './ai-chat-error';

const QUEUE_AI_CHAT_TURN_MUTATION = `
  mutation QueueExampleTextRewriteWorkflow($input: QueueExampleTextRewriteWorkflowInput!) {
    queueExampleTextRewriteWorkflow(input: $input) {
      admissionStatus
      workflowId
      workflowStatus
      jobId
      traceId
      asyncTaskRecordId
      reason
    }
  }
`;

const AI_CHAT_WORKFLOW_RESULT_QUERY = `
  query AiWorkflowDemoResult($input: AiWorkflowDemoResultInput!) {
    aiWorkflowDemoResult(input: $input) {
      workflowId
      workflowType
      workflowStatus
      traceId
      jobId
      provider
      model
      outputPayloadKind
      outputPayload
      errorCode
      errorMessage
      createdAt
      updatedAt
    }
  }
`;

const AI_CHAT_REQUIREMENT =
  '把原文视为用户向 AI 助手提出的问题或任务，不要复述或改写问题；直接给出准确、自然、简洁的中文答复。';

const ADMISSION_STATUSES = new Set<AiChatAdmissionStatus>([
  'ADMISSION_WAITING',
  'CONFLICT',
  'EXISTING_ACTIVE',
  'QUEUED',
  'STALE_QUEUED',
]);

const WORKFLOW_STATUSES = new Set<AiChatWorkflowStatus>([
  'ADMISSION_WAITING',
  'CANCELLED',
  'CREATED',
  'FAILED',
  'PROCESSING',
  'QUEUED',
  'SUCCEEDED',
]);

const OUTPUT_PAYLOAD_KINDS = new Set<AiChatOutputPayloadKind>(['NONE', 'PRESENT', 'PURGED']);

type RawAiChatEnqueueResult = {
  admissionStatus: unknown;
  workflowId: unknown;
  workflowStatus: unknown;
  jobId: unknown;
  traceId: unknown;
  asyncTaskRecordId: unknown;
  reason: unknown;
};

type RawAiChatWorkflowResult = {
  workflowId: unknown;
  workflowType: unknown;
  workflowStatus: unknown;
  traceId: unknown;
  jobId: unknown;
  provider: unknown;
  model: unknown;
  outputPayloadKind: unknown;
  outputPayload: unknown;
  errorCode: unknown;
  errorMessage: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toAdmissionStatus(value: unknown): AiChatAdmissionStatus {
  return typeof value === 'string' && ADMISSION_STATUSES.has(value as AiChatAdmissionStatus)
    ? (value as AiChatAdmissionStatus)
    : 'UNKNOWN';
}

function toWorkflowStatus(value: unknown): AiChatWorkflowStatus {
  return typeof value === 'string' && WORKFLOW_STATUSES.has(value as AiChatWorkflowStatus)
    ? (value as AiChatWorkflowStatus)
    : 'UNKNOWN';
}

function toOutputPayloadKind(value: unknown): AiChatOutputPayloadKind {
  return typeof value === 'string' && OUTPUT_PAYLOAD_KINDS.has(value as AiChatOutputPayloadKind)
    ? (value as AiChatOutputPayloadKind)
    : 'UNKNOWN';
}

function mapEnqueueResult(result: RawAiChatEnqueueResult): AiChatEnqueueResult {
  return {
    admissionStatus: toAdmissionStatus(result.admissionStatus),
    workflowId: toString(result.workflowId),
    workflowStatus: toWorkflowStatus(result.workflowStatus),
    jobId: toOptionalString(result.jobId),
    traceId: toString(result.traceId),
    asyncTaskRecordId:
      typeof result.asyncTaskRecordId === 'number' ? result.asyncTaskRecordId : null,
    reason: toOptionalString(result.reason),
  };
}

function mapWorkflowResult(result: RawAiChatWorkflowResult): AiChatWorkflowResult {
  return {
    workflowId: toString(result.workflowId),
    workflowType: toString(result.workflowType),
    workflowStatus: toWorkflowStatus(result.workflowStatus),
    traceId: toString(result.traceId),
    jobId: toOptionalString(result.jobId),
    provider: toOptionalString(result.provider),
    model: toOptionalString(result.model),
    outputPayloadKind: toOutputPayloadKind(result.outputPayloadKind),
    outputPayload: result.outputPayload,
    errorCode: toOptionalString(result.errorCode),
    errorMessage: toOptionalString(result.errorMessage),
    createdAt: toString(result.createdAt),
    updatedAt: toString(result.updatedAt),
  };
}

export function getAiChatRuntimeConfig(): AiChatRuntimeConfig {
  const configuredModel = import.meta.env.VITE_AI_CHAT_MODEL;

  return {
    provider: 'qwen',
    model:
      typeof configuredModel === 'string' && configuredModel.trim()
        ? configuredModel.trim()
        : 'qwen-plus',
  };
}

export async function queueAiChatTurn(input: {
  message: string;
  requestId: string;
  traceId: string;
}): Promise<AiChatEnqueueResult> {
  try {
    const runtimeConfig = getAiChatRuntimeConfig();
    const data = await executeGraphQL<
      { queueExampleTextRewriteWorkflow: RawAiChatEnqueueResult },
      {
        input: {
          provider: string;
          model: string;
          originalText: string;
          requirement: string;
          workflowDedupKey: string;
          traceId: string;
        };
      }
    >(QUEUE_AI_CHAT_TURN_MUTATION, {
      input: {
        provider: runtimeConfig.provider,
        model: runtimeConfig.model,
        originalText: input.message,
        requirement: AI_CHAT_REQUIREMENT,
        workflowDedupKey: `chat-preview:${input.requestId}`,
        traceId: `chat-preview:${input.traceId}`,
      },
    });

    return mapEnqueueResult(data.queueExampleTextRewriteWorkflow);
  } catch (error) {
    throw toAiChatRequestError(error, { malformedResponseIsAmbiguous: true });
  }
}

export async function queryAiChatTurn(workflowId: string): Promise<AiChatWorkflowResult | null> {
  try {
    const data = await executeGraphQL<
      { aiWorkflowDemoResult: RawAiChatWorkflowResult | null },
      { input: { workflowId: string } }
    >(AI_CHAT_WORKFLOW_RESULT_QUERY, {
      input: { workflowId },
    });

    return data.aiWorkflowDemoResult ? mapWorkflowResult(data.aiWorkflowDemoResult) : null;
  } catch (error) {
    throw toAiChatRequestError(error, { malformedResponseIsAmbiguous: false });
  }
}

export const aiChatGateway: AiChatGateway = {
  queryTurn: queryAiChatTurn,
  queueTurn: queueAiChatTurn,
};
