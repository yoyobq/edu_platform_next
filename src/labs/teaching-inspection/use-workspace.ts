// src/labs/teaching-inspection/use-workspace.ts
import { useCallback, useEffect, useRef, useState } from 'react';

import type { useUpstreamLoginModalController } from '@/entities/upstream-session';

import { hasGraphQLCategory } from '@/shared/graphql';

import * as api from './infrastructure/api';
import type { readLocation } from './infrastructure/location';
import type { Status, Workspace } from './model';

type SessionController = ReturnType<typeof useUpstreamLoginModalController<never>>;
export type InspectionSyncState = 'pending' | 'synced' | 'failed' | 'unconnected' | 'blocked';
export const syncText = (state: InspectionSyncState) =>
  ({
    pending: '正在同步上游，以下为上次记录',
    synced: '已同步上游',
    failed: '同步未完成，以下为上次记录',
    unconnected: '连接校园网后自动同步，以下为本地记录',
    blocked: '课程依据不完整，暂不能同步',
  })[state];

export function useInspectionWorkspace(
  location: ReturnType<typeof readLocation>,
  session: SessionController,
) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncStates, setSyncStates] = useState<Record<string, InspectionSyncState>>({});
  const controller = useRef(session);
  const serial = useRef(0);
  useEffect(() => {
    controller.current = session;
  }, [session]);
  const markSynced = useCallback((resourceKey: string, status: Status) => {
    setSyncStates((old) => ({
      ...old,
      [resourceKey]: status.state === 'TRUSTED' ? 'synced' : 'failed',
    }));
  }, []);
  const refresh = useCallback(
    async (syncUpstream = false) => {
      const id = ++serial.current;
      const active = () => serial.current === id;
      setLoading(true);
      setError('');
      try {
        let result = await api.loadWorkspace({
          departmentId: location.departmentId,
          semesterId: location.semesterId!,
          kind: location.type.kind,
          page: location.page,
          limit: location.pageSize,
          teacherId: location.teacherId,
          keyword: location.keyword,
        });
        if (!active()) return result.resources;
        setWorkspace(result);
        if (!syncUpstream) return result.resources;
        let current = controller.current.session;
        setSyncStates(
          Object.fromEntries(
            result.resources.map((resource) => [
              resource.resourceKey,
              resource.blockers.some((blocker) =>
                ['MISSING_MAPPING', 'OUTSIDE_SCOPE'].includes(blocker),
              )
                ? 'blocked'
                : current
                  ? 'pending'
                  : 'unconnected',
            ]),
          ),
        );
        if (!current) return result.resources;
        // Serial reads preserve rolling credentials and avoid overlapping observations per resource.
        for (const resource of result.resources) {
          if (!active()) break;
          if (
            resource.blockers.some((blocker) =>
              ['MISSING_MAPPING', 'OUTSIDE_SCOPE'].includes(blocker),
            )
          )
            continue;
          try {
            const observed = await api.refreshStatus(
              {
                semesterId: location.semesterId!,
                kind: location.type.kind,
                resourceKey: resource.resourceKey,
              },
              current.upstreamSessionToken,
            );
            if (!active()) break;
            current = controller.current.persistSessionFromResult(current, observed);
            result = {
              ...result,
              resources: result.resources.map((item) =>
                item.resourceKey === resource.resourceKey
                  ? { ...item, schedule: observed.schedule, status: observed.status }
                  : item,
              ),
            };
            setWorkspace(result);
            markSynced(resource.resourceKey, observed.status);
          } catch (cause) {
            if (!active()) break;
            setSyncStates((old) => ({ ...old, [resource.resourceKey]: 'failed' }));
            setError(
              `${resource.courseName}：${cause instanceof Error ? cause.message : '同步失败'}。本地显示上次记录，可重新读取工作区重试。`,
            );
            if (hasGraphQLCategory(cause, 'UNAUTHENTICATED')) {
              controller.current.openLoginModalForExpiredSession({
                session: current,
                loginError: '校园网会话已失效，重新连接后将自动同步检查状态。',
              });
              break;
            }
          }
        }
        return result.resources;
      } catch (cause) {
        if (active()) setError(cause instanceof Error ? cause.message : '工作区读取失败');
        throw cause;
      } finally {
        if (active()) setLoading(false);
      }
    },
    [location, markSynced],
  );
  const invalidate = useCallback(() => {
    serial.current++;
  }, []);
  useEffect(() => {
    void refresh(true).catch(() => undefined);
    return invalidate;
  }, [refresh, invalidate]);
  return { workspace, error, loading, refresh, syncStates, markSynced };
}
