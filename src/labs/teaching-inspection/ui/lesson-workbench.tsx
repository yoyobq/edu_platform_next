// src/labs/teaching-inspection/ui/lesson-workbench.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { useBeforeUnload, useBlocker } from 'react-router';

import type {
  UpstreamAccountIdentity,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { hasGraphQLCategory } from '@/shared/graphql';
import { useWidthBand } from '@/shared/ui/responsive-layout';

import * as flow from '../infrastructure/api';
import * as api from '../infrastructure/lesson-api';
import { reconcileLessonSaves } from '../infrastructure/lesson-reread';
import type { readLocation } from '../infrastructure/location';
import type { RecoveryEntry } from '../infrastructure/recovery';
import { discardLessonPreparations, putRecovery, removeRecovery } from '../infrastructure/recovery';
import { dueRound } from '../lesson-policy';
import type { Prepared, PrepareInput, TimeGroup } from '../model';
import { blockerText, groupNames, operationText } from '../model';
type Controller = ReturnType<typeof useUpstreamLoginModalController<never>>;
type Draft = {
  prepared?: Prepared;
  message: string;
  state: 'ready' | 'error' | 'unknown' | 'saved' | 'busy';
};
type Row = {
  key: string;
  name: string;
  group: string;
  course?: api.LessonSummary;
  round: number;
  date?: string;
};
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
  const [work, setWork] = useState<api.LessonOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [teacher, setTeacher] = useState('');
  const [keyword, setKeyword] = useState('');
  const [customRounds, setCustomRounds] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({
    done: 0,
    total: 0,
    label: '',
    success: 0,
    failed: 0,
    unknown: 0,
  });
  const [entries, setEntries] = useState<RecoveryEntry[]>([]);
  const stop = useRef(false);
  const running = useRef(false);
  const alive = useRef(true);
  const latestSession = useRef(session);
  const epoch = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand(container, [{ max: 767, value: 'compact' }], 'wide');
  useEffect(() => {
    latestSession.current = session;
  }, [session]);
  const semesterId = location.semesterId!;
  const group = (location.timeGroup ?? 'FULL') as TimeGroup;
  const blocker = useBlocker(busy);
  useEffect(() => {
    alive.current = true;
    const counter = epoch;
    return () => {
      alive.current = false;
      stop.current = true;
      counter.current++;
    };
  }, []);
  useBeforeUnload(
    useCallback((event) => {
      if (running.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    }, []),
  );
  useEffect(() => {
    if (blocker.state === 'blocked') {
      stop.current = true;
      blocker.reset();
      setError('已停止后续处理，请等待当前请求返回后再离开。');
    }
  }, [blocker]);
  const recoveries = useCallback(() => {
    const values = discardLessonPreparations(account.accountId);
    setEntries(
      values.filter(
        (e) =>
          e.kind === 'LESSON_PLAN' &&
          e.semesterId === semesterId &&
          (!e.upstreamLoginId ||
            e.upstreamLoginId === latestSession.current.session?.upstreamLoginId),
      ),
    );
    return values;
  }, [account.accountId, semesterId]);
  const reload = useCallback(async () => {
    const id = ++epoch.current;
    setLoading(true);
    try {
      const result = await api.overview(semesterId, location.departmentId);
      if (alive.current && id === epoch.current) {
        setWork(result);
        setDrafts((old) => {
          const next = { ...old };
          for (const resource of result.resources) {
            for (const status of resource.status.rounds) {
              const key = `${resource.resourceKey}:${status.round}`;
              const draft = next[key];
              if (!draft || draft.state === 'saved' || draft.state === 'unknown') continue;
              if (status.covered) delete next[key];
              else if (
                draft.state === 'ready' &&
                (status.blockers.includes('NEXT_ROUND_REQUIRED') ||
                  draft.prepared?.preview?.scheduleVersion !== resource.schedule.version)
              )
                next[key] = {
                  ...draft,
                  state: 'error',
                  message: '本地检查状态已更新，请重新准备并确认',
                };
            }
          }
          return next;
        });
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : '读取失败');
    } finally {
      if (alive.current && id === epoch.current) setLoading(false);
    }
  }, [semesterId, location.departmentId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    if (running.current) {
      stop.current = true;
      setError('检查人或检查范围已变化，材料已清理，请同步数据。');
    }
    setDrafts({});
    setSelected([]);
    try {
      recoveries();
    } catch (cause) {
      setError(String(cause));
    }
  }, [
    account.accountId,
    semesterId,
    session.session?.upstreamLoginId,
    location.departmentId,
    recoveries,
  ]);
  const plan = work?.groupPlans.find((p) => p.group === group);
  const round = location.round ?? dueRound(plan?.dates ?? [], work?.today ?? '');
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const member of work?.roster ?? []) {
    if (teacher && member.staffId !== teacher) continue;
    const courses = work!.resources.filter(
      (c) =>
        c.teacherIds.includes(member.staffId) &&
        (c.grouping?.group ?? 'CUSTOM') === group &&
        (!keyword || c.courseName.includes(keyword)),
    );
    for (const course of courses) {
      const r =
        group === 'CUSTOM'
          ? (customRounds[course.resourceKey] ?? dueRound(course.schedule.dates, work!.today))
          : round;
      const key = `${course.resourceKey}:${r}`;
      if (!seen.has(key)) {
        rows.push({
          key,
          name: course.teacherNames.join('、'),
          group: member.groupName,
          course,
          round: r,
          date: course.schedule.dates[r - 1],
        });
        seen.add(key);
      }
    }
    if (!courses.length && !keyword)
      rows.push({
        key: `staff:${member.staffId}`,
        name: member.name,
        group: member.groupName,
        round,
      });
  }
  rows.sort(
    (a, b) =>
      Number(Boolean(b.course)) - Number(Boolean(a.course)) ||
      a.group.localeCompare(b.group) ||
      a.name.localeCompare(b.name),
  );
  const chosen = rows.filter((row) => selected.includes(row.key) && row.course);
  function track(entry: RecoveryEntry) {
    putRecovery(entry);
    recoveries();
  }
  function forget(ids: string[]) {
    removeRecovery(account.accountId, ids);
    recoveries();
  }
  function patch(key: string, value: Draft) {
    if (alive.current) setDrafts((old) => ({ ...old, [key]: value }));
  }
  async function reread(row: Row) {
    if (running.current || !row.course) return;
    const controller = latestSession.current;
    let current = controller.session;
    if (!current) {
      controller.openLoginModal();
      return;
    }
    const identity = current.upstreamLoginId;
    const sameIdentity = () => latestSession.current.session?.upstreamLoginId === identity;
    const assertCurrent = () => {
      if (!alive.current || !sameIdentity())
        throw new Error('检查人不一致，材料已清理，请同步数据。');
    };
    const persist = (result: { upstreamSessionToken: string | null; expiresAt: string | null }) => {
      assertCurrent();
      controller.persistSessionFromResult(current!, result);
      if (result.upstreamSessionToken)
        current = {
          ...current!,
          upstreamSessionToken: result.upstreamSessionToken,
          expiresAt: result.expiresAt ?? current!.expiresAt,
        };
    };
    running.current = true;
    setBusy(true);
    setError('');
    setSelected((old) => old.filter((key) => key !== row.key));
    patch(row.key, { state: 'busy', message: '正在同步数据' });
    try {
      const pending = await reconcileLessonSaves(
        account.accountId,
        row.course.resourceKey,
        identity,
        assertCurrent,
      );
      const observed = await flow.refreshStatus(
        { semesterId, kind: 'LESSON_PLAN', resourceKey: row.course.resourceKey },
        current.upstreamSessionToken,
      );
      persist(observed);
      const status = observed.status.rounds[row.round - 1];
      if (
        pending ||
        observed.status.rounds.some((item) => item.blockers.includes('PENDING_OPERATION'))
      ) {
        patch(row.key, { state: 'unknown', message: '提交结果待确认，暂不能继续' });
        return;
      }
      if (status?.covered) {
        patch(row.key, { state: 'error', message: '本轮已完成' });
        return;
      }
      if (observed.status.state !== 'TRUSTED' || !status?.canPrepare) {
        patch(row.key, {
          state: 'error',
          message:
            status?.blockers.map(blockerText).join('；') || '检查状态尚未核实，请稍后同步数据',
        });
        return;
      }
      const checkDate = observed.schedule.dates[row.round - 1];
      if (checkDate !== row.date) {
        patch(row.key, { state: 'error', message: '检查日期已变化，请核对日期后同步数据' });
        return;
      }
      const input: PrepareInput = {
        semesterId,
        kind: 'LESSON_PLAN',
        resourceKey: row.course.resourceKey,
        round: row.round,
        checkDate,
        scheduleVersion: observed.schedule.version,
        clientRequestId: crypto.randomUUID(),
      };
      const result = await flow.prepare(input, current.upstreamSessionToken);
      persist(result);
      patch(
        row.key,
        result.preview && !result.blockers.length
          ? { state: 'ready', message: '已准备，待确认', prepared: result }
          : {
              state: 'error',
              message: result.blockers.map(blockerText).join('；') || '准备失败，请同步数据',
            },
      );
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : '数据同步失败');
        if (sameIdentity())
          patch(row.key, { state: 'error', message: '同步未完成，请点击“同步数据”' });
      }
      if (sameIdentity() && hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
        controller.openLoginModalForExpiredSession({
          session: current,
          loginError: '校园网会话已失效，请重新连接后同步数据。',
        });
    } finally {
      if (alive.current && sameIdentity()) await reload();
      running.current = false;
      if (alive.current) {
        setBusy(false);
        recoveries();
      }
    }
  }
  function renderReread(row: Row) {
    return (
      row.course && (
        <Button size="small" disabled={busy || loading} onClick={() => void reread(row)}>
          同步数据
        </Button>
      )
    );
  }
  function completedRecord(row: Row) {
    return row.course?.status.rounds[row.round - 1]?.covered
      ? row.course.schedule.records?.[row.round - 1]
      : undefined;
  }
  function renderChapter(row: Row) {
    const record = completedRecord(row);
    const lesson = drafts[row.key]?.prepared?.material.lesson;
    const chapter = record ? record.chapter : lesson?.chapter;
    if (!record && !lesson && row.course?.status.rounds[row.round - 1]?.covered)
      return (
        <Space orientation="vertical" size="small">
          <span>已完成检查，历史章节尚未同步</span>
        </Space>
      );
    if (!record && !lesson)
      return <span>{row.course ? '点击“读取并准备选中项”获取材料' : '—'}</span>;
    return (
      <>
        <small>
          {record
            ? `已完成检查 · ${record.checkDate}`
            : `材料来源：${lesson?.sourceDate ?? '原准备快照未记录日期'}`}
        </small>
        <div className="whitespace-pre-wrap break-words">
          {chapter ? (
            chapter.length > 120 ? (
              <details>
                <summary>{chapter.slice(0, 120)}… 展开全文</summary>
                {chapter}
              </details>
            ) : (
              chapter
            )
          ) : (
            '未记录教学章节'
          )}
        </div>
      </>
    );
  }
  function renderScore(row: Row) {
    const record = completedRecord(row);
    if (record) return <span>{record.score ?? '—'}</span>;
    const lesson = drafts[row.key]?.prepared?.material.lesson;
    return lesson ? (
      <Tooltip
        title={lesson.scoreItems
          .map((item, i) =>
            lesson.scores[i] < item.maximum
              ? `${item.name}：${lesson.scores[i]}/${item.maximum}，扣${item.maximum - lesson.scores[i]}分`
              : '',
          )
          .filter(Boolean)
          .join('；')}
      >
        <span>{lesson.scores.reduce((a, b) => a + b, 0)}</span>
      </Tooltip>
    ) : (
      '—'
    );
  }
  function hasPending(row: Row) {
    return entries.some(
      (entry) => entry.action === 'SAVE' && entry.resourceKey === row.course?.resourceKey,
    );
  }
  function rowStatus(row: Row) {
    return (
      drafts[row.key]?.message ??
      (hasPending(row)
        ? '提交结果待确认'
        : row.course?.status.rounds[row.round - 1]?.covered
          ? '本轮已完成'
          : row.course
            ? '未准备'
            : '无课程')
    );
  }
  function eligible(row: Row) {
    return Boolean(
      row.course &&
      row.date &&
      row.date <= (work?.today ?? '') &&
      !row.course.status.rounds[row.round - 1]?.covered &&
      drafts[row.key]?.state !== 'saved',
    );
  }
  async function run(submit: boolean) {
    if (running.current) return;
    const controller = latestSession.current;
    let current = controller.session;
    if (!current) {
      controller.openLoginModal();
      return;
    }
    const upstreamIdentity = current.upstreamLoginId;
    const sameIdentity = () => latestSession.current.session?.upstreamLoginId === upstreamIdentity;
    const publish = (key: string, value: Draft) => {
      if (sameIdentity()) patch(key, value);
    };
    const queue = chosen.filter(
      (row) => eligible(row) && !hasPending(row) && (!submit || drafts[row.key]?.state === 'ready'),
    );
    if (!queue.length) return;
    running.current = true;
    stop.current = false;
    setBusy(true);
    setError('');
    let touched = false;
    let done = 0,
      success = 0,
      failed = 0,
      unknown = 0;
    const update = (label: string) => {
      if (alive.current)
        setProgress({ done, total: queue.length, success, failed, unknown, label });
    };
    // Rolling credentials belong to this queue; never read a stale render between requests.
    const persist = (result: { upstreamSessionToken: string | null; expiresAt: string | null }) => {
      if (!sameIdentity()) throw new Error('检查人不一致，材料已清理，请同步数据。');
      controller.persistSessionFromResult(current!, result);
      if (result.upstreamSessionToken)
        current = {
          ...current!,
          upstreamSessionToken: result.upstreamSessionToken,
          expiresAt: result.expiresAt ?? current!.expiresAt,
        };
    };
    try {
      update(submit ? '开始提交' : '开始准备');
      if (!submit) {
        for (let offset = 0; offset < queue.length && !stop.current; offset += 10) {
          const batch = queue.slice(offset, offset + 10);
          const requests: { row: Row; input: PrepareInput }[] = [];
          for (const row of batch) {
            if (stop.current || !sameIdentity()) break;
            const detail = await api.detail(semesterId, row.course!.resourceKey);
            if (!sameIdentity()) throw new Error('检查人不一致，材料已清理，请同步数据。');
            const checkDate = detail.schedule.dates[row.round - 1];
            if (checkDate !== row.date) {
              publish(row.key, { state: 'error', message: '检查日期已变化，请刷新列表' });
              failed++;
              done++;
              continue;
            }
            const input: PrepareInput = {
              semesterId,
              kind: 'LESSON_PLAN',
              resourceKey: detail.resourceKey,
              round: row.round,
              checkDate,
              scheduleVersion: detail.schedule.version,
              clientRequestId: crypto.randomUUID(),
            };
            requests.push({ row, input });
            publish(row.key, { state: 'busy', message: '正在准备' });
          }
          if (stop.current || !sameIdentity()) break;
          if (!requests.length) continue;
          update(`正在准备 ${requests[0].row.name} 等 ${requests.length} 项`);
          touched = true;
          const response = await api.prepareBatch(
            requests.map((r) => r.input),
            current!.upstreamSessionToken,
          );
          persist(response);
          for (const request of requests) {
            const result = response.items.find(
              (item) =>
                item.resourceKey === request.input.resourceKey &&
                item.round === request.input.round,
            )?.result;
            if (result?.preview && !result.blockers.length) {
              publish(request.row.key, {
                state: 'ready',
                message: '已准备，待确认',
                prepared: result,
              });
              success++;
            } else {
              publish(request.row.key, {
                state: 'error',
                message: result
                  ? result.blockers.map(blockerText).join('；') || '材料无法准备'
                  : '准备失败，请同步数据',
              });
              failed++;
            }
            done++;
            update('准备数据中');
          }
        }
      } else {
        for (const row of queue) {
          if (stop.current || !sameIdentity()) break;
          const draft = drafts[row.key];
          const prepared = draft.prepared!;
          const preview = prepared.preview!;
          if (Date.parse(preview.expiresAt) <= Date.now()) {
            publish(row.key, { ...draft, state: 'error', message: '材料已过期，请重新准备并确认' });
            failed++;
            done++;
            update('需要重新准备');
            continue;
          }
          const input = {
            semesterId,
            kind: 'LESSON_PLAN' as const,
            resourceKey: row.course!.resourceKey,
            previewId: preview.id,
            clientRequestId: crypto.randomUUID(),
            scores: prepared.material.lesson!.scores,
          };
          const entry: RecoveryEntry = {
            ...input,
            action: 'SAVE',
            accountId: account.accountId,
            upstreamLoginId: current!.upstreamLoginId,
            round: row.round,
            checkDate: preview.checkDate,
          };
          track(entry);
          publish(row.key, { ...draft, state: 'busy', message: '正在提交' });
          update(`正在提交 ${row.name} · ${row.course!.courseName}`);
          try {
            touched = true;
            const response = await flow.save(input, current!.upstreamSessionToken);
            persist(response);
            if (['SAVED', 'VERIFIED'].includes(response.operation.state)) {
              forget([
                entry.clientRequestId,
                ...(entry.parentRequestId ? [entry.parentRequestId] : []),
              ]);
              publish(row.key, {
                state: 'saved',
                message: response.syncWarning ? `提交成功；${response.syncWarning}` : '提交成功',
                prepared,
              });
              success++;
            } else {
              publish(row.key, {
                ...draft,
                state: 'unknown',
                message: operationText(response.operation.state),
              });
              unknown++;
            }
          } catch (cause) {
            publish(row.key, {
              ...draft,
              state: 'unknown',
              message: '提交结果待确认，请同步数据',
            });
            unknown++;
            if (hasGraphQLCategory(cause, 'UNAUTHENTICATED')) throw cause;
          }
          done++;
          update('等待下一项');
          if (done < queue.length && !stop.current)
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, 500 + Math.floor(Math.random() * 1501)),
            );
        }
      }
      update(stop.current ? '已停止后续处理' : '本次处理结束');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '处理未完成，请同步数据');
      if (sameIdentity())
        setDrafts((old) =>
          Object.fromEntries(
            Object.entries(old).map(([key, draft]) => [
              key,
              draft.state === 'busy'
                ? {
                    ...draft,
                    state: (submit ? 'unknown' : 'error') as Draft['state'],
                    message: submit ? '提交结果待确认，请同步数据' : '准备失败，请同步数据',
                  }
                : draft,
            ]),
          ),
        );
      update('已暂停，请同步数据');

      if (hasGraphQLCategory(cause, 'UNAUTHENTICATED'))
        controller.openLoginModalForExpiredSession({
          session: current!,
          loginError: '会话已失效，重新连接后请主动继续；不会自动提交。',
        });
    } finally {
      if (!submit && sameIdentity())
        setDrafts((old) =>
          Object.fromEntries(
            Object.entries(old).map(([key, draft]) => [
              key,
              draft.state === 'busy'
                ? { state: 'error' as const, message: '准备已停止或失败，请同步数据' }
                : draft,
            ]),
          ),
        );
      if (touched && alive.current && sameIdentity()) await reload();
      running.current = false;
      if (alive.current) {
        setBusy(false);
        recoveries();
      }
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
  return (
    <div ref={container} className="flex flex-col gap-4">
      <Space wrap>
        <Select
          aria-label="检查所属系"
          disabled={busy || !work.canSelectDepartment}
          value={work.departmentId ?? 'all'}
          style={{ width: 200 }}
          options={[
            ...(work.canSelectDepartment ? [{ value: 'all', label: '全校（全部系）' }] : []),
            ...work.departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          onChange={(value) =>
            onLocation({
              ...location,
              departmentId: value === 'all' ? null : value,
              resourceKey: undefined,
            })
          }
        />
        <Button disabled={busy} loading={loading} onClick={() => void reload()}>
          重新读取本地数据
        </Button>
      </Space>
      {error && <Alert type="warning" title={error} />}
      <Tabs
        activeKey={group}
        onChange={(value) => {
          if (!busy) {
            setSelected([]);
            onLocation({ ...location, timeGroup: value, round: undefined, resourceKey: undefined });
          }
        }}
        items={(['FULL', 'FIRST', 'SECOND', 'CUSTOM'] as const).map((value) => ({
          key: value,
          label: value === 'CUSTOM' ? '单独处理' : groupNames[value],
          disabled: busy,
        }))}
      />
      {group !== 'CUSTOM' && (
        <Tabs
          activeKey={String(round)}
          onChange={(value) => {
            setSelected([]);
            onLocation({ ...location, round: Number(value) });
          }}
          items={[1, 2, 3].map((value) => ({
            key: String(value),
            label: `第${value}次 · ${plan?.dates[value - 1] ?? '未确认'}`,
            disabled: busy,
          }))}
        />
      )}
      <Space wrap>
        <Select
          aria-label="筛选组员"
          disabled={busy}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="全部组员"
          style={{ width: 200 }}
          value={teacher || undefined}
          options={work.roster.map((m) => ({ value: m.staffId, label: m.name }))}
          onChange={(value) => setTeacher(value ?? '')}
        />
        <Input.Search
          aria-label="搜索教案课程"
          disabled={busy}
          placeholder="搜索课程"
          allowClear
          onSearch={setKeyword}
        />
      </Space>
      <Table<Row>
        size="small"
        rowKey="key"
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        scroll={band === 'compact' ? undefined : { x: 900 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys.map(String)),
          getCheckboxProps: (row) => ({ disabled: busy || !eligible(row) || hasPending(row) }),
        }}
        columns={
          band === 'compact'
            ? [
                {
                  title: '教案检查',
                  render: (_, row) => (
                    <Space orientation="vertical">
                      <small>{row.group}</small>
                      <strong>
                        {row.name} · {row.course?.courseName ?? '本批无课程'}
                      </strong>
                      <span>
                        第{row.round}次 · {row.date ?? '待确认'}
                      </span>
                      {group === 'CUSTOM' && row.course && (
                        <Select
                          aria-label={`${row.course.courseName}轮次`}
                          disabled={busy}
                          value={row.round}
                          options={[1, 2, 3].map((value) => ({ value, label: `第${value}次` }))}
                          onChange={(value) => {
                            setSelected([]);
                            setCustomRounds((old) => ({
                              ...old,
                              [row.course!.resourceKey]: value,
                            }));
                          }}
                        />
                      )}
                      {renderChapter(row)}
                      {renderScore(row)}
                      <Tag>{rowStatus(row)}</Tag>
                      {renderReread(row)}
                    </Space>
                  ),
                },
              ]
            : [
                {
                  title: '老师／课程',
                  width: 220,
                  render: (_, row) => (
                    <Space orientation="vertical" size={0}>
                      <small>{row.group}</small>
                      <strong>{row.name}</strong>
                      <span>{row.course?.courseName ?? '本批无课程'}</span>
                    </Space>
                  ),
                },
                {
                  title: '检查日期',
                  width: 155,
                  render: (_, row) =>
                    row.course && (
                      <>
                        <span>
                          第{row.round}次 · {row.date ?? '待确认'}
                        </span>
                        {group === 'CUSTOM' && (
                          <Select
                            aria-label={`${row.course.courseName}轮次`}
                            disabled={busy}
                            value={row.round}
                            options={[1, 2, 3].map((value) => ({ value, label: `第${value}次` }))}
                            onChange={(value) => {
                              setSelected([]);
                              setCustomRounds((old) => ({
                                ...old,
                                [row.course!.resourceKey]: value,
                              }));
                            }}
                          />
                        )}
                      </>
                    ),
                },
                {
                  title: '教学章节',
                  render: (_, row) => renderChapter(row),
                },
                {
                  title: '评分',
                  width: 75,
                  render: (_, row) => renderScore(row),
                },
                {
                  title: '状态',
                  width: 200,
                  render: (_, row) => (
                    <Space orientation="vertical">
                      <Tag>{rowStatus(row)}</Tag>
                      {renderReread(row)}
                    </Space>
                  ),
                },
              ]
        }
      />
      <Card style={{ position: 'sticky', bottom: 0 }} size="small">
        <Space wrap>
          <Checkbox
            disabled={busy}
            checked={
              rows.filter(eligible).length > 0 &&
              rows.filter(eligible).every((r) => selected.includes(r.key))
            }
            onChange={(event) =>
              setSelected(
                event.target.checked
                  ? rows.filter((r) => eligible(r) && !hasPending(r)).map((r) => r.key)
                  : [],
              )
            }
          >
            全选当前筛选范围（全部分页）
          </Checkbox>
          <span>已选 {chosen.length} 项</span>
          <Button disabled={busy || !chosen.length} onClick={() => void run(false)}>
            读取并准备选中项
          </Button>
          <Button
            type="primary"
            disabled={
              busy || !chosen.some((r) => drafts[r.key]?.state === 'ready' && !hasPending(r))
            }
            onClick={() => void run(true)}
          >
            确认提交选中项
          </Button>
          {busy && (
            <Button
              onClick={() => {
                stop.current = true;
              }}
            >
              停止后续处理
            </Button>
          )}
        </Space>
        {progress.total > 0 && (
          <>
            <Progress percent={Math.round((progress.done / progress.total) * 100)} />
            <span>
              {progress.label} · 已处理 {progress.done} / {progress.total} · 成功 {progress.success}{' '}
              · 失败 {progress.failed} · 待核对 {progress.unknown}
            </span>
          </>
        )}
      </Card>
    </div>
  );
}
