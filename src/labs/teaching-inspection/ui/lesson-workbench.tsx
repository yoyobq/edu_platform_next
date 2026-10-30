// src/labs/teaching-inspection/ui/lesson-workbench.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Drawer, Empty, Input, Select, Space, Table, Tabs, Tag } from 'antd';
import { Modal } from 'antd';
import { useBeforeUnload, useBlocker } from 'react-router';

import type {
  UpstreamAccountIdentity,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { hasGraphQLCategory } from '@/shared/graphql';
import { useWidthBand } from '@/shared/ui/responsive-layout';

import * as flow from '../infrastructure/api';
import * as api from '../infrastructure/lesson-api';
import type { readLocation } from '../infrastructure/location';
import { dueRound } from '../lesson-policy';
import type { TimeGroup } from '../model';
import { blockerText, groupNames } from '../model';

import { InspectionDetail } from './inspection-detail';
type Controller = ReturnType<typeof useUpstreamLoginModalController<never>>;
export function LessonWorkbench({
  location,
  onLocation,
  account,
  session,
}: {
  location: ReturnType<typeof readLocation>;
  onLocation: (value: ReturnType<typeof readLocation>) => void;
  account: UpstreamAccountIdentity;
  session: Controller;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand(container, [{ max: 767, value: 'compact' }], 'wide');
  const [work, setWork] = useState<api.LessonOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [countTime, setCountTime] = useState('');
  const group = (location.timeGroup ?? 'FULL') as TimeGroup;
  const [rounds, setRounds] = useState<Partial<Record<TimeGroup, number>>>({});
  const [customRounds, setCustomRounds] = useState<Record<string, number>>({});
  const [teacher, setTeacher] = useState(location.teacherId ?? '');
  const [keyword, setKeyword] = useState(location.keyword ?? '');
  const [selected, setSelected] = useState<string | null>(location.resourceKey ?? null);
  const [resource, setResource] = useState<api.LessonResource | null>(null);
  const [initialRound, setInitialRound] = useState<number>();
  const [dirty, setDirty] = useState(false);
  const [historySynced, setHistorySynced] = useState(false);
  const blocker = useBlocker(dirty);
  const serial = useRef(0);
  const countSerial = useRef(0);
  const [closePending, setClosePending] = useState(false);
  const liveSession = useRef(session);
  useEffect(() => {
    liveSession.current = session;
  }, [session]);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty],
    ),
  );
  const semesterId = location.semesterId!;
  const reload = useCallback(async () => {
    const id = ++serial.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.overview(semesterId, location.departmentId);
      if (id === serial.current) setWork(result);
    } catch (cause) {
      if (id === serial.current)
        setError(cause instanceof Error ? cause.message : '本地总览读取失败');
    } finally {
      if (id === serial.current) setLoading(false);
    }
  }, [semesterId, location.departmentId]);
  useEffect(() => {
    void reload();
    const counter = serial;
    return () => {
      counter.current++;
    };
  }, [reload]);
  useEffect(() => {
    countSerial.current++;
    setCounts({});
    setCountTime('');
    setSyncing(false);
    setResource(null);
    setDirty(false);
    const counter = countSerial;
    return () => {
      counter.current++;
    };
  }, [session.session?.upstreamLoginId, location.departmentId]);
  const patch = useCallback((next: api.LessonResource) => {
    setResource(next);
    setWork((old) =>
      old
        ? {
            ...old,
            resources: old.resources.map((row) =>
              row.resourceKey === next.resourceKey ? next : row,
            ),
          }
        : old,
    );
  }, []);
  useEffect(() => {
    let active = true;
    if (!selected) {
      setResource(null);
      return;
    }
    setLoading(true);
    setError('');
    setHistorySynced(false);
    const controller = liveSession.current;
    void (async () => {
      try {
        const current = controller.session;
        if (current) {
          try {
            const observed = await flow.refreshStatus(
              { semesterId, kind: 'LESSON_PLAN', resourceKey: selected },
              current.upstreamSessionToken,
            );
            if (!active) return;
            controller.persistSessionFromResult(current, observed);
            setHistorySynced(observed.status.state === 'TRUSTED');
          } catch (cause) {
            if (!active) return;
            setError(cause instanceof Error ? cause.message : '历史核对失败，以下为本地记录');
            if (hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
              controller.openLoginModalForExpiredSession({
                session: current,
                loginError: '校园网会话已失效，请重新连接后核对',
              });
          }
        }
        const result = await api.detail(semesterId, selected);
        if (active) patch(result);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '课程读取失败');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected, semesterId, patch, session.session?.upstreamLoginId]);
  async function refreshCourse() {
    if (!selected) return [];
    const result = await api.detail(semesterId, selected);
    patch(result);
    setCounts((old) => {
      const next = { ...old };
      delete next[selected];
      return next;
    });
    return [result];
  }
  async function sync() {
    const current = session.session;
    if (!current) {
      session.openLoginModal();
      return;
    }
    if (!work) return;
    const id = countSerial.current;
    setSyncing(true);
    setError('');
    try {
      const result = await api.syncCounts(
        semesterId,
        work.departmentId,
        current.upstreamSessionToken,
      );
      if (id !== countSerial.current) return;
      session.persistSessionFromResult(current, result);
      setCounts(Object.fromEntries(result.counts.map((row) => [row.resourceKey, row.count])));
      setCountTime(result.observedAt);
    } catch (cause) {
      if (id !== countSerial.current) return;
      setError(cause instanceof Error ? cause.message : '数量同步失败，保留原记录');
      if (hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
        session.openLoginModalForExpiredSession({
          session: current,
          loginError: '校园网会话已失效，请重新连接',
        });
    } finally {
      if (id === countSerial.current) setSyncing(false);
    }
  }
  if (!work)
    return (
      <div ref={container}>
        <Space orientation="vertical">
          <Button loading={loading} onClick={() => void reload()}>
            重新读取本地数据
          </Button>
          {error ? (
            <Alert type="error" title={error} />
          ) : (
            <Empty description="正在读取本地教案总览" />
          )}
        </Space>
      </div>
    );
  const plan = work.groupPlans.find((item) => item.group === group);
  const round = location.round ?? rounds[group] ?? dueRound(plan?.dates ?? [], work.today);
  const classified = work.resources.filter((row) => (row.grouping?.group ?? 'CUSTOM') === group);
  const groups = [...new Map(work.roster.map((member) => [member.groupId, member.groupName]))];
  const coursesFor = (staffId: string) =>
    classified.filter(
      (row) => row.teacherIds.includes(staffId) && (!keyword || row.courseName.includes(keyword)),
    );
  function course(row: api.LessonSummary) {
    const activeRound =
      group === 'CUSTOM'
        ? (customRounds[row.resourceKey] ?? dueRound(row.schedule.dates, work!.today))
        : round;
    const date = row.schedule.dates[activeRound - 1];
    const status = row.status.rounds[activeRound - 1];
    return (
      <div key={row.resourceKey} className="flex flex-col gap-2 py-2">
        <strong>{row.courseName}</strong>
        {!row.timePlan.confirmed && <Tag>时间待确认</Tag>}
        {row.grouping?.needsReview && <small>{row.grouping.reason}</small>}
        {group === 'CUSTOM' && (
          <Tabs
            size="small"
            activeKey={String(activeRound)}
            onChange={(key) =>
              setCustomRounds((old) => ({ ...old, [row.resourceKey]: Number(key) }))
            }
            items={[1, 2, 3].map((value) => ({
              key: String(value),
              label: `第${value}次 · ${row.schedule.dates[value - 1] ?? '未确认'}`,
            }))}
          />
        )}
        <Space wrap>
          <span>
            第{activeRound}次 · {date ?? '日期未确认'}
          </span>
          <Tag>
            {!date || date > work!.today ? '未到期' : status?.covered ? '本地已覆盖' : '待核对'}
          </Tag>
          <Button
            type="link"
            disabled={loading || dirty}
            onClick={() => {
              setInitialRound(activeRound);
              setResource(null);
              setSelected(row.resourceKey);
            }}
          >
            查看检查
          </Button>
        </Space>
        <small>
          数量：
          {Object.hasOwn(counts, row.resourceKey)
            ? (counts[row.resourceKey] ?? '未知')
            : (row.status.upstreamCount ?? '尚未读取')}{' '}
          · 历史核对：
          {row.status.observedAt ? new Date(row.status.observedAt).toLocaleString() : '尚未核对'}
        </small>
        {row.status.rounds.some((item) => item.round < activeRound && !item.covered) && (
          <small>较早轮次仍需核对</small>
        )}
        {row.blockers.length > 0 && <small>{row.blockers.map(blockerText).join('；')}</small>}
      </div>
    );
  }
  return (
    <div ref={container} className="flex flex-col gap-4">
      <Space wrap>
        <Select
          aria-label="检查所属系"
          disabled={!work.canSelectDepartment || dirty}
          value={work.departmentId ?? 'all'}
          style={{ width: 200 }}
          options={[
            ...(work.canSelectDepartment ? [{ value: 'all', label: '全校（全部系）' }] : []),
            ...work.departments.map((row) => ({ value: row.id, label: row.name })),
          ]}
          onChange={(value) =>
            onLocation({
              ...location,
              departmentId: value === 'all' ? null : value,
              resourceKey: undefined,
              teacherId: undefined,
              timeGroup: undefined,
              round: undefined,
              page: 1,
            })
          }
        />
        <Button loading={loading} disabled={dirty || syncing} onClick={() => void reload()}>
          重新读取本地数据
        </Button>
        <Button loading={syncing} disabled={dirty || loading} onClick={() => void sync()}>
          同步上游数量
        </Button>
      </Space>
      <small>
        首屏为本地记录；数量同步不代表详细历史已核验。
        {countTime && ` 数量同步时间：${new Date(countTime).toLocaleString()}`}
      </small>
      {error && <Alert type="error" title={error} />}
      <Tabs
        activeKey={group}
        onChange={(key) => {
          if (!dirty) onLocation({ ...location, timeGroup: key, round: undefined });
        }}
        items={(['FULL', 'FIRST', 'SECOND', 'CUSTOM'] as const).map((value) => ({
          key: value,
          label: value === 'CUSTOM' ? '单独处理' : groupNames[value],
        }))}
      />
      {group !== 'CUSTOM' && (
        <Tabs
          activeKey={String(round)}
          onChange={(key) => {
            if (!dirty) {
              setRounds((old) => ({ ...old, [group]: Number(key) }));
              onLocation({ ...location, round: Number(key) });
            }
          }}
          items={[1, 2, 3].map((value) => ({
            key: String(value),
            label: `第${value}次 · ${plan?.dates[value - 1] ?? '未确认'}`,
          }))}
        />
      )}
      <Space wrap>
        <Select
          aria-label="筛选组员"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="全部组员"
          style={{ width: 200 }}
          value={teacher || undefined}
          options={work.roster.map((member) => ({ value: member.staffId, label: member.name }))}
          onChange={(value) => setTeacher(value ?? '')}
        />
        <Input.Search
          aria-label="搜索教案课程"
          placeholder="搜索课程"
          allowClear
          onSearch={setKeyword}
        />
      </Space>
      {groups.map(([id, name]) => (
        <Card key={id} title={name}>
          <Table
            rowKey="staffId"
            size="small"
            pagination={{ pageSize: 20 }}
            dataSource={work.roster
              .filter((member) => member.groupId === id && (!teacher || teacher === member.staffId))
              .sort(
                (a, b) =>
                  Number(coursesFor(b.staffId).length > 0) -
                    Number(coursesFor(a.staffId).length > 0) || a.name.localeCompare(b.name),
              )}
            columns={[
              { title: '组员', dataIndex: 'name', width: 120 },
              {
                title: '本批课程',
                render: (_, member) => {
                  const rows = coursesFor(member.staffId);
                  return rows.length ? rows.map(course) : <span>本批无课程</span>;
                },
              },
            ]}
          />
        </Card>
      ))}
      {!groups.length && <Empty description="本学期暂无教研组组员" />}
      <Drawer
        title="教案检查 · 材料核对"
        open={Boolean(selected)}
        size={band === 'compact' ? '100%' : 640}
        destroyOnHidden
        onClose={() => {
          if (dirty) setClosePending(true);
          else setSelected(null);
        }}
      >
        {resource && selected ? (
          <InspectionDetail
            key={`${resource.resourceKey}:${session.session?.upstreamLoginId ?? ''}`}
            initialRound={initialRound ?? dueRound(resource.schedule.dates, work.today)}
            resource={resource}
            syncing={loading}
            syncState={historySynced ? 'synced' : session.session ? 'failed' : 'unconnected'}
            onSynced={(status) => {
              setHistorySynced(status.state === 'TRUSTED');
              if (status.state === 'TRUSTED') setError('');
            }}
            target={{ semesterId, kind: 'LESSON_PLAN', resourceKey: selected }}
            account={account}
            session={session}
            onDirty={setDirty}
            onRefresh={refreshCourse}
            onArrange={() => onLocation({ ...location, section: 'dates', resourceKey: selected })}
          />
        ) : (
          <Empty description={loading ? '正在核对课程' : '课程读取未完成，请关闭后重试'} />
        )}
      </Drawer>
      <Modal
        open={closePending}
        title="离开材料核对？"
        onCancel={() => setClosePending(false)}
        onOk={() => {
          setClosePending(false);
          setDirty(false);
          setSelected(null);
        }}
      >
        未保存评分会丢弃，准备请求的恢复入口会保留。
      </Modal>
      <Modal
        open={blocker.state === 'blocked'}
        title="离开当前检查？"
        onCancel={() => {
          if (blocker.state === 'blocked') blocker.reset();
        }}
        onOk={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      >
        未保存评分会丢弃，操作恢复记录会保留。
      </Modal>
    </div>
  );
}
