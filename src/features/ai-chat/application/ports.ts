// src/features/ai-chat/application/ports.ts

import type { AiChatEnqueueResult, AiChatWorkflowResult, PendingAiChatTurn } from './types';

export type QueueAiChatTurnInput = {
  message: string;
  requestId: string;
  traceId: string;
};

export type AiChatGateway = {
  queryTurn: (workflowId: string) => Promise<AiChatWorkflowResult | null>;
  queueTurn: (input: QueueAiChatTurnInput) => Promise<AiChatEnqueueResult>;
};

export type AiChatPendingTurnStore = {
  clear: (accountId: number) => void;
  load: (accountId: number) => PendingAiChatTurn | null;
  save: (turn: PendingAiChatTurn) => void;
};

export type AiChatSessionRuntime = {
  createId: (prefix: string) => string;
  now: () => number;
  random: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
};
