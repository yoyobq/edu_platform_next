// src/labs/teaching-inspection/infrastructure/lesson-reread.spec.ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import * as api from './api';
import { reconcileLessonSaves } from './lesson-reread';
import { putRecovery, readRecovery } from './recovery';
vi.mock('./api', () => ({ operation: vi.fn(), closeUnstartedRequest: vi.fn() }));
vi.mock('@/shared/graphql', () => ({
  hasGraphQLCategory: (cause: unknown, code: string) =>
    cause instanceof Error && cause.message === code,
}));
const entry = {
  accountId: 1,
  semesterId: 2,
  kind: 'LESSON_PLAN' as const,
  resourceKey: '2:c',
  action: 'SAVE' as const,
  clientRequestId: 'save-request',
  upstreamLoginId: 'T1',
  round: 1,
  checkDate: '2026-10-01',
};
const operation = {
  id: 'op',
  accountId: 1,
  requestId: 'save-request',
  action: 'SAVE',
  round: 1,
  checkDate: '2026-10-01',
  state: 'UNKNOWN',
  previewId: null,
};
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.resetAllMocks();
  putRecovery(entry);
});
afterEach(() => vi.unstubAllGlobals());
it('原请求未找到时先通过事务封存，按白名单发送协议字段', async () => {
  vi.mocked(api.operation).mockRejectedValue(new Error('NOT_FOUND'));
  vi.mocked(api.closeUnstartedRequest).mockResolvedValue({ ...operation, state: 'REJECTED' });
  expect(await reconcileLessonSaves(1, '2:c', 'T1', () => {})).toBe(false);
  expect(api.closeUnstartedRequest).toHaveBeenCalledWith({
    semesterId: 2,
    kind: 'LESSON_PLAN',
    resourceKey: '2:c',
    clientRequestId: 'save-request',
    action: 'SAVE',
    round: 1,
    checkDate: '2026-10-01',
  });
  expect(readRecovery(1)).toEqual([]);
});
it.each(['UNKNOWN', 'DISPATCHING'])('%s保持阻断，不关闭、不重发', async (state) => {
  vi.mocked(api.operation).mockResolvedValue({ ...operation, state });
  expect(await reconcileLessonSaves(1, '2:c', 'T1', () => {})).toBe(true);
  expect(api.closeUnstartedRequest).not.toHaveBeenCalled();
  expect(readRecovery(1)).toHaveLength(1);
});
it('未找到且元数据缺失时保留阻断，不猜测日期轮次', async () => {
  putRecovery({ ...entry, round: undefined, checkDate: undefined });
  vi.mocked(api.operation).mockRejectedValue(new Error('NOT_FOUND'));
  expect(await reconcileLessonSaves(1, '2:c', 'T1', () => {})).toBe(true);
  expect(api.closeUnstartedRequest).not.toHaveBeenCalled();
});
it('未找到后封存查到迟到发送意图时保持阻断', async () => {
  vi.mocked(api.operation).mockRejectedValue(new Error('NOT_FOUND'));
  vi.mocked(api.closeUnstartedRequest).mockResolvedValue(operation);
  expect(await reconcileLessonSaves(1, '2:c', 'T1', () => {})).toBe(true);
  expect(readRecovery(1)).toHaveLength(1);
});
it('身份变化时不删除原请求', async () => {
  vi.mocked(api.operation).mockResolvedValue({ ...operation, state: 'SAVED' });
  const guard = vi
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementation(() => {
      throw new Error('identity');
    });
  await expect(reconcileLessonSaves(1, '2:c', 'T1', guard)).rejects.toThrow('identity');
  expect(readRecovery(1)).toHaveLength(1);
});
