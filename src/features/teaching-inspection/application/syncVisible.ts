// src/features/teaching-inspection/application/syncVisible.ts
import { hasGraphQLCategory } from '@/shared/graphql';

import type { RunContext } from './workbench.types';
export async function syncVisible(context: RunContext) {
  const {
    running,
    alive,
    latestSession,
    rows,
    setBusy,
    setActivity,
    setError,
    setProgress,
    setDrafts,
    setSelected,
    semesterId,
    kind,
    location,
    reload,
    recoveries,
    flow,
  } = context;
  if (running.current) return;
  const resourceKeys = rows.flatMap((row) => (row.course ? [row.course.resourceKey] : []));
  if (!resourceKeys.length) return;
  const controller = latestSession.current;
  const current = controller.session;
  if (!current) {
    controller.openLoginModal();
    return;
  }
  const sameIdentity = () =>
    alive.current && latestSession.current.session?.upstreamLoginId === current.upstreamLoginId;
  running.current = true;
  setBusy(true);
  setActivity({ kind: 'batch-sync' });
  setError('');
  setProgress({
    done: 0,
    total: resourceKeys.length,
    success: 0,
    failed: 0,
    unknown: 0,
    label: '正在同步数据',
  });
  setSelected([]);
  setDrafts({});
  try {
    const result = await flow.syncData(
      { semesterId, kind, departmentId: location.departmentId, resourceKeys },
      current.upstreamSessionToken,
    );
    if (!sameIdentity()) return;
    controller.persistSessionFromResult(current, result);
    const failed = result.items.filter((item) => item.failed).length;
    setProgress({
      done: result.items.length,
      total: resourceKeys.length,
      success: result.items.length - failed,
      failed,
      unknown: 0,
      label: '数据同步完成',
    });
    if (failed) setError(`${failed} 门课程尚未完成同步，请逐行同步核对。`);
  } catch (cause) {
    if (sameIdentity()) {
      setError(cause instanceof Error ? cause.message : '批量同步失败，请重新同步数据');
      if (hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
        controller.openLoginModalForExpiredSession({
          session: current,
          loginError: '校园网会话已失效，请重新连接后同步数据。',
        });
    }
  } finally {
    if (sameIdentity()) await reload();
    running.current = false;
    if (alive.current) {
      setBusy(false);
      setActivity(null);
      recoveries();
    }
  }
}
