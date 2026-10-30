// src/labs/teaching-inspection/infrastructure/lesson-reread.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import * as api from './api';
import { closureDetails, discardLessonPreparations, putRecovery, removeRecovery } from './recovery';

/** Resolve local SAVE tracking without ever resending an upstream write. */
export async function reconcileLessonSaves(
  accountId: number,
  resourceKey: string,
  upstreamLoginId: string | null | undefined,
  assertCurrent: () => void,
) {
  const entries = discardLessonPreparations(accountId);
  let pending = false;
  for (const entry of entries.filter(
    (value) =>
      value.kind === 'LESSON_PLAN' &&
      value.action === 'SAVE' &&
      value.resourceKey === resourceKey &&
      (!value.upstreamLoginId || value.upstreamLoginId === upstreamLoginId),
  )) {
    assertCurrent();
    const target = {
      semesterId: entry.semesterId,
      kind: entry.kind,
      resourceKey: entry.resourceKey,
      clientRequestId: entry.clientRequestId,
    };
    let operation;
    try {
      operation = await api.operation(target);
    } catch (cause) {
      assertCurrent();
      if (!hasGraphQLCategory(cause, 'NOT_FOUND')) throw cause;
      const details = closureDetails(entry, entries);
      if (!details) {
        pending = true;
        continue;
      }
      operation = await api.closeUnstartedRequest({ ...target, action: 'SAVE', ...details });
    }
    assertCurrent();
    if (['SAVED', 'VERIFIED', 'REJECTED'].includes(operation.state))
      removeRecovery(accountId, [entry.clientRequestId]);
    else {
      pending = true;
      putRecovery({
        ...entry,
        operationId: operation.id,
        round: operation.round,
        checkDate: operation.checkDate,
      });
    }
  }
  return pending;
}
