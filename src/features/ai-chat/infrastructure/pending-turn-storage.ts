// src/features/ai-chat/infrastructure/pending-turn-storage.ts

import type { AiChatPendingTurnStore } from '../application/ports';
import type {
  PendingAiChatAdmissionTurn,
  PendingAiChatTurn,
  PendingAiChatWorkflowTurn,
} from '../application/types';

const AI_CHAT_PENDING_STORAGE_PREFIX = 'edu-mate.ai-chat.pending.v2';
const LEGACY_AI_CHAT_PENDING_STORAGE_PREFIX = 'edu-mate.ai-chat.pending.v1';

function getStorageKey(accountId: number, prefix = AI_CHAT_PENDING_STORAGE_PREFIX): string {
  return `${prefix}:${accountId}`;
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readPendingAiChatTurn(value: unknown, accountId: number): PendingAiChatTurn | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  const hasCommonFields =
    record.accountId === accountId &&
    typeof record.assistantMessageId === 'string' &&
    typeof record.startedAt === 'number' &&
    Number.isFinite(record.startedAt) &&
    typeof record.userMessage === 'string' &&
    record.userMessage.length > 0 &&
    typeof record.userMessageId === 'string';

  if (!hasCommonFields) {
    return null;
  }

  if (
    record.phase === 'admission' &&
    typeof record.requestId === 'string' &&
    record.requestId.length > 0 &&
    typeof record.traceId === 'string' &&
    record.traceId.length > 0
  ) {
    return record as PendingAiChatAdmissionTurn;
  }

  if (
    (record.phase === 'workflow' || record.phase === undefined) &&
    typeof record.workflowId === 'string' &&
    record.workflowId.length > 0
  ) {
    return { ...record, phase: 'workflow' } as PendingAiChatWorkflowTurn;
  }

  return null;
}

export function loadPendingAiChatTurn(accountId: number): PendingAiChatTurn | null {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const storageKey = getStorageKey(accountId);
    const legacyStorageKey = getStorageKey(accountId, LEGACY_AI_CHAT_PENDING_STORAGE_PREFIX);
    const rawValue = storage.getItem(storageKey) ?? storage.getItem(legacyStorageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    const pendingTurn = readPendingAiChatTurn(parsedValue, accountId);

    if (pendingTurn) {
      if (!storage.getItem(storageKey)) {
        storage.setItem(storageKey, JSON.stringify(pendingTurn));
        storage.removeItem(legacyStorageKey);
      }
      return pendingTurn;
    }

    storage.removeItem(storageKey);
    storage.removeItem(legacyStorageKey);
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
    storage.removeItem(getStorageKey(accountId, LEGACY_AI_CHAT_PENDING_STORAGE_PREFIX));
  } catch {
    // Storage cleanup is best effort.
  }
}

export const aiChatPendingTurnStore: AiChatPendingTurnStore = {
  clear: clearPendingAiChatTurn,
  load: loadPendingAiChatTurn,
  save: savePendingAiChatTurn,
};
