// src/features/ai-chat/infrastructure/browser-session-runtime.ts

import type { AiChatSessionRuntime } from '../application/ports';

function createId(prefix: string): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomSuffix}`;
}

export const browserAiChatSessionRuntime: AiChatSessionRuntime = {
  createId,
  now: () => Date.now(),
  random: () => Math.random(),
  schedule: (callback, delayMs) => {
    const timer = window.setTimeout(callback, delayMs);

    return () => window.clearTimeout(timer);
  },
};
