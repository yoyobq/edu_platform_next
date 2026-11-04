// src/features/teaching-inspection/application/progress-recovery.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import type * as Api from '../infrastructure/api';
import type * as Recovery from '../infrastructure/recovery';
import type { Prepared, SessionResult } from '../model';

export async function reconcileProgress(
  ports: {
    api: Pick<typeof Api, 'operation' | 'closeUnstartedRequest' | 'prepare'>;
    closureDetails: typeof Recovery.closureDetails;
    readRecovery: typeof Recovery.readRecovery;
    removeRecovery: typeof Recovery.removeRecovery;
  },
  accountId: number,
  resourceKey: string,
  identity: string | null | undefined,
  token: string,
  assertCurrent: () => void,
  persist: (result: SessionResult) => void,
  kind: 'PROGRESS' | 'ASSIGNMENT',
  round: number,
  onPreparedConfirmed: (requestId: string) => void,
) {
  const { api, closureDetails, readRecovery, removeRecovery } = ports;
  const entries = readRecovery(accountId);
  let currentToken = token;
  let prepared: Prepared | null = null;
  let pending = false;
  for (const entry of entries.filter(
    (item) =>
      item.kind === kind &&
      item.resourceKey === resourceKey &&
      (!item.upstreamLoginId || item.upstreamLoginId === identity),
  )) {
    assertCurrent();
    const target = {
      semesterId: entry.semesterId,
      kind: entry.kind,
      resourceKey,
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
      operation = await api.closeUnstartedRequest({ ...target, action: entry.action, ...details });
    }
    assertCurrent();
    if (['SAVED', 'VERIFIED', 'REJECTED'].includes(operation.state))
      removeRecovery(accountId, [
        entry.clientRequestId,
        ...(entry.parentRequestId ? [entry.parentRequestId] : []),
      ]);
    else if (operation.state === 'PREPARED' && entry.prepare) {
      onPreparedConfirmed(entry.clientRequestId);
      const result = await api.prepare(entry.prepare, currentToken);
      assertCurrent();
      persist(result);
      currentToken = result.upstreamSessionToken ?? currentToken;
      if (
        result.preview &&
        Date.parse(result.preview.expiresAt) > Date.now() &&
        !result.blockers.length
      ) {
        if (result.preview.round === round) prepared = result;
      } else removeRecovery(accountId, [entry.clientRequestId]);
    } else pending = true;
  }
  return { pending, prepared };
}
