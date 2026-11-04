// src/features/teaching-inspection/ui/time-plan-workbench.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Steps,
  Table,
  Tag,
} from 'antd';
import { useBeforeUnload, useBlocker } from 'react-router';

import { isGraphQLIngressError } from '@/shared/graphql';
import { useWidthBand } from '@/shared/ui/responsive-layout';

import * as api from '../infrastructure/api';
import type { readLocation } from '../infrastructure/location';
import { blockerText, type TimePlan, type TimePlanChange, type TimeWorkspace } from '../model';
import { groupNames } from '../model';
import { needsCourseAttention } from '../time-plan-presentation';

import { GroupingPanel } from './grouping-panel';
import { SemesterDatesEditor } from './semester-dates-editor';
import { SemesterSplitModal } from './semester-split-modal';

type Location = ReturnType<typeof readLocation>;
export function TimePlanWorkbench({
  location,
  onLocation,
  splitPromptDismissed,
  onDismissSplitPrompt,
  departmentId,
  onBusyChange,
}: {
  departmentId?: string | null;
  onBusyChange?: (busy: boolean) => void;
  splitPromptDismissed: boolean;
  onDismissSplitPrompt: () => void;
  location: Location;
  onLocation: (value: Location) => void;
}) {
  const { modal } = App.useApp();
  const container = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand(container, [{ max: 767, value: 'compact' }], 'wide');
  const [workspace, setWorkspace] = useState<TimeWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{
    title: string;
    plan: TimePlan;
    change: TimePlanChange;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [groupDirty, setGroupDirty] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [manage, setManage] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState('attention');
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitNotice, setSplitNotice] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy || saving || groupBusy);
    return () => onBusyChange?.(false);
  }, [busy, saving, dirty, groupDirty, groupBusy, onBusyChange]);
  const datesSection = useRef<HTMLDivElement>(null);
  const gate = useRef(false);
  const serial = useRef(0);
  const blocker = useBlocker(dirty || groupDirty);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty || groupDirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty, groupDirty],
    ),
  );
  const refresh = useCallback(async () => {
    const id = ++serial.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.loadTimeOverview(location.semesterId!);
      if (serial.current === id) setWorkspace(result);
      return result;
    } catch (cause) {
      if (serial.current === id)
        setError(isGraphQLIngressError(cause) ? cause.userMessage : '检查时间读取失败，请稍后重试');
      throw cause;
    } finally {
      if (serial.current === id) setLoading(false);
    }
  }, [location.semesterId]);
  const invalidate = useCallback(() => {
    serial.current++;
  }, []);
  useEffect(() => {
    void refresh().catch(() => undefined);
    return invalidate;
  }, [refresh, invalidate]);
  useEffect(() => {
    if (
      workspace?.grouping?.canEdit &&
      !workspace.grouping.confirmed &&
      !splitPromptDismissed &&
      !dirty &&
      !busy &&
      !groupDirty &&
      !manage &&
      !editing
    ) {
      onDismissSplitPrompt();
      setSplitOpen(true);
    }
  }, [
    workspace,
    splitPromptDismissed,
    onDismissSplitPrompt,
    dirty,
    busy,
    groupDirty,
    manage,
    editing,
  ]);
  function closeSplit() {
    if (groupBusy) return;
    const close = () => {
      setSplitOpen(false);
      setGroupDirty(false);
      onDismissSplitPrompt();
    };
    if (groupDirty) modal.confirm({ title: '放弃尚未保存的教学分段？', onOk: close });
    else close();
  }
  function finishSplit() {
    setSplitOpen(false);
    setGroupDirty(false);
    setSplitNotice(true);
    requestAnimationFrame(() => {
      datesSection.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      datesSection.current?.focus({ preventScroll: true });
    });
  }
  function start(plan: TimePlan, title: string, resourceKey?: string) {
    const open = () => {
      setEditing({
        plan,
        title,
        change: {
          key: plan.key,
          resourceKey,
          expectedVersion: plan.version,
          expectedSourceVersion: plan.sourceVersion,
          dates: [...(plan.dates.length === 3 ? plan.dates : plan.suggestedDates)],
        },
      });
      setDirty(false);
      setNeedsRefresh(false);
      setError('');
    };
    if (dirty) modal.confirm({ title: '放弃尚未保存的检查时间并切换？', onOk: open });
    else open();
  }
  function cancel() {
    const close = () => {
      setEditing(null);
      setDirty(false);
    };
    if (dirty) modal.confirm({ title: '放弃尚未保存的检查时间？', onOk: close });
    else close();
  }
  function changeDates(dates: string[]) {
    if (!editing) return;
    setEditing({ ...editing, change: { ...editing.change, dates } });
    setDirty(true);
  }
  async function run(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(isGraphQLIngressError(cause) ? cause.userMessage : '保存失败，请重新读取计划后核对');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  const invalid =
    !editing ||
    editing.change.dates.length !== 3 ||
    editing.change.dates.some(
      (date, index) => !date || (index > 0 && date <= editing.change.dates[index - 1]),
    );
  const plans = workspace
    ? [
        workspace.semesterTimePlan,
        ...(workspace.groupPlans ?? []).filter(
          (plan) => plan.group === 'FIRST' || plan.group === 'SECOND',
        ),
      ]
    : [];
  const ready =
    plans.length > 0 &&
    plans.every((plan) => plan.confirmed) &&
    (!workspace?.grouping || workspace.grouping.confirmed);
  const scopedResources = (workspace?.resources ?? []).filter(
    (row) => departmentId == null || row.departmentId === departmentId,
  );
  const attention = scopedResources.filter(
    (row) => workspace && needsCourseAttention(row, workspace),
  );
  const selectedCourse = workspace?.resources.find((row) => row.resourceKey === manage);
  const filtered = scopedResources.filter((row) => {
    const teacherName = workspace?.teachers.find(
      (teacher) => teacher.staffId === location.teacherId,
    )?.name;
    return (
      (courseFilter !== 'attention' || (!!workspace && needsCourseAttention(row, workspace))) &&
      (courseFilter !== 'custom' || row.timePlan.group === 'CUSTOM') &&
      (!location.teacherId ||
        (row.teacherIds
          ? row.teacherIds.includes(location.teacherId)
          : !!teacherName && row.teacherNames.includes(teacherName))) &&
      (!location.keyword ||
        `${row.courseName} ${row.teacherNames.join(' ')}`
          .toLocaleLowerCase()
          .includes(location.keyword.toLocaleLowerCase()))
    );
  });
  function closeManage() {
    if (groupBusy) return;
    const close = () => {
      setManage(null);
      setGroupDirty(false);
    };
    if (groupDirty) modal.confirm({ title: '放弃尚未保存的安排调整？', onOk: close });
    else close();
  }
  return (
    <div ref={container} className="flex flex-col gap-4">
      {error && <Alert type="error" showIcon title={error} />}
      <Card
        title="本学期检查安排"
        loading={!workspace && loading}
        extra={
          <Button
            disabled={
              busy ||
              loading ||
              dirty ||
              groupDirty ||
              groupBusy ||
              manage !== null ||
              editing !== null ||
              splitOpen
            }
            onClick={() => void refresh().catch(() => undefined)}
          >
            重新读取检查时间
          </Button>
        }
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Tag color={ready ? 'success' : 'warning'}>{ready ? '安排已确认' : '等待统一确认'}</Tag>
            <span>普通课程自动匹配，教案、教学进度和学生作业共用检查时间。</span>
          </Space>
          {!ready && (
            <Steps
              size="small"
              current={workspace?.grouping?.confirmed ? 1 : 0}
              items={[
                { title: '确认学期分段' },
                { title: '确认三组日期' },
                { title: '课程自动采用' },
              ]}
            />
          )}
          {workspace?.grouping && (
            <Space wrap>
              <span>
                {workspace.grouping.confirmed ? '参考课程排课，已确认本学期' : '建议将本学期'}{' '}
                {workspace.grouping.weeks} 个教学周分为：前半学期 1–{workspace.grouping.split} 周、
                后半学期 {workspace.grouping.split + 1}–{workspace.grouping.weeks} 周。
              </span>
              {workspace.grouping.canEdit && (
                <Button
                  type={workspace.grouping.confirmed ? 'link' : 'primary'}
                  disabled={busy || loading || dirty || groupDirty}
                  onClick={() => {
                    onDismissSplitPrompt();
                    setSplitOpen(true);
                  }}
                >
                  {workspace.grouping.confirmed ? '调整学期分段' : '确认教学分段'}
                </Button>
              )}
            </Space>
          )}
          {workspace?.grouping && !workspace.grouping.confirmed && (
            <Alert
              type="warning"
              showIcon
              title={
                workspace.grouping.canEdit
                  ? '先确认教学分段，再确定前、后半学期检查日期'
                  : '等待管理员确认教学分段'
              }
              description="当前分段和日期为系统建议，普通课程无需逐门设置。"
            />
          )}
          {splitNotice && (
            <Alert type="success" showIcon title="教学分段已确认，接下来确认三次检查日期" />
          )}
          {workspace && (
            <div ref={datesSection} tabIndex={-1} aria-label="检查日期设置">
              <SemesterDatesEditor
                semesterId={location.semesterId!}
                plans={plans}
                splitConfirmed={!!workspace.grouping?.confirmed}
                compact={band === 'compact'}
                disabled={
                  loading ||
                  groupDirty ||
                  groupBusy ||
                  splitOpen ||
                  manage !== null ||
                  editing !== null
                }
                onDirty={setDirty}
                onBusy={setBusy}
                onRefresh={refresh}
              />
            </div>
          )}
          {workspace && !workspace.semesterTimePlan.canEdit && !ready && (
            <p>等待管理员统一确认安排，普通课程无需逐门设置。</p>
          )}
          <Collapse
            ghost
            items={[
              {
                key: 'help',
                label: '检查日期如何确定',
                children: (
                  <p>
                    按各组周期的 1/3、2/3、末次教学周计算，优先选周三。课程起止周与组周期各允许相差
                    3 周；已有独立安排保留。这里确定计划日期，已完成检查以上游记录为准。
                  </p>
                ),
              },
            ]}
          />
        </Space>
      </Card>
      <Card title="课程检查时间">
        <p>下方课程按顶部系部筛选；公共检查安排由学校统一管理。</p>
        <Space orientation="vertical" style={{ width: '100%' }}>
          {band === 'compact' ? (
            <Select
              aria-label="课程范围"
              style={{ width: '100%' }}
              value={courseFilter}
              disabled={busy || dirty || groupDirty || groupBusy}
              onChange={(value) => {
                setCourseFilter(value);
                onLocation({ ...location, page: 1 });
              }}
              options={[
                { label: `需要处理（${attention.length}）`, value: 'attention' },
                { label: `全部课程（${scopedResources.length}）`, value: 'all' },
                { label: '独立安排', value: 'custom' },
              ]}
            />
          ) : (
            <Segmented
              disabled={busy || dirty || groupDirty || groupBusy}
              aria-label="课程范围"
              value={courseFilter}
              onChange={(value) => {
                setCourseFilter(value);
                onLocation({ ...location, page: 1 });
              }}
              options={[
                { label: `需要处理（${attention.length}）`, value: 'attention' },
                { label: `全部课程（${scopedResources.length}）`, value: 'all' },
                { label: '独立安排', value: 'custom' },
              ]}
            />
          )}
          <Space wrap>
            <Select
              aria-label="筛选教师"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部教师"
              style={{ width: 200 }}
              value={location.teacherId}
              options={workspace?.teachers.map((row) => ({ value: row.staffId, label: row.name }))}
              onChange={(teacherId) => onLocation({ ...location, teacherId, page: 1 })}
            />
            <Input.Search
              aria-label="搜索课程"
              placeholder="搜索课程或教师"
              defaultValue={location.keyword}
              onSearch={(keyword) =>
                onLocation({ ...location, keyword: keyword.trim() || undefined, page: 1 })
              }
            />
          </Space>
          {courseFilter === 'attention' && !attention.length && !loading && (
            <Alert
              type="success"
              showIcon
              title={ready ? '暂无需要单独处理的课程' : '普通课程等待统一安排，无需逐门确认'}
            />
          )}
          <Table<TimeWorkspace['resources'][number]>
            rowKey="resourceKey"
            loading={loading}
            dataSource={filtered}
            scroll={{ x: 650 }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的课程" />
              ),
            }}
            pagination={{
              current: location.page,
              pageSize: 20,
              total: filtered.length,
              showSizeChanger: false,
              onChange: (page) => onLocation({ ...location, page }),
            }}
            columns={[
              {
                title: '课程 / 教师',
                render: (_, row) => (
                  <div>
                    <strong>{row.courseName}</strong>
                    <div>{row.teacherNames.join('、')}</div>
                  </div>
                ),
              },
              {
                title: '采用安排',
                render: (_, row) => (
                  <Tag>
                    {
                      groupNames[
                        row.timePlan.group ?? (row.timePlan.fullSemester ? 'FULL' : 'CUSTOM')
                      ]
                    }
                  </Tag>
                ),
              },
              {
                title: '检查日期',
                render: (_, row) =>
                  (row.timePlan.confirmed ? row.timePlan.dates : row.timePlan.suggestedDates).join(
                    ' / ',
                  ) || '暂无日期',
              },
              {
                title: '状态',
                render: (_, row) => (
                  <div>
                    {needsCourseAttention(row, workspace!) ? (
                      <Tag color="warning">需要处理</Tag>
                    ) : (
                      <Tag>{row.timePlan.confirmed ? '已安排' : '等待统一确认'}</Tag>
                    )}
                    {needsCourseAttention(row, workspace!) && (
                      <div>
                        {row.blockers
                          .filter((code) => code !== 'SHORT_COURSE')
                          .map(blockerText)
                          .join('；') ||
                          row.grouping?.reason ||
                          '请设置课程检查时间'}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: '操作',
                render: (_, row) => (
                  <Button
                    type="link"
                    disabled={busy || groupBusy || groupDirty || dirty}
                    onClick={() => setManage(row.resourceKey)}
                  >
                    {needsCourseAttention(row, workspace!) ? '处理例外' : '查看安排'}
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Card>
      {workspace?.grouping && splitOpen && (
        <SemesterSplitModal
          semesterId={location.semesterId!}
          grouping={workspace.grouping}
          onClose={closeSplit}
          onDirty={setGroupDirty}
          onBusy={setGroupBusy}
          onRefresh={refresh}
          onSaved={finishSplit}
        />
      )}
      <Drawer
        open={manage !== null}
        title={selectedCourse?.courseName ?? '课程安排'}
        size={640}
        onClose={closeManage}
        closable={!groupBusy}
        mask={{ closable: !groupBusy }}
      >
        {workspace && selectedCourse && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Descriptions
              column={1}
              items={[
                { key: 'teacher', label: '教师', children: selectedCourse.teacherNames.join('、') },
                {
                  key: 'weeks',
                  label: '有效授课周',
                  children: selectedCourse.weeks.join('、') || '暂无',
                },
                {
                  key: 'group',
                  label: '采用安排',
                  children: groupNames[selectedCourse.timePlan.group ?? 'CUSTOM'],
                },
                {
                  key: 'dates',
                  label: selectedCourse.timePlan.confirmed ? '计划日期' : '建议日期',
                  children:
                    (selectedCourse.timePlan.confirmed
                      ? selectedCourse.timePlan.dates
                      : selectedCourse.timePlan.suggestedDates
                    ).join(' / ') || '暂无',
                },
              ]}
            />
            {needsCourseAttention(selectedCourse, workspace) && (
              <Alert
                type="warning"
                showIcon
                title={selectedCourse.grouping?.reason || '请核对课程检查时间'}
                description={selectedCourse.blockers.map(blockerText).join('；')}
              />
            )}
            {!selectedCourse.timePlan.fullSemester &&
              (!selectedCourse.timePlan.group || selectedCourse.timePlan.group === 'CUSTOM') && (
                <Button
                  type="primary"
                  disabled={
                    busy ||
                    groupDirty ||
                    !selectedCourse.timePlan.canEdit ||
                    selectedCourse.blockers.some((code) => code !== 'SHORT_COURSE')
                  }
                  onClick={() => {
                    setManage(null);
                    start(
                      selectedCourse.timePlan,
                      selectedCourse.courseName,
                      selectedCourse.resourceKey,
                    );
                  }}
                >
                  设置课程时间
                </Button>
              )}
            {workspace.grouping && (
              <Collapse
                items={[
                  {
                    key: 'adjust',
                    label: '修改这门课程的适用安排',
                    children: (
                      <GroupingPanel
                        workspace={workspace}
                        course={selectedCourse}
                        semesterId={location.semesterId!}
                        onRefresh={refresh}
                        onDirty={setGroupDirty}
                        onBusy={setGroupBusy}
                        disabled={busy || loading}
                      />
                    ),
                  },
                ]}
              />
            )}
          </Space>
        )}
      </Drawer>
      {editing && (
        <Drawer
          open
          size={640}
          title={`确认检查时间 · ${editing.title}`}
          onClose={busy ? undefined : cancel}
          closable={!busy}
          mask={{ closable: false }}
        >
          <div className="flex flex-col gap-3">
            <p>
              {editing.plan.fullSemester || (editing.plan.group && editing.plan.group !== 'CUSTOM')
                ? '本次保存适用于该时间组内所有教师的课程。'
                : '本次保存仅适用于该课程。'}
              教案、教学进度、学生作业共用此计划。
            </p>
            <p>
              建议：{editing.plan.suggestedDates.join(' / ') || '暂无建议'}；原计划：
              {editing.plan.dates.join(' / ') || '尚未确认'}
            </p>
            <Space wrap>
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  第 {index + 1} 次
                  <Input
                    type="date"
                    aria-label={`第${index + 1}次检查时间`}
                    min={editing.plan.earliestDate ?? undefined}
                    max={editing.plan.latestDate ?? undefined}
                    value={editing.change.dates[index] ?? ''}
                    disabled={busy}
                    onChange={(event) =>
                      changeDates(
                        [0, 1, 2].map((i) =>
                          i === index ? event.target.value : (editing.change.dates[i] ?? ''),
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </Space>
            {invalid && <Alert type="warning" title="请填写三个严格递增的检查日期" />}
            <Space wrap>
              <Button
                disabled={busy || editing.plan.suggestedDates.length !== 3}
                onClick={() => changeDates([...editing.plan.suggestedDates])}
              >
                采用周三建议日期
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const fresh = await refresh();
                    const plan = editing.change.resourceKey
                      ? fresh.resources.find(
                          (row) => row.resourceKey === editing.change.resourceKey,
                        )?.timePlan
                      : (fresh.groupPlans?.find((plan) => plan.key === editing.plan.key) ??
                        fresh.semesterTimePlan);
                    if (!plan || plan.key !== editing.plan.key) {
                      setNeedsRefresh(true);
                      setError('课程范围或授课周期已变化，请重新选择');
                      return;
                    }
                    setEditing({
                      ...editing,
                      plan,
                      change: {
                        ...editing.change,
                        expectedVersion: plan.version,
                        expectedSourceVersion: plan.sourceVersion,
                      },
                    });
                    setNeedsRefresh(false);
                  })
                }
              >
                刷新依据并重新核对
              </Button>
              <Button
                type="primary"
                loading={saving}
                disabled={busy || invalid || needsRefresh}
                onClick={() =>
                  void run(async () => {
                    const snapshot = structuredClone(editing.change);
                    setSaving(true);
                    try {
                      await api.timePlans(
                        { semesterId: location.semesterId!, changes: [snapshot] },
                        false,
                      );
                      await api.timePlans(
                        { semesterId: location.semesterId!, changes: [snapshot] },
                        true,
                      );
                    } catch (cause) {
                      setNeedsRefresh(true);
                      throw cause;
                    } finally {
                      setSaving(false);
                    }
                    setDirty(false);
                    setEditing(null);
                    setNeedsRefresh(false);
                    await refresh();
                  })
                }
              >
                保存课程日期
              </Button>
            </Space>
          </div>
        </Drawer>
      )}
      <Modal
        open={blocker.state === 'blocked'}
        title="放弃尚未保存的检查时间？"
        okText="放弃并离开"
        cancelText="继续编辑"
        onCancel={() => blocker.state === 'blocked' && blocker.reset()}
        onOk={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </div>
  );
}
