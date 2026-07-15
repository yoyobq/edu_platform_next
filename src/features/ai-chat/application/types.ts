// src/features/ai-chat/application/types.ts

export type AiChatAdmissionStatus =
  | 'ADMISSION_WAITING'
  | 'CONFLICT'
  | 'EXISTING_ACTIVE'
  | 'QUEUED'
  | 'STALE_QUEUED'
  | 'UNKNOWN';

export type AiChatWorkflowStatus =
  | 'ADMISSION_WAITING'
  | 'CANCELLED'
  | 'CREATED'
  | 'FAILED'
  | 'PROCESSING'
  | 'QUEUED'
  | 'SUCCEEDED'
  | 'UNKNOWN';

export type AiChatOutputPayloadKind = 'NONE' | 'PRESENT' | 'PURGED' | 'UNKNOWN';

export type AiChatTurnStatus =
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'generating'
  | 'queued'
  | 'waiting'
  | 'waiting_for_service';

export type AiChatEnqueueResult = {
  admissionStatus: AiChatAdmissionStatus;
  workflowId: string;
  workflowStatus: AiChatWorkflowStatus;
  jobId: string | null;
  traceId: string;
  asyncTaskRecordId: number | null;
  reason: string | null;
};

export type AiChatWorkflowResult = {
  workflowId: string;
  workflowType: string;
  workflowStatus: AiChatWorkflowStatus;
  traceId: string;
  jobId: string | null;
  provider: string | null;
  model: string | null;
  outputPayloadKind: AiChatOutputPayloadKind;
  outputPayload: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiChatTurnPresentation = {
  content: string;
  outcome: 'error' | 'success' | null;
  status: AiChatTurnStatus;
  terminal: boolean;
};

export type AiChatRuntimeConfig = {
  model: string;
  provider: 'qwen';
};

export type AiChatSessionMessage = {
  content: string;
  id: string;
  role: 'assistant' | 'user';
  status?: AiChatTurnStatus;
};

export type AiChatSessionState = {
  errorMessage: string | null;
  messages: AiChatSessionMessage[];
  status: 'error' | 'idle' | 'loading' | 'ready';
};

export type PendingAiChatTurnBase = {
  accountId: number;
  assistantMessageId: string;
  startedAt: number;
  userMessage: string;
  userMessageId: string;
};

export type PendingAiChatAdmissionTurn = PendingAiChatTurnBase & {
  phase: 'admission';
  requestId: string;
  traceId: string;
};

export type PendingAiChatWorkflowTurn = PendingAiChatTurnBase & {
  phase: 'workflow';
  workflowId: string;
};

export type PendingAiChatTurn = PendingAiChatAdmissionTurn | PendingAiChatWorkflowTurn;
