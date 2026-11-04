// src/features/teaching-inspection/application/lesson-reread.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import type * as Api from '../infrastructure/api';
import type * as Recovery from '../infrastructure/recovery';

/** Resolve local SAVE tracking without ever resending an upstream write. */
export async function reconcileLessonSaves(
  ports: {
    api: Pick<typeof Api, 'operation' | 'closeUnstartedRequest'>;
    closureDetails: typeof Recovery.closureDetails;
    discardLessonPreparations: typeof Recovery.discardLessonPreparations;
    putRecovery: typeof Recovery.putRecovery;
    removeRecovery: typeof Recovery.removeRecovery;
  },
  accountId: number,
  resourceKey: string,
  upstreamLoginId: string | null | undefined,
  assertCurrent: () => void,
) {
  const { api, closureDetails, discardLessonPreparations, putRecovery, removeRecovery } = ports;
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
