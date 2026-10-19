// src/labs/teaching-inspection/infrastructure/recovery.ts
import type { PrepareInput, Target } from '../model';
export type RecoveryEntry = Target & {
  accountId: number;
  action: 'PREPARE' | 'SAVE';
  upstreamLoginId?: string | null;
  clientRequestId: string;
  operationId?: string;
  prepare?: PrepareInput;
  parentRequestId?: string;
  round?: number;
  checkDate?: string;
};
const key = (id: number) => `teaching-inspection.recovery.v1.${id}`;
function valid(value: unknown, accountId: number): value is RecoveryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecoveryEntry>;
  return (
    entry.accountId === accountId &&
    (entry.upstreamLoginId == null || typeof entry.upstreamLoginId === 'string') &&
    Number.isInteger(entry.semesterId) &&
    typeof entry.resourceKey === 'string' &&
    ['LESSON_PLAN', 'PROGRESS', 'ASSIGNMENT'].includes(entry.kind ?? '') &&
    typeof entry.clientRequestId === 'string' &&
    ['PREPARE', 'SAVE'].includes(entry.action ?? '') &&
    (entry.action !== 'PREPARE' ||
      Boolean(
        entry.prepare &&
        entry.prepare.clientRequestId === entry.clientRequestId &&
        entry.prepare.resourceKey === entry.resourceKey &&
        entry.prepare.kind === entry.kind &&
        entry.prepare.semesterId === entry.semesterId &&
        Number.isInteger(entry.prepare.scheduleVersion) &&
        [1, 2, 3].includes(entry.prepare.round) &&
        typeof entry.prepare.checkDate === 'string',
      ))
  );
}
export function readRecovery(
  accountId: number,
  storage: Storage = window.sessionStorage,
): RecoveryEntry[] {
  const raw = storage.getItem(key(accountId));
  if (!raw) return [];
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || !values.every((value) => valid(value, accountId)))
    throw new Error('检查恢复记录无法读取，请保留当前标签页并联系管理员。');
  return values;
}
export function putRecovery(entry: RecoveryEntry, storage: Storage = window.sessionStorage) {
  const entries = readRecovery(entry.accountId, storage).filter(
    (item) => item.clientRequestId !== entry.clientRequestId,
  );
  // Explicit projection keeps credentials, scores and material out of browser recovery storage.
  const input = entry.prepare;
  entries.push({
    accountId: entry.accountId,
    action: entry.action,
    semesterId: entry.semesterId,
    kind: entry.kind,
    resourceKey: entry.resourceKey,
    clientRequestId: entry.clientRequestId,
    operationId: entry.operationId,
    parentRequestId: entry.parentRequestId,
    upstreamLoginId: entry.upstreamLoginId,
    round: entry.round,
    checkDate: entry.checkDate,
    prepare: input
      ? {
          semesterId: input.semesterId,
          kind: input.kind,
          resourceKey: input.resourceKey,
          clientRequestId: input.clientRequestId,
          round: input.round,
          checkDate: input.checkDate,
          scheduleVersion: input.scheduleVersion,
          retryOfOperationId: input.retryOfOperationId,
        }
      : undefined,
  });
  storage.setItem(key(entry.accountId), JSON.stringify(entries));
}
/** Legacy save entries can recover their original round/date from the parent preparation. */
export function closureDetails(entry: RecoveryEntry, entries: RecoveryEntry[]) {
  const source =
    entry.prepare ??
    (entry.round != null && entry.checkDate != null
      ? entry
      : entries.find(
          (parent) =>
            parent.clientRequestId === entry.parentRequestId &&
            parent.accountId === entry.accountId &&
            parent.semesterId === entry.semesterId &&
            parent.kind === entry.kind &&
            parent.resourceKey === entry.resourceKey,
        )?.prepare);
  if (
    !source ||
    ![1, 2, 3].includes(source.round ?? 0) ||
    typeof source.checkDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(source.checkDate)
  )
    return null;
  return { round: source.round!, checkDate: source.checkDate };
}
export function removeRecovery(
  accountId: number,
  ids: string[],
  storage: Storage = window.sessionStorage,
) {
  storage.setItem(
    key(accountId),
    JSON.stringify(
      readRecovery(accountId, storage).filter((entry) => !ids.includes(entry.clientRequestId)),
    ),
  );
}
