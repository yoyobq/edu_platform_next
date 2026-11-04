// src/features/teaching-inspection/application/run.spec.ts
import { expect, it, vi } from 'vitest';

import { run } from './run';
import type { RunContext } from './workbench.types';
vi.mock('@/shared/graphql', () => ({
  hasGraphQLCategory: (error: unknown, category: string) =>
    error instanceof Error && error.message === category,
}));
function fixture(size: number) {
  const rows = Array.from({ length: size }, (_, index) => ({
    key: `course-${index}:1`,
    name: '教师',
    staffId: `T${index}`,
    group: '组',
    round: 1,
    date: '2026-09-10',
    course: { resourceKey: `course-${index}` },
  }));
  const track = vi.fn();
  const prepareBatch = vi.fn(async (inputs: { resourceKey: string; round: number }[]) => {
    expect(track).toHaveBeenCalledTimes(size);
    return {
      items: inputs.map((input) => ({ ...input, failed: true, result: null })),
      upstreamSessionToken: 'fresh',
      expiresAt: null,
    };
  });
  const context = {
    running: { current: false },
    stop: { current: false },
    alive: { current: true },
    chosen: rows,
    rows,
    latestSession: {
      current: {
        session: { upstreamLoginId: 'T1', upstreamSessionToken: 'token', expiresAt: null },
        persistSessionFromResult: vi.fn(),
        openLoginModal: vi.fn(),
        openLoginModalForExpiredSession: vi.fn(),
      },
    },
    emptyChapter: () => false,
    canPrepare: () => true,
    canSubmit: () => true,
    patch: vi.fn(),
    drafts: {},
    setBusy: vi.fn(),
    setActivity: vi.fn(),
    setError: vi.fn(),
    setProgress: vi.fn(),
    setDrafts: vi.fn(),
    setSelected: vi.fn(),
    semesterId: 1,
    kind: 'ASSIGNMENT',
    isIndividual: true,
    isProgress: false,
    account: { accountId: 1, displayName: '教师' },
    location: {},
    retirePreparationTracking: vi.fn(),
    track,
    forget: vi.fn(),
    rememberPreparation: vi.fn(),
    reload: vi.fn(async () => {}),
    recoveries: vi.fn(),
    flow: { prepare: vi.fn(), save: vi.fn() },
    api: {
      detail: vi.fn(async (_semester: number, resourceKey: string) => ({
        resourceKey,
        schedule: { dates: ['2026-09-10'], version: 1 },
      })),
      prepareBatch,
    },
    newRequestId: (() => {
      let count = 0;
      return () => `request-${count++}`;
    })(),
    waitBetweenItems: vi.fn(async () => {}),
  } as unknown as RunContext;
  return { context, prepareBatch, track };
}
it('31项在持久化全部请求标识后一次发送，未知结果保留原请求', async () => {
  const { context, prepareBatch, track } = fixture(31);
  await run(context, false);
  expect(prepareBatch).toHaveBeenCalledTimes(1);
  expect(prepareBatch.mock.calls[0][0]).toHaveLength(31);
  expect(new Set(track.mock.calls.map(([entry]) => entry.clientRequestId)).size).toBe(31);
  expect(context.forget).not.toHaveBeenCalled();
  expect(context.flow.save).not.toHaveBeenCalled();
  expect(context.latestSession.current.persistSessionFromResult).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ upstreamSessionToken: 'fresh' }),
  );
  expect(context.setBusy).toHaveBeenLastCalledWith(false);
});
it('发送前停止不派发准备，且不产生恢复记录', async () => {
  const { context, prepareBatch, track } = fixture(2);
  vi.mocked(context.api.detail).mockImplementation(async () => {
    context.stop.current = true;
    return { resourceKey: 'course-0', schedule: { dates: ['2026-09-10'], version: 1 } } as Awaited<
      ReturnType<RunContext['api']['detail']>
    >;
  });
  await run(context, false);
  expect(prepareBatch).not.toHaveBeenCalled();
  expect(track).not.toHaveBeenCalled();
});
it('批次认证失败只提示重连，不自动重发或清除恢复记录', async () => {
  const { context, prepareBatch } = fixture(2);
  prepareBatch.mockRejectedValue(new Error('UNAUTHENTICATED'));
  await run(context, false);
  expect(prepareBatch).toHaveBeenCalledTimes(1);
  expect(context.latestSession.current.openLoginModalForExpiredSession).toHaveBeenCalledTimes(1);
  expect(context.forget).not.toHaveBeenCalled();
  expect(context.flow.save).not.toHaveBeenCalled();
});
