// src/labs/teaching-inspection/ui/lesson-workbench.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  theme,
  Tooltip,
  Typography,
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
  editedChapter?: string;
  message: string;
  state: 'ready' | 'error' | 'unknown' | 'saved' | 'busy';
};
type Row = {
  key: string;
  name: string;
  staffId: string;
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
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
  location: ReturnType<typeof readLocation>;
  onLocation: (value: ReturnType<typeof readLocation>) => void;
  account: UpstreamAccountIdentity;
  session: Controller;
}) {
  const { token } = theme.useToken();
  const [work, setWork] = useState<api.LessonOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [teachingGroup, setTeachingGroup] = useState('');
  const [teacher, setTeacher] = useState('');
  const [keyword, setKeyword] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [onlyDifferent, setOnlyDifferent] = useState(false);
  const [customRounds, setCustomRounds] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<
    { kind: 'sync'; key: string } | { kind: 'prepare' } | { kind: 'submit'; key?: string } | null
  >(null);
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
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
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
  const ownTeachingGroups = work?.teachingGroupIds ?? [];
  const availableRoster = (work?.roster ?? []).filter(
    (member) => work?.canSelectDepartment || ownTeachingGroups.includes(member.groupId),
  );
  const teachingGroups = [
    ...new Map(
      availableRoster.map((member) => [
        member.groupId,
        { value: member.groupId, label: member.groupName },
      ]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const visibleRoster = availableRoster.filter(
    (member) => !work?.canSelectDepartment || !teachingGroup || member.groupId === teachingGroup,
  );
  const batchRows: Row[] = [];
  const seen = new Set<string>();
  for (const member of visibleRoster) {
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
        batchRows.push({
          key,
          name: course.teacherNames.join('、'),
          staffId: course.teacherIds.join('、'),
          group: member.groupName,
          course,
          round: r,
          date: course.schedule.dates[r - 1],
        });
        seen.add(key);
      }
    }
    if (!courses.length && !keyword)
      batchRows.push({
        key: `staff:${member.staffId}`,
        name: member.name,
        staffId: member.staffId,
        group: member.groupName,
        round,
      });
  }
  batchRows.sort(
    (a, b) =>
      Number(Boolean(b.course)) - Number(Boolean(a.course)) ||
      a.group.localeCompare(b.group) ||
      a.name.localeCompare(b.name),
  );
  const rows = batchRows.filter(
    (row) => (!hideCompleted || !rowCompleted(row)) && (!onlyDifferent || chaptersDiffer(row)),
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
    setActivity({ kind: 'sync', key: row.key });
    setProgress({ done: 0, total: 0, success: 0, failed: 0, unknown: 0, label: '' });
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
        if (observed.syncWarning) setError(observed.syncWarning);
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
        setActivity(null);
        recoveries();
      }
    }
  }
  function renderTeacher(row: Row, inline = false) {
    return (
      <div className={inline ? 'flex flex-wrap items-baseline gap-x-2' : 'flex flex-col gap-1'}>
        <Tooltip title={row.group}>
          <strong>{row.name}</strong>
        </Tooltip>
        <small style={{ color: token.colorTextTertiary }}>{row.staffId}</small>
      </div>
    );
  }
  function renderCourse(row: Row) {
    const courseName = row.course?.courseName ?? '本批无课程';
    return (
      <Typography.Paragraph
        type="secondary"
        ellipsis={{ rows: 2, tooltip: courseName }}
        style={{ margin: 0, overflowWrap: 'anywhere' }}
      >
        {courseName}
      </Typography.Paragraph>
    );
  }
  function renderReread(row: Row) {
    return (
      row.course && (
        <Button
          size="small"
          aria-label="同步数据"
          aria-busy={activity?.kind === 'sync' && activity.key === row.key}
          loading={activity?.kind === 'sync' && activity.key === row.key}
          disabled={busy || loading}
          onClick={() => void reread(row)}
        >
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
  function rowCompleted(row: Row) {
    return Boolean(
      row.course?.status.rounds[row.round - 1]?.covered || drafts[row.key]?.state === 'saved',
    );
  }
  function chaptersDiffer(row: Row) {
    const record = completedRecord(row);
    const draft = drafts[row.key];
    const plan =
      draft?.prepared?.material.lesson ??
      row.course?.lessonPlanSources?.find((item) => item.round === row.round);
    const chapter = record
      ? record.chapter
      : (draft?.editedChapter ?? draft?.prepared?.material.lesson?.chapter);
    return Boolean(
      (record || draft?.state === 'saved') &&
      plan?.chapter.trim() &&
      chapter?.trim() &&
      plan.chapter.trim() !== chapter.trim(),
    );
  }
  function renderChapter(row: Row, source = false) {
    const record = completedRecord(row);
    const lesson = drafts[row.key]?.prepared?.material.lesson;
    const planSource =
      lesson ?? row.course?.lessonPlanSources?.find((item) => item.round === row.round);
    if (source)
      return planSource ? (
        <>
          <small>授课日期 · {planSource.sourceDate ?? '未记录'}</small>
          <div className="whitespace-pre-wrap break-words">{planSource.chapter}</div>
        </>
      ) : (
        <span>—</span>
      );
    if (!record && drafts[row.key]?.state === 'ready' && lesson)
      return (
        <>
          {drafts[row.key].editedChapter !== undefined &&
            drafts[row.key].editedChapter !== lesson.chapter && <Tag>已调整</Tag>}
          <Input.TextArea
            aria-label={`${row.course?.courseName}检查时授课章节`}
            disabled={busy}
            autoSize={{ minRows: 1, maxRows: 5 }}
            styles={{ textarea: { paddingBlock: 0 } }}
            status={(drafts[row.key].editedChapter ?? lesson.chapter).trim() ? '' : 'error'}
            value={drafts[row.key].editedChapter ?? lesson.chapter}
            onChange={(event) =>
              setDrafts((old) => ({
                ...old,
                [row.key]: { ...old[row.key], editedChapter: event.target.value },
              }))
            }
          />
          {!(drafts[row.key].editedChapter ?? lesson.chapter).trim() && (
            <div>检查时授课章节不能为空</div>
          )}
        </>
      );
    const chapter = record ? record.chapter : (drafts[row.key]?.editedChapter ?? lesson?.chapter);
    if (!record && !lesson)
      return (
        <span>{row.course?.status.rounds[row.round - 1]?.covered ? '历史章节待同步' : '—'}</span>
      );
    const differs = chaptersDiffer(row);
    return (
      <>
        <small>
          {record
            ? `已完成检查 · ${record.checkDate}`
            : `材料来源：${lesson?.sourceDate ?? '原准备快照未记录日期'}`}
        </small>
        <Tooltip title={differs ? '与授课计划章节名称不一致' : undefined}>
          <div
            className="whitespace-pre-wrap break-words"
            style={{ color: differs ? token.colorWarningText : undefined }}
          >
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
        </Tooltip>
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
  function renderStatus(row: Row) {
    const draft = drafts[row.key];
    const pending = hasPending(row);
    const label =
      draft?.message ??
      (pending
        ? '提交结果待确认'
        : row.course?.status.rounds[row.round - 1]?.covered
          ? '本轮已完成'
          : row.course
            ? '未准备'
            : '无课程');
    const color =
      label === '本轮已完成' || draft?.state === 'saved'
        ? 'success'
        : draft?.state === 'busy'
          ? 'processing'
          : draft?.state === 'unknown' || (!draft && pending)
            ? 'warning'
            : draft?.state === 'ready'
              ? 'blue'
              : draft?.state === 'error'
                ? 'error'
                : 'default';
    return (
      <Tag
        color={color}
        role="status"
        aria-busy={draft?.state === 'busy'}
        icon={draft?.state === 'busy' ? <LoadingOutlined aria-hidden /> : undefined}
      >
        {label}
      </Tag>
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
  function emptyChapter(row: Row) {
    return (
      drafts[row.key]?.state === 'ready' &&
      !(
        drafts[row.key].editedChapter ??
        drafts[row.key].prepared?.material.lesson?.chapter ??
        ''
      ).trim()
    );
  }
  function canPrepare(row: Row) {
    return eligible(row) && !hasPending(row) && drafts[row.key]?.state !== 'ready';
  }
  function canSubmit(row: Row) {
    return (
      eligible(row) &&
      drafts[row.key]?.state === 'ready' &&
      Boolean(drafts[row.key].prepared?.preview) &&
      !emptyChapter(row) &&
      !hasPending(row)
    );
  }
  function renderRowAction(row: Row) {
    const submitting = activity?.kind === 'submit' && activity.key === row.key;
    if (!submitting && drafts[row.key]?.state !== 'ready') return renderReread(row);
    return (
      <Button
        size="small"
        type="primary"
        aria-label={`确认提交${row.course?.courseName ?? ''}`}
        aria-busy={submitting}
        loading={submitting}
        disabled={busy || loading || !canSubmit(row)}
        onClick={() => void run(true, row)}
      >
        确认提交
      </Button>
    );
  }
  const hasEmptyChapter = chosen.some(emptyChapter);
  const selectable = rows.filter((row) => eligible(row) && !hasPending(row));
  const selectedCount = selectable.filter((row) => selected.includes(row.key)).length;
  const prepareCount = chosen.filter(canPrepare).length;
  const submitCount = chosen.filter(canSubmit).length;
  const processingQueue = activity?.kind === 'prepare' || activity?.kind === 'submit';
  const processingBatch =
    activity?.kind === 'prepare' || (activity?.kind === 'submit' && !activity.key);
  async function run(submit: boolean, target?: Row) {
    const targets = target ? [target] : chosen;
    if (running.current || (submit && targets.some(emptyChapter))) return;
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
    const queue = targets.filter(submit ? canSubmit : canPrepare);
    if (!queue.length) return;
    running.current = true;
    stop.current = false;
    setBusy(true);
    setActivity(submit ? { kind: 'submit', key: target?.key } : { kind: 'prepare' });
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
            publish(row.key, { state: 'busy', message: '正在读取课程' });
            update(`正在读取 ${row.name} · ${row.course!.courseName}`);
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
          if (api.previewHasExpired(preview.expiresAt)) {
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
            chapter: draft.editedChapter ?? prepared.material.lesson!.chapter,
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
                editedChapter: input.chapter,
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
        setActivity(null);
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
    <div
      ref={container}
      className="flex min-w-0 flex-col"
      style={{
        background: token.colorBgContainer,
        borderRadius: `0 0 ${token.borderRadiusLG}px ${token.borderRadiusLG}px`,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderTop: 0,
      }}
    >
      <section
        aria-label="检查批次筛选"
        className="flex min-w-0 flex-col items-end gap-2 p-4"
        style={{
          background: token.colorPrimaryBg,
          borderBottom: `1px solid ${token.colorPrimaryBorder}`,
        }}
      >
        {error && <Alert type="warning" title={error} />}
        <div className="min-w-0 max-w-full">
          <Tabs
            aria-label="学期分段"
            size="small"
            styles={{ header: { margin: 0 } }}
            activeKey={group}
            onChange={(value) => {
              if (!busy) {
                setSelected([]);
                onLocation({
                  ...location,
                  timeGroup: value,
                  round: undefined,
                  resourceKey: undefined,
                });
              }
            }}
            items={(['FULL', 'FIRST', 'SECOND', 'CUSTOM'] as const).map((value) => ({
              key: value,
              label: value === 'CUSTOM' ? '单独处理' : groupNames[value],
              disabled: busy,
            }))}
          />
        </div>
        {group !== 'CUSTOM' && (
          <div className="min-w-0 max-w-full">
            <Tabs
              aria-label="检查轮次"
              size="small"
              styles={{ header: { margin: 0 } }}
              activeKey={String(round)}
              onChange={(value) => {
                setSelected([]);
                onLocation({ ...location, round: Number(value) });
              }}
              items={[1, 2, 3].map((value) => ({
                key: String(value),
                label:
                  band === 'compact' ? (
                    <span
                      className="flex flex-col items-end"
                      aria-label={`第${value}次 · ${plan?.dates[value - 1] ?? '未确认'}`}
                    >
                      <span>第{value}次</span>
                      <small>{plan?.dates[value - 1] ?? '未确认'}</small>
                    </span>
                  ) : (
                    `第${value}次 · ${plan?.dates[value - 1] ?? '未确认'}`
                  ),
                disabled: busy,
              }))}
            />
          </div>
        )}
      </section>
      <section aria-label="教案列表操作" className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={band === 'compact' ? 'flex w-full flex-wrap gap-2' : 'flex flex-wrap gap-2'}
          >
            <Select
              aria-label="筛选教研组"
              disabled={busy || !work.canSelectDepartment}
              allowClear={work.canSelectDepartment}
              showSearch
              optionFilterProp="label"
              placeholder={work.canSelectDepartment ? '全部教研组' : '未关联教研组'}
              style={{ width: band === 'compact' ? '100%' : 184 }}
              value={
                work.canSelectDepartment
                  ? teachingGroup || undefined
                  : teachingGroups.length
                    ? 'own'
                    : undefined
              }
              options={
                work.canSelectDepartment
                  ? teachingGroups
                  : teachingGroups.length
                    ? [{ value: 'own', label: teachingGroups.map((item) => item.label).join('、') }]
                    : []
              }
              onChange={(value) => {
                setTeachingGroup(value ?? '');
                setTeacher('');
                setSelected([]);
              }}
            />
            <Select
              aria-label="筛选组员"
              disabled={busy}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部组员"
              style={{ width: band === 'compact' ? '100%' : 168 }}
              value={teacher || undefined}
              options={visibleRoster.map((m) => ({ value: m.staffId, label: m.name }))}
              onChange={(value) => setTeacher(value ?? '')}
            />
            <Input.Search
              aria-label="搜索教案课程"
              disabled={busy}
              placeholder="搜索课程"
              style={{ width: band === 'compact' ? '100%' : 224 }}
              allowClear
              onSearch={setKeyword}
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
            <Space size="small">
              <Switch
                aria-label="隐藏已完成"
                size="small"
                checked={hideCompleted}
                disabled={busy}
                onChange={(value) => {
                  setHideCompleted(value);
                  setSelected([]);
                }}
              />
              <span>隐藏已完成</span>
            </Space>
            <Space size="small">
              <Switch
                aria-label="只看不一致"
                size="small"
                checked={onlyDifferent}
                disabled={busy}
                onChange={(value) => {
                  setOnlyDifferent(value);
                  if (value) setHideCompleted(false);
                  setSelected([]);
                }}
              />
              <span>只看不一致</span>
            </Space>
            <Button
              type="text"
              aria-label="刷新列表"
              icon={<ReloadOutlined aria-hidden />}
              disabled={busy}
              loading={loading}
              onClick={() => void reload()}
            >
              刷新
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Tooltip title="选中当前筛选范围内可操作的课程，包含全部分页">
              <Checkbox
                aria-label="全选当前范围（全部分页）"
                disabled={busy || loading || !selectable.length}
                checked={selectable.length > 0 && selectedCount === selectable.length}
                indeterminate={selectedCount > 0 && selectedCount < selectable.length}
                onChange={(event) =>
                  setSelected(event.target.checked ? selectable.map((row) => row.key) : [])
                }
              >
                全选当前范围
              </Checkbox>
            </Tooltip>
            <span
              style={{ color: chosen.length ? token.colorPrimaryText : token.colorTextSecondary }}
            >
              已选 {chosen.length} 项
            </span>
            <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
              共 {rows.filter((row) => row.course).length} 门 · 已完成{' '}
              {rows.filter(rowCompleted).length} · 待确认{' '}
              {rows.filter((row) => drafts[row.key]?.state === 'ready').length}
            </span>
          </div>
          <div
            className={
              band === 'compact'
                ? 'grid w-full grid-cols-2 gap-2'
                : 'ml-auto flex flex-wrap items-center justify-end gap-2'
            }
          >
            {busy && processingBatch && (
              <Button
                style={band === 'compact' ? { gridColumn: '1 / -1' } : undefined}
                onClick={() => {
                  stop.current = true;
                }}
              >
                停止后续处理
              </Button>
            )}
            <Tooltip title="读取选中课程的上游材料，保留已准备内容供核对">
              <Button
                type={submitCount ? 'default' : 'primary'}
                aria-label="准备材料"
                block={band === 'compact'}
                aria-busy={activity?.kind === 'prepare'}
                loading={activity?.kind === 'prepare'}
                disabled={busy || loading || !prepareCount}
                onClick={() => void run(false)}
              >
                准备材料{prepareCount > 0 ? ` ${prepareCount} 项` : ''}
              </Button>
            </Tooltip>
            <Tooltip
              title={
                hasEmptyChapter
                  ? '请补全选中课程的检查时授课章节'
                  : '核对章节后，逐项提交已准备的检查结果'
              }
            >
              <Button
                type={submitCount ? 'primary' : 'default'}
                aria-label="确认提交选中项"
                block={band === 'compact'}
                aria-busy={activity?.kind === 'submit' && !activity.key}
                loading={activity?.kind === 'submit' && !activity.key}
                disabled={busy || loading || hasEmptyChapter || !submitCount}
                onClick={() => void run(true)}
              >
                确认提交{submitCount > 0 ? ` ${submitCount} 项` : ''}
              </Button>
            </Tooltip>
          </div>
        </div>
        {progress.total > 0 && (
          <div
            aria-label="本次处理结果"
            className="flex flex-col gap-1"
            style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
          >
            {busy && processingQueue && (
              <Progress size="small" percent={Math.round((progress.done / progress.total) * 100)} />
            )}
            <span>
              {progress.label} · 已处理 {progress.done} / {progress.total} · 成功 {progress.success}{' '}
              {progress.failed > 0 && ` · 失败 ${progress.failed}`}
              {progress.unknown > 0 && ` · 待核对 ${progress.unknown}`}
            </span>
          </div>
        )}
      </section>
      <div className="min-w-0">
        <Table<Row>
          size="middle"
          tableLayout="fixed"
          rowKey="key"
          dataSource={rows}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hideCompleted && onlyDifferent
                    ? '不一致筛选只包含已完成记录，请关闭“隐藏已完成”查看'
                    : '当前筛选范围内没有记录'
                }
              />
            ),
          }}
          pagination={{ pageSize: 20 }}
          scroll={band === 'compact' ? undefined : { x: 1064 }}
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
                        {renderTeacher(row, true)}
                        {renderCourse(row)}
                        <span>
                          <strong>第{row.round}次检查</strong>
                          <br />
                          {row.date ?? '待确认'}
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
                        <small>授课计划章节</small>
                        {renderChapter(row, true)}
                        <small>检查时授课章节</small>
                        {renderChapter(row)}
                        {renderScore(row)}
                        {renderStatus(row)}
                        {renderRowAction(row)}
                      </Space>
                    ),
                  },
                ]
              : [
                  {
                    title: '教师',
                    width: 91,
                    render: (_, row) => renderTeacher(row),
                  },
                  {
                    title: '课程',
                    width: '11%',
                    render: (_, row) => renderCourse(row),
                  },
                  {
                    title: '检查日期',
                    width: 120,
                    render: (_, row) =>
                      row.course && (
                        <>
                          <span>
                            <strong>第{row.round}次检查</strong>
                            <br />
                            {row.date ?? '待确认'}
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
                    title: '授课计划章节',
                    onCell: () => ({ style: { verticalAlign: 'bottom' } }),
                    render: (_, row) => renderChapter(row, true),
                  },
                  {
                    title: '检查时授课章节',
                    onCell: () => ({ style: { verticalAlign: 'bottom' } }),
                    render: (_, row) => renderChapter(row),
                  },
                  {
                    title: '评分',
                    width: 75,
                    render: (_, row) => renderScore(row),
                  },
                  {
                    title: '状态',
                    width: 150,
                    render: (_, row) => (
                      <Space orientation="vertical">
                        {renderStatus(row)}
                        {renderRowAction(row)}
                      </Space>
                    ),
                  },
                ]
          }
        />
      </div>
    </div>
  );
}
