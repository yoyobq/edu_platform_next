// src/labs/teaching-inspection/infrastructure/progress-recovery.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import type { Prepared, SessionResult } from '../model';

import * as api from './api';
import { closureDetails, readRecovery, removeRecovery } from './recovery';
export async function reconcileProgress(
  accountId: number,
  resourceKey: string,
  identity: string | null | undefined,
  token: string,
  assertCurrent: () => void,
  persist: (result: SessionResult) => void,
) {
  const entries = readRecovery(accountId);
  let currentToken = token;
  let prepared: Prepared | null = null;
  let pending = false;
  for (const entry of entries.filter(
    (item) =>
      item.kind === 'PROGRESS' &&
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
      const result = await api.prepare(entry.prepare, currentToken);
      assertCurrent();
      persist(result);
      currentToken = result.upstreamSessionToken ?? currentToken;
      if (
        result.preview &&
        Date.parse(result.preview.expiresAt) > Date.now() &&
        !result.blockers.length
      )
        prepared = result;
      else removeRecovery(accountId, [entry.clientRequestId]);
    } else pending = true;
  }
  return { pending, prepared };
}
