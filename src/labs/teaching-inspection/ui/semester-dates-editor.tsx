// src/labs/teaching-inspection/ui/semester-dates-editor.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Table, Tag } from 'antd';

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import { groupNames, type TimePlan, type TimePlanChange, type TimeWorkspace } from '../model';

function changeFor(plan: TimePlan): TimePlanChange {
  return {
    key: plan.key,
    expectedVersion: plan.version,
    expectedSourceVersion: plan.sourceVersion,
    dates: [...(plan.confirmed ? plan.dates : plan.suggestedDates)],
  };
}
function invalidDates(change: TimePlanChange, plan: TimePlan) {
  return (
    change.dates.length !== 3 ||
    change.dates.some(
      (date, index) =>
        !date ||
        (index > 0 && date <= change.dates[index - 1]) ||
        (!!plan.earliestDate && date < plan.earliestDate) ||
        (!!plan.latestDate && date > plan.latestDate),
    )
  );
}
export function SemesterDatesEditor({
  semesterId,
  plans,
  splitConfirmed,
  compact,
  disabled,
  onDirty,
  onBusy,
  onRefresh,
}: {
  semesterId: number;
  plans: TimePlan[];
  splitConfirmed: boolean;
  compact: boolean;
  disabled: boolean;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<TimeWorkspace>;
}) {
  const [drafts, setDrafts] = useState<Record<string, TimePlanChange>>({});
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const gate = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const eligible = (plan: TimePlan) =>
    plan.canEdit && ((plan.group !== 'FIRST' && plan.group !== 'SECOND') || splitConfirmed);
  const changed = (plan: TimePlan) => !!drafts[plan.key];
  const stale = (plan: TimePlan) =>
    !!drafts[plan.key] &&
    (drafts[plan.key].expectedVersion !== plan.version ||
      drafts[plan.key].expectedSourceVersion !== plan.sourceVersion);
  const pending = plans.filter((plan) => eligible(plan) && (!plan.confirmed || changed(plan)));
  function updateDrafts(next: Record<string, TimePlanChange>) {
    setDrafts(next);
    onDirty(Object.keys(next).length > 0);
  }
  function edit(plan: TimePlan, index: number, date: string) {
    const value = drafts[plan.key] ?? changeFor(plan);
    const next = {
      ...drafts,
      [plan.key]: { ...value, dates: value.dates.map((old, i) => (i === index ? date : old)) },
    };
    if (JSON.stringify(next[plan.key].dates) === JSON.stringify(changeFor(plan).dates))
      delete next[plan.key];
    updateDrafts(next);
    setSuccess('');
  }
  async function save(selected: TimePlan[]) {
    if (gate.current || locked || selected.some(stale)) return;
    const changes = selected.map((plan) => structuredClone(drafts[plan.key] ?? changeFor(plan)));
    gate.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setSuccess('');
    updateDrafts({
      ...drafts,
      ...Object.fromEntries(changes.map((change) => [change.key, change])),
    });
    let saving = false;
    try {
      // Preview is server-side validation of the same snapshot, not an extra user step.
      await api.timePlans({ semesterId, changes }, false);
      if (!mounted.current) return;
      saving = true;
      updateDrafts({
        ...drafts,
        ...Object.fromEntries(changes.map((change) => [change.key, change])),
      });
      await api.timePlans({ semesterId, changes }, true);
      const remaining = { ...drafts };
      changes.forEach((change) => {
        delete remaining[change.key];
      });
      updateDrafts(remaining);
      await onRefresh();
      setSuccess(
        selected.length === 1
          ? `${groupNames[selected[0].group ?? 'FULL']}检查日期已保存`
          : '检查日期已保存',
      );
    } catch (cause) {
      // Never automatically retry a write whose result is uncertain.
      if (saving || hasGraphQLCategory(cause, 'CONFLICT')) setLocked(true);
      setError(
        isGraphQLIngressError(cause) ? cause.userMessage : '日期校验或保存失败，请重新读取后核对。',
      );
    } finally {
      gate.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function reread() {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const fresh = await onRefresh();
      const current = [fresh.semesterTimePlan, ...(fresh.groupPlans ?? [])];
      const next: Record<string, TimePlanChange> = {};
      Object.values(drafts).forEach((draft) => {
        const plan = current.find((item) => item.key === draft.key);
        if (plan && JSON.stringify(plan.dates) !== JSON.stringify(draft.dates))
          next[draft.key] = { ...changeFor(plan), dates: draft.dates };
      });
      updateDrafts(next);
      setLocked(false);
      setError('');
      setSuccess('已重新读取，请核对日期后再保存');
    } catch (cause) {
      setError(isGraphQLIngressError(cause) ? cause.userMessage : '读取失败，请稍后重试');
    } finally {
      gate.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  function dateCell(plan: TimePlan, index: number) {
    const date = (drafts[plan.key] ?? changeFor(plan)).dates[index] ?? '';
    return plan.canEdit ? (
      <Input
        type="date"
        aria-label={`${groupNames[plan.group ?? 'FULL']}第${index + 1}次检查日期`}
        value={date}
        min={plan.earliestDate ?? undefined}
        max={plan.latestDate ?? undefined}
        disabled={disabled || busy || locked || !eligible(plan)}
        onChange={(event) => edit(plan, index, event.target.value)}
      />
    ) : (
      <span>{date || '暂无日期'}</span>
    );
  }
  function action(plan: TimePlan) {
    const value = drafts[plan.key] ?? changeFor(plan);
    if (!plan.canEdit) return <span>管理员统一确认</span>;
    if (!eligible(plan)) return <span>先确认学期分段</span>;
    if (plan.confirmed && !changed(plan)) return <Tag color="success">已确认</Tag>;
    return (
      <Space orientation="vertical">
        <Button
          type="primary"
          loading={busy}
          disabled={disabled || busy || locked || stale(plan) || invalidDates(value, plan)}
          onClick={() => void save([plan])}
        >
          {plan.confirmed ? '保存修改' : '确认日期'}
        </Button>
        {changed(plan) && (
          <Button
            type="link"
            disabled={disabled || busy}
            onClick={() => {
              const next = { ...drafts };
              delete next[plan.key];
              updateDrafts(next);
            }}
          >
            撤销修改
          </Button>
        )}
        {invalidDates(value, plan) && <span>请填写授课周期内、严格递增的三个日期</span>}
      </Space>
    );
  }
  const needsReview = locked || plans.some(stale);
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {error && <Alert type="error" showIcon title={error} />}
      {success && <Alert type="success" showIcon title={success} />}
      {needsReview && (
        <Alert type="warning" showIcon title="安排已变化或保存结果需要核对，请重新读取后再保存" />
      )}
      {compact ? (
        plans.map((plan) => (
          <Card key={plan.key} size="small" title={`${groupNames[plan.group ?? 'FULL']}课程`}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  第 {index + 1} 次{dateCell(plan, index)}
                </label>
              ))}
              {action(plan)}
            </Space>
          </Card>
        ))
      ) : (
        <Table<TimePlan>
          rowKey="key"
          pagination={false}
          scroll={{ x: 650 }}
          dataSource={plans}
          columns={[
            {
              title: '适用课程',
              render: (_, plan) => (
                <div>
                  <strong>{groupNames[plan.group ?? 'FULL']}课程</strong>
                  <div>
                    <small>
                      {plan.confirmed ? '修改后对本组课程生效' : '已填入建议日期，可直接确认'}
                    </small>
                  </div>
                </div>
              ),
            },
            ...[0, 1, 2].map((index) => ({
              title: `第 ${index + 1} 次`,
              render: (_: unknown, plan: TimePlan) => dateCell(plan, index),
            })),
            { title: '状态 / 操作', render: (_, plan) => action(plan) },
          ]}
        />
      )}
      <Space wrap>
        {pending.length > 1 && (
          <Button
            type="primary"
            disabled={
              disabled ||
              busy ||
              needsReview ||
              pending.some((plan) => invalidDates(drafts[plan.key] ?? changeFor(plan), plan))
            }
            loading={busy}
            onClick={() => void save(pending)}
          >
            保存全部待确认日期
          </Button>
        )}
        {needsReview && (
          <Button disabled={busy} onClick={() => void reread()}>
            重新读取并核对日期
          </Button>
        )}
      </Space>
    </Space>
  );
}
