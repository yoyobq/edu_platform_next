// src/labs/teaching-inspection/ui/grouping-panel.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, InputNumber, Select, Space, Table } from 'antd';

import { hasGraphQLCategory, isGraphQLIngressError } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import type { GroupingInput, GroupingResult, TimeGroup, TimeWorkspace } from '../model';
import { groupNames } from '../model';
import type { TimeCourse } from '../time-plan-presentation';

function groupingError(cause: unknown) {
  if (hasGraphQLCategory(cause, 'CONFLICT')) return '安排或课表已变化，请重新读取后确认。';
  return isGraphQLIngressError(cause) ? cause.userMessage : '保存结果不确定，请重新读取后核对。';
}
export function GroupingPanel({
  workspace,
  semesterId,
  course,
  onRefresh,
  onDirty,
  onBusy,
  onSaved,
  disabled,
}: {
  workspace: TimeWorkspace;
  semesterId: number;
  course?: TimeCourse;
  onRefresh: () => Promise<unknown>;
  onDirty: (value: boolean) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onSaved?: () => void;
}) {
  const status = workspace.grouping;
  const [split, setSplit] = useState(status?.split ?? 1);
  const [choice, setChoice] = useState<TimeGroup>(
    course?.grouping?.group ?? course?.grouping?.suggestedGroup ?? 'CUSTOM',
  );
  const [pending, setPending] = useState<{ input: GroupingInput; result: GroupingResult } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const gate = useRef(false);
  useEffect(() => {
    setSplit(status?.split ?? 1);
    setChoice(course?.grouping?.group ?? course?.grouping?.suggestedGroup ?? 'CUSTOM');
    setPending(null);
    setUncertain(false);
    onDirty(false);
  }, [
    status?.version,
    status?.sourceVersion,
    status?.split,
    course?.resourceKey,
    course?.sourceVersion,
    onDirty,
    course?.grouping?.group,
    course?.grouping?.suggestedGroup,
  ]);
  if (!status) return null;
  async function preview() {
    if (gate.current || !status) return;
    gate.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setPending(null);
    try {
      const input: GroupingInput = {
        semesterId,
        expectedVersion: status.version,
        expectedSourceVersion: status.sourceVersion,
        ...(course
          ? {
              changes: [
                {
                  resourceKey: course.resourceKey,
                  group: choice,
                  expectedSourceVersion: course.sourceVersion,
                },
              ],
            }
          : { split }),
      };
      const result = await api.grouping(input, false);
      setPending({ input, result });
      onDirty(true);
    } catch (cause) {
      setError(groupingError(cause));
    } finally {
      gate.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {error && <Alert type="error" showIcon title={error} />}
      {course ? (
        <>
          <p>普通课程自动匹配检查安排。仅在这门课程确有特殊情况时调整。</p>
          {!status.confirmed && <Alert type="info" title="请管理员先统一确认学期分段" />}
          <Select
            aria-label={`归组-${course.resourceKey}`}
            style={{ width: '100%' }}
            value={choice}
            disabled={busy || disabled || !status.confirmed}
            options={Object.entries(groupNames).map(([value, label]) => ({ value, label }))}
            onChange={(value: TimeGroup) => {
              setChoice(value);
              setPending(null);
              onDirty(true);
            }}
          />
        </>
      ) : (
        <>
          <p>
            共 {status.weeks} 个教学周，按排课建议分为前 {status.recommendedSplit} 周和后{' '}
            {status.weeks - status.recommendedSplit} 周。课程会自动匹配，无需逐门确认。
          </p>
          <p>
            当前安排：前半学期 1–{status.split} 周，后半学期 {status.split + 1}–{status.weeks} 周。
          </p>
          {status.canEdit ? (
            <label>
              前半学期结束周{' '}
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
            </label>
          ) : (
            <Alert type="info" title="学期分段由管理员统一确认" />
          )}
          {status.confirmed && (
            <Alert type="warning" title="修改分段后，前、后半学期日期需要重新确认" />
          )}
        </>
      )}
      {(course || status.canEdit) && (
        <Button
          disabled={busy || disabled || uncertain || (!!course && !status.confirmed)}
          onClick={() => void preview()}
        >
          {course ? '预览课程调整' : '预览学期安排'}
        </Button>
      )}
      {pending && (
        <>
          <Alert
            type="warning"
            showIcon
            title={
              course
                ? `将调整 ${pending.result.changes.length} 门课程`
                : `前半学期 1–${pending.result.split} 周，后半学期 ${pending.result.split + 1}–${pending.result.weeks} 周`
            }
            description={
              course
                ? '历史检查和已发送的操作保持原样。'
                : '确认后，普通课程自动采用相应安排；已有独立计划保持原样。'
            }
          />
          {!!pending.result.changes.length && (
            <Table
              rowKey="resourceKey"
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={pending.result.changes}
              columns={[
                { title: '课程', dataIndex: 'courseName' },
                { title: '采用安排', render: (_, row) => groupNames[row.group] },
                { title: '原日期', render: (_, row) => row.beforeDates.join(' / ') || '尚未设置' },
                {
                  title: '调整后',
                  render: (_, row) =>
                    row.afterDates.join(' / ') ||
                    (row.group === 'CUSTOM' ? '单独设置日期' : '需重新确认日期'),
                },
              ]}
            />
          )}
          <Button
            type="primary"
            loading={busy}
            disabled={busy || disabled || uncertain}
            onClick={() => {
              if (gate.current) return;
              gate.current = true;
              setBusy(true);
              onBusy(true);
              void api
                .grouping({ ...pending.input, previewToken: pending.result.previewToken }, true)
                .then(async () => {
                  setPending(null);
                  onDirty(false);
                  await onRefresh();
                  onSaved?.();
                })
                .catch((cause) => {
                  setUncertain(true);
                  setPending(null);
                  setError(groupingError(cause));
                })
                .finally(() => {
                  gate.current = false;
                  setBusy(false);
                  onBusy(false);
                });
            }}
          >
            {course ? '确认课程调整' : '确认学期分段'}
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
              .catch(() => setError('读取失败，请稍后重试'))
          }
        >
          重新读取安排
        </Button>
      )}
    </Space>
  );
}
