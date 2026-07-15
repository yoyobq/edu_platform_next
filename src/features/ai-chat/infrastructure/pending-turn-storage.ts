// src/features/ai-chat/infrastructure/pending-turn-storage.ts

import type { PendingAiChatTurn } from '../application/types';

const AI_CHAT_PENDING_STORAGE_PREFIX = 'edu-mate.ai-chat.pending.v1';

function getStorageKey(accountId: number): string {
  return `${AI_CHAT_PENDING_STORAGE_PREFIX}:${accountId}`;
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isPendingAiChatTurn(value: unknown, accountId: number): value is PendingAiChatTurn {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<PendingAiChatTurn>;

  return (
    record.accountId === accountId &&
    typeof record.assistantMessageId === 'string' &&
    typeof record.startedAt === 'number' &&
    Number.isFinite(record.startedAt) &&
    typeof record.userMessage === 'string' &&
    record.userMessage.length > 0 &&
    typeof record.userMessageId === 'string' &&
    typeof record.workflowId === 'string' &&
    record.workflowId.length > 0
  );
}

export function loadPendingAiChatTurn(accountId: number): PendingAiChatTurn | null {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(getStorageKey(accountId));

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (isPendingAiChatTurn(parsedValue, accountId)) {
      return parsedValue;
    }

    storage.removeItem(getStorageKey(accountId));
    return null;
  } catch {
    return null;
  }
}

export function savePendingAiChatTurn(turn: PendingAiChatTurn): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(getStorageKey(turn.accountId), JSON.stringify(turn));
  } catch {
    // Pending workflow recovery is best effort and must not block the active request.
  }
}

export function clearPendingAiChatTurn(accountId: number): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(getStorageKey(accountId));
  } catch {
    // Storage cleanup is best effort.
  }
}
