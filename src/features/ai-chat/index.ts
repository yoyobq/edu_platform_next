// src/features/ai-chat/index.ts

import { AiChatSessionController } from './application/session-controller';
import { aiChatGateway } from './infrastructure/ai-chat-api';
import { browserAiChatSessionRuntime } from './infrastructure/browser-session-runtime';
import { aiChatPendingTurnStore } from './infrastructure/pending-turn-storage';
import { createUseAiChatSession } from './ui/use-ai-chat-session';

export type {
  AiChatSessionMessage,
  AiChatSessionState,
  AiChatTurnStatus,
} from './application/types';
export { AI_CHAT_INPUT_MAX_LENGTH } from './application/workflow';

export const useAiChatSession = createUseAiChatSession(
  () =>
    new AiChatSessionController({
      gateway: aiChatGateway,
      pendingTurnStore: aiChatPendingTurnStore,
      runtime: browserAiChatSessionRuntime,
    }),
);
