// src/labs/teaching-inspection/ui/grouping-panel.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, InputNumber, Select, Space, Table } from 'antd';

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import type { GroupingInput, GroupingResult, TimeGroup, TimeWorkspace } from '../model';
import { groupNames } from '../model';
function groupingError(cause: unknown) {
  if (hasGraphQLCategory(cause, 'CONFLICT')) return '归组或排课依据已变化，请重新读取并预览。';
  if (hasGraphQLCategory(cause, 'BAD_USER_INPUT'))
    return '请确认学期分界与目标组日期；组日期超出课程周期时，请选择独立例外。';
  return isGraphQLIngressError(cause) ? cause.userMessage : '归组处理失败，请重新读取后核对。';
}
export function GroupingPanel({
  workspace,
  semesterId,
  onRefresh,
  onDirty,
  disabled,
}: {
  workspace: TimeWorkspace;
  semesterId: number;
  onRefresh: () => Promise<unknown>;
  onDirty: (value: boolean) => void;
  disabled: boolean;
}) {
  const status = workspace.grouping;
  const [split, setSplit] = useState(status?.split ?? 1);
  const [pending, setPending] = useState<{ input: GroupingInput; result: GroupingResult } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [choices, setChoices] = useState<Record<string, TimeGroup>>({});
  const gate = useRef(false);
  useEffect(() => {
    setSplit(status?.split ?? 1);
    setPending(null);
    setChoices({});
    setUncertain(false);
    onDirty(false);
  }, [status?.version, status?.sourceVersion, status?.split, onDirty]);
  if (!status) return null;
  async function preview(extra: Partial<GroupingInput>) {
    if (gate.current || !status) return;
    gate.current = true;
    setBusy(true);
    setError('');
    setPending(null);
    try {
      const input = {
        semesterId,
        expectedVersion: status.version,
        expectedSourceVersion: status.sourceVersion,
        ...extra,
      };
      const result = await api.grouping(input, false);
      setPending({ input, result });
      onDirty(true);
    } catch (cause) {
      setError(groupingError(cause));
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <Card title="学期分界与课程归组">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert
          type="info"
          title={`共 ${status.weeks} 个教学周；排课建议 ${status.recommendedSplit}＋${status.weeks - status.recommendedSplit}`}
          description="原始授课周期的起止边界各允许相差3周。确认后固定分界和归组；已确认旧计划保持不动。下表仅显示当前筛选页，批量采用建议会预览整个权限范围的待归组课程。"
        />
        <div>
          当前分界：1–{status.split} / {status.split + 1}–{status.weeks} 周 ·{' '}
          {status.confirmed ? '已确认' : '待确认'}
        </div>
        {status.counts && (
          <div>
            权限范围内建议归类：
            {status.counts.map((row) => `${groupNames[row.group]} ${row.count} 门`).join('；')}
          </div>
        )}
        {error && <Alert type="error" title={error} />}
        {status.canEdit && (
          <Space wrap>
            <InputNumber
              aria-label="前半学期结束周"
              min={1}
              max={status.weeks - 1}
              value={split}
              disabled={busy || disabled}
              onChange={(value) => {
                if (value !== null) {
                  setSplit(value);
                  setPending(null);
                  onDirty(true);
                }
              }}
            />
            <Button
              disabled={busy || disabled || uncertain}
              onClick={() => void preview({ split })}
            >
              预览学期分界
            </Button>
          </Space>
        )}
        <Button
          disabled={busy || disabled || uncertain || !status.confirmed}
          onClick={() => void preview({ confirmSuggested: true })}
        >
          预览待归组课程
        </Button>
        <Space wrap>
          <Select
            aria-label="当前页归组筛选"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: '当前页全部课程' },
              { value: 'REVIEW', label: '待确认 / 待复核' },
              { value: 'PRESERVED', label: '保留旧计划' },
              { value: 'CUSTOM', label: '独立例外' },
            ]}
          />
          <Button
            disabled={busy}
            onClick={() => {
              setPending(null);
              setChoices({});
              setSplit(status.split);
              onDirty(false);
            }}
          >
            取消归组编辑
          </Button>
        </Space>
        <Table<TimeWorkspace['resources'][number]>
          rowKey="resourceKey"
          dataSource={workspace.resources.filter(
            (row) =>
              filter === 'ALL' ||
              (filter === 'REVIEW'
                ? row.grouping?.needsReview
                : filter === 'PRESERVED'
                  ? row.grouping?.preserved
                  : row.grouping?.group === 'CUSTOM'),
          )}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
          columns={[
            {
              title: '课程 / 教师',
              render: (_, row) => (
                <div>
                  {row.courseName}
                  <div>{row.teacherNames.join('、')}</div>
                </div>
              ),
            },
            {
              title: '原定周期',
              render: (_, row) =>
                row.grouping?.start ? `${row.grouping.start}–${row.grouping.end}周` : '依据不完整',
            },
            {
              title: '归组状态',
              render: (_, row) => (
                <div>
                  {row.grouping?.group ? groupNames[row.grouping.group] : '未归组'}
                  <div>{row.grouping?.reason}</div>
                  <div>
                    建议：
                    {row.grouping?.suggestedGroup
                      ? groupNames[row.grouping.suggestedGroup]
                      : '人工核对'}
                  </div>
                </div>
              ),
            },
            {
              title: '调整归组',
              render: (_, row) => (
                <Space wrap>
                  <Select
                    aria-label={`归组-${row.resourceKey}`}
                    style={{ width: 130 }}
                    disabled={busy || disabled || !status.confirmed}
                    value={choices[row.resourceKey] ?? row.grouping?.suggestedGroup ?? undefined}
                    options={Object.entries(groupNames).map(([value, label]) => ({ value, label }))}
                    onChange={(value: TimeGroup) => {
                      setChoices({ ...choices, [row.resourceKey]: value });
                      setPending(null);
                      onDirty(true);
                    }}
                  />
                  <Button
                    disabled={
                      busy ||
                      disabled ||
                      uncertain ||
                      !status.confirmed ||
                      !(choices[row.resourceKey] ?? row.grouping?.suggestedGroup)
                    }
                    onClick={() =>
                      void preview({
                        changes: [
                          {
                            resourceKey: row.resourceKey,
                            group: choices[row.resourceKey] ?? row.grouping!.suggestedGroup!,
                            expectedSourceVersion: row.sourceVersion,
                          },
                        ],
                      })
                    }
                  >
                    预览归组
                  </Button>
                </Space>
              ),
            },
          ]}
        />
        {pending && (
          <>
            <Alert
              type="warning"
              title={
                pending.input.split !== undefined
                  ? `确认分界为 ${pending.result.split}＋${pending.result.weeks - pending.result.split}；已有半学期组日期需重新核对`
                  : `将调整 ${pending.result.changes.length} 门课程；旧独立计划仅在手工选择时更改`
              }
            />
            <Table
              rowKey="resourceKey"
              pagination={{ pageSize: 10 }}
              dataSource={pending.result.changes}
              columns={[
                { title: '课程', dataIndex: 'courseName' },
                { title: '目标组', render: (_, row) => groupNames[row.group] },
                { title: '原日期', render: (_, row) => row.beforeDates.join(' / ') || '未确认' },
                {
                  title: '目标日期',
                  render: (_, row) =>
                    row.afterDates.join(' / ') ||
                    (row.group === 'CUSTOM' ? '独立设置' : '待重新确认'),
                },
              ]}
            />
            {!!pending.result.skipped?.length && (
              <Table
                rowKey="resourceKey"
                pagination={{ pageSize: 10 }}
                dataSource={pending.result.skipped}
                columns={[
                  { title: '待处理课程（本次不保存）', dataIndex: 'courseName' },
                  { title: '原因', dataIndex: 'reason' },
                ]}
              />
            )}
            <Button
              type="primary"
              loading={busy}
              disabled={
                busy ||
                disabled ||
                uncertain ||
                (pending.input.split === undefined && !pending.result.changes.length)
              }
              onClick={() => {
                if (gate.current) return;
                gate.current = true;
                setBusy(true);
                void api
                  .grouping({ ...pending.input, previewToken: pending.result.previewToken }, true)
                  .then(async () => {
                    setPending(null);
                    onDirty(false);
                    await onRefresh();
                  })
                  .catch((cause) => {
                    setUncertain(true);
                    setPending(null);
                    setError(
                      isGraphQLIngressError(cause)
                        ? cause.userMessage
                        : '保存结果不确定，请重新读取',
                    );
                  })
                  .finally(() => {
                    gate.current = false;
                    setBusy(false);
                  });
              }}
            >
              确认保存归组
            </Button>
          </>
        )}
        {uncertain && (
          <Button
            disabled={busy}
            onClick={() =>
              void onRefresh()
                .then(() => {
                  setUncertain(false);
                  setPending(null);
                  onDirty(false);
                })
                .catch(() => setError('重新读取失败，请稍后重试'))
            }
          >
            重新读取归组依据
          </Button>
        )}
      </Space>
    </Card>
  );
}
