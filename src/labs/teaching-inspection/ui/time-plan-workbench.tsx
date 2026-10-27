// src/labs/teaching-inspection/ui/time-plan-workbench.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Input, Modal, Select, Space, Table, Tag } from 'antd';
import { useBeforeUnload, useBlocker } from 'react-router';

import { isGraphQLIngressError } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import type { readLocation } from '../infrastructure/location';
import { blockerText, type TimePlan, type TimePlanChange, type TimeWorkspace } from '../model';

type Location = ReturnType<typeof readLocation>;
export function TimePlanWorkbench({
  location,
  onLocation,
}: {
  location: Location;
  onLocation: (value: Location) => void;
}) {
  const { modal } = App.useApp();
  const [workspace, setWorkspace] = useState<TimeWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{
    title: string;
    plan: TimePlan;
    change: TimePlanChange;
  } | null>(null);
  const [preview, setPreview] = useState<TimePlanChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [dirty, setDirty] = useState(false);
  const gate = useRef(false);
  const serial = useRef(0);
  const blocker = useBlocker(dirty);
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
  const refresh = useCallback(async () => {
    const id = ++serial.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.loadTimeWorkspace({
        semesterId: location.semesterId!,
        page: location.page,
        teacherId: location.teacherId,
        keyword: location.keyword,
      });
      if (serial.current === id) setWorkspace(result);
      return result;
    } catch (cause) {
      if (serial.current === id)
        setError(isGraphQLIngressError(cause) ? cause.userMessage : '检查时间读取失败，请稍后重试');
      throw cause;
    } finally {
      if (serial.current === id) setLoading(false);
    }
  }, [location.semesterId, location.page, location.teacherId, location.keyword]);
  const invalidate = useCallback(() => {
    serial.current++;
  }, []);
  useEffect(() => {
    void refresh().catch(() => undefined);
    return invalidate;
  }, [refresh, invalidate]);
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
      setPreview(null);
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
      setPreview(null);
      setDirty(false);
    };
    if (dirty) modal.confirm({ title: '放弃尚未保存的检查时间？', onOk: close });
    else close();
  }
  function changeDates(dates: string[]) {
    if (!editing) return;
    setEditing({ ...editing, change: { ...editing.change, dates } });
    setPreview(null);
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
      setPreview(null);
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
  const common = workspace?.semesterTimePlan;
  return (
    <div className="flex flex-col gap-4">
      <Alert
        type="info"
        showIcon
        title="全学期课程共用一套检查时间，非全学期课程单独设置"
        description="时间计划不分教师和检查类型。默认在授课周期的 1/3、2/3、末次授课周选择周三；上游实际记录在各类检查中核对。确定时间无需连接校园网。"
      />
      {error && <Alert type="error" showIcon title={error} />}
      {common && (
        <Card
          title="全学期共用检查时间"
          extra={
            <Button
              disabled={busy || loading || !common.canEdit}
              onClick={() => start(common, '全学期共用检查时间')}
            >
              确认全学期时间
            </Button>
          }
        >
          <Tag color={common.confirmed ? 'success' : 'warning'}>
            {common.confirmed ? '已确认' : '待确认'}
          </Tag>
          <p>适用于本学期所有全学期课程，不受下方教师或课程筛选影响。</p>
          <Space wrap>
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <strong>第 {index + 1} 次</strong>
                <div>建议：{common.suggestedDates[index] ?? '暂无'}</div>
                <div>已确认：{common.dates[index] ?? '未确认'}</div>
              </div>
            ))}
          </Space>
          {!common.canEdit && (
            <p>全学期共用时间由管理员确认；可查看并单独设置权限范围内的短课时间。</p>
          )}
        </Card>
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
          placeholder="搜索课程"
          defaultValue={location.keyword}
          onSearch={(keyword) =>
            onLocation({ ...location, keyword: keyword.trim() || undefined, page: 1 })
          }
        />
        <Button disabled={busy || loading} onClick={() => void refresh().catch(() => undefined)}>
          重新读取检查时间
        </Button>
      </Space>
      <Table<TimeWorkspace['resources'][number]>
        rowKey="resourceKey"
        loading={loading}
        dataSource={workspace?.resources ?? []}
        scroll={{ x: 650 }}
        pagination={{
          current: location.page,
          pageSize: 20,
          total: workspace?.total ?? 0,
          showSizeChanger: false,
          onChange: (page) => onLocation({ ...location, page }),
        }}
        columns={[
          {
            title: '课程 / 教师',
            key: 'course',
            render: (_, row) => (
              <div>
                <strong>{row.courseName}</strong>
                <div>{row.teacherNames.join('、')}</div>
                <small>有效授课周：{row.weeks.join('、') || '暂无'}</small>
              </div>
            ),
          },
          {
            title: '时间规则',
            key: 'scope',
            render: (_, row) => (
              <Tag>{row.timePlan.fullSemester ? '全学期共用' : '课程单独设置'}</Tag>
            ),
          },
          {
            title: '三次检查时间',
            key: 'dates',
            render: (_, row) => (
              <div>
                {row.timePlan.dates.length
                  ? row.timePlan.dates.map((date, index) => (
                      <div key={index}>
                        第 {index + 1} 次 · {date}
                      </div>
                    ))
                  : '尚未确认'}
                {!row.timePlan.confirmed && <div>请确认当前授课依据下的时间</div>}
              </div>
            ),
          },
          {
            title: '操作',
            key: 'action',
            render: (_, row) =>
              row.timePlan.fullSemester ? (
                '使用全学期共用时间'
              ) : (
                <div>
                  <Button
                    type="link"
                    disabled={
                      busy ||
                      loading ||
                      !row.timePlan.canEdit ||
                      row.blockers.some((code) => code !== 'SHORT_COURSE')
                    }
                    onClick={() => start(row.timePlan, row.courseName, row.resourceKey)}
                  >
                    设置课程时间
                  </Button>
                  {row.blockers.length > 0 && <div>{row.blockers.map(blockerText).join('；')}</div>}
                </div>
              ),
          },
        ]}
      />
      {editing && (
        <Card
          title={`确认检查时间 · ${editing.title}`}
          extra={
            <Button disabled={busy} onClick={cancel}>
              取消编辑
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <p>
              {editing.plan.fullSemester
                ? '本次保存适用于所有教师的全学期课程。'
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
            {preview && <Alert type="info" title={`待保存：${preview.dates.join(' / ')}`} />}
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
                      : fresh.semesterTimePlan;
                    if (!plan || plan.key !== editing.plan.key) {
                      setPreview(null);
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
                    setPreview(null);
                    setNeedsRefresh(false);
                  })
                }
              >
                刷新依据并重新核对
              </Button>
              <Button
                disabled={busy || invalid || needsRefresh}
                onClick={() =>
                  void run(async () => {
                    const snapshot = structuredClone(editing.change);
                    await api.timePlans(
                      { semesterId: location.semesterId!, changes: [snapshot] },
                      false,
                    );
                    setPreview(snapshot);
                  })
                }
              >
                预览日期
              </Button>
              <Button
                type="primary"
                loading={saving}
                disabled={busy || !preview || invalid || needsRefresh}
                onClick={() =>
                  void run(async () => {
                    if (!preview) return;
                    setSaving(true);
                    try {
                      await api.timePlans(
                        { semesterId: location.semesterId!, changes: [preview] },
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
                    setPreview(null);
                    setNeedsRefresh(false);
                    await refresh();
                  })
                }
              >
                确认保存日期
              </Button>
            </Space>
          </div>
        </Card>
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
