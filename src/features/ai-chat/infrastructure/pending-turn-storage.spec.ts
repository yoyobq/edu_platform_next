// src/features/ai-chat/infrastructure/pending-turn-storage.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingAiChatTurn,
  loadPendingAiChatTurn,
  savePendingAiChatTurn,
} from './pending-turn-storage';

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('pending ai chat turn storage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: createStorage() });
  });

  it('stores pending workflow recovery data per account and clears terminal turns', () => {
    const pendingTurn = {
      accountId: 9527,
      assistantMessageId: 'system-1',
      startedAt: 1_752_364_800_000,
      userMessage: '请解释这段代码',
      userMessageId: 'user-1',
      workflowId: 'workflow-1',
    };

    savePendingAiChatTurn(pendingTurn);

    expect(loadPendingAiChatTurn(9527)).toEqual(pendingTurn);
    expect(loadPendingAiChatTurn(1002)).toBeNull();

    clearPendingAiChatTurn(9527);
    expect(loadPendingAiChatTurn(9527)).toBeNull();
  });

  it('removes malformed recovery data', () => {
    window.localStorage.setItem(
      'edu-mate.ai-chat.pending.v1:9527',
      JSON.stringify({ accountId: 9527, workflowId: '' }),
    );

    expect(loadPendingAiChatTurn(9527)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
