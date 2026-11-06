// src/labs/student-registration-cards/infrastructure/card-batch-adapter.ts
import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import {
  type BatchGeneration,
  BatchSessionExpiredError,
  type CardBatchOperations,
} from '../application/card-batch.types';

import { CardSessionExpiredError, fetchCard, generateCard, type GeneratedCard } from './api';

export function mapBatchGeneration(response: GeneratedCard): BatchGeneration {
  const warnings = [...response.warningCodes];
  if (response.status === 'BLOCKED' || !response.canGenerate || !response.downloadToken) {
    return { kind: 'blocked', warnings, reasons: [...response.issueCodes] };
  }
  const expiresAtMs = response.expiresAt ? Date.parse(response.expiresAt) : NaN;
  return {
    kind: 'generated',
    warnings,
    document: {
      token: response.downloadToken,
      fileName: response.fileName?.trim() || null,
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
    },
  };
}

async function withSessionError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof CardSessionExpiredError ||
      hasGraphQLCategory(error, 'UNAUTHENTICATED') ||
      (isGraphQLIngressError(error) && (error.type === 'auth' || error.statusCode === 401))
    ) {
      throw new BatchSessionExpiredError('登录已失效', { cause: error });
    }
    throw error;
  }
}

export const cardBatchOperations: CardBatchOperations = {
  generate: (studentId) =>
    withSessionError(async () => mapBatchGeneration(await generateCard(studentId))),
  fetch: (document) => withSessionError(() => fetchCard({ downloadToken: document.token })),
};
