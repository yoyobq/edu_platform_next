// src/features/staff-semester-profiles/ui/backfill-panel.tsx
import { Alert, Button, Card, Empty, Popconfirm, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

import {
  BACKFILL_ACTION_LABELS,
  BACKFILL_ACTION_TAG_COLORS,
  BACKFILL_BLOCKING_REASON_LABELS,
  TEACHER_ENGAGEMENT_TYPE_LABELS,
  TEACHER_ENGAGEMENT_TYPE_TAG_COLORS,
} from '../application/labels';
import type { EntitySelectOption } from '../application/options';
import type {
  AcademicTeacherEngagementType,
  BackfillStaffSemesterProfilesFromCourseSchedulesItem,
  BackfillStaffSemesterProfilesFromCourseSchedulesResult,
  StaffSemesterProfileBackfillAction,
  StaffSemesterProfileBackfillBlockingReason,
} from '../infrastructure/staff-semester-profiles-api';

import { renderEmptyText, renderSingleLineText } from './cell-renderers';

type StaffSemesterProfilesBackfillPanelProps = {
  backfillResult: BackfillStaffSemesterProfilesFromCourseSchedulesResult | null;
  canSubmitBackfill: boolean;
  departmentError: string | null;
  departmentOptions: EntitySelectOption[];
  executingBackfill: boolean;
  hasCurrentBackfillBlocking: boolean;
  isBackfillResultForCurrentSelection: boolean;
  loadingDepartments: boolean;
  onRunBackfill: (dryRun: boolean) => void;
  onWorkloadDepartmentChange: (value: string) => void;
  previewingBackfill: boolean;
  workloadDepartmentId: string;
};

function resolveBackfillItemRowKey(record: BackfillStaffSemesterProfilesFromCourseSchedulesItem) {
  return `${record.staffId}-${record.action}`;
}

const backfillColumns: ColumnsType<BackfillStaffSemesterProfilesFromCourseSchedulesItem> = [
  {
    dataIndex: 'staffId',
    fixed: 'left',
    key: 'staffId',
    render: (value: string) => (
      <Typography.Text ellipsis={{ tooltip: value }}>
        <span className="font-mono text-sm">{value}</span>
      </Typography.Text>
    ),
    title: '工号',
    width: 88,
  },
  {
    dataIndex: 'staffName',
    fixed: 'left',
    key: 'staffName',
    render: (value: string) => renderSingleLineText(value, { strong: true }),
    title: '姓名',
    width: 104,
  },
  {
    dataIndex: 'action',
    key: 'action',
    render: (value: StaffSemesterProfileBackfillAction) => (
      <Tag color={BACKFILL_ACTION_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
        {BACKFILL_ACTION_LABELS[value]}
      </Tag>
    ),
    title: '状态',
    width: 92,
  },
  {
    dataIndex: 'teacherEngagementType',
    key: 'teacherEngagementType',
    render: (value: AcademicTeacherEngagementType) => (
      <Tag color={TEACHER_ENGAGEMENT_TYPE_TAG_COLORS[value]} style={{ marginInlineEnd: 0 }}>
        {TEACHER_ENGAGEMENT_TYPE_LABELS[value]}
      </Tag>
    ),
    title: '聘任',
    width: 112,
  },
  {
    dataIndex: 'teachingGroupId',
    key: 'teachingGroupId',
    render: (value: string | null) => renderSingleLineText(value),
    title: '教研组 ID',
    width: 132,
  },
  {
    dataIndex: 'inheritedFromSemesterId',
    key: 'inheritedFromSemesterId',
    render: (value: number | null) =>
      value === null ? renderEmptyText() : <Typography.Text>{value}</Typography.Text>,
    title: '继承来源学期',
    width: 118,
  },
  {
    dataIndex: 'blockingReason',
    key: 'blockingReason',
    render: (value: StaffSemesterProfileBackfillBlockingReason) =>
      value ? (
        <Typography.Text type="danger">{BACKFILL_BLOCKING_REASON_LABELS[value]}</Typography.Text>
      ) : (
        renderEmptyText()
      ),
    title: '阻断原因',
    width: 240,
  },
];

export function StaffSemesterProfilesBackfillPanel({
  backfillResult,
  canSubmitBackfill,
  departmentError,
  departmentOptions,
  executingBackfill,
  hasCurrentBackfillBlocking,
  isBackfillResultForCurrentSelection,
  loadingDepartments,
  onRunBackfill,
  onWorkloadDepartmentChange,
  previewingBackfill,
  workloadDepartmentId,
}: StaffSemesterProfilesBackfillPanelProps) {
  return (
    <Card
      title={
        <div className="flex items-baseline gap-3">
          <span>从课程表补齐教师学期归属</span>
          <span className="text-sm font-normal text-text-secondary">
            先预览课程表候选教师，再批量创建缺失的学期归属
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {departmentError ? <Alert message={departmentError} showIcon type="warning" /> : null}

        <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 'minmax(0, 1fr) auto' }}>
          <label className="flex flex-col gap-2">
            <Typography.Text strong>工作量归口系</Typography.Text>
            <Select
              showSearch
              loading={loadingDepartments}
              optionFilterProp="label"
              options={departmentOptions}
              placeholder="请选择要写入的系部"
              value={workloadDepartmentId || undefined}
              onChange={onWorkloadDepartmentChange}
            />
          </label>

          <div className="flex items-end gap-3">
            <Button
              disabled={!canSubmitBackfill}
              loading={previewingBackfill}
              onClick={() => onRunBackfill(true)}
            >
              预览补齐
            </Button>
            <Popconfirm
              cancelText="取消"
              disabled={!canSubmitBackfill || hasCurrentBackfillBlocking}
              okButtonProps={{ loading: executingBackfill }}
              okText="确认补齐"
              title={
                backfillResult && isBackfillResultForCurrentSelection
                  ? `确认创建 ${backfillResult.creatableCount} 条教师学期归属？`
                  : '尚未预览，确认直接执行补齐？'
              }
              onConfirm={() => onRunBackfill(false)}
            >
              <Button
                disabled={!canSubmitBackfill || hasCurrentBackfillBlocking}
                loading={executingBackfill}
                type="primary"
              >
                确认补齐
              </Button>
            </Popconfirm>
          </div>
        </ResponsiveGrid>

        {hasCurrentBackfillBlocking ? (
          <Alert message="当前预览存在阻断项，确认补齐已禁用。" showIcon type="warning" />
        ) : null}

        {backfillResult ? (
          <div className="flex flex-col gap-4">
            <ResponsiveGrid className="gap-3" columns={{ compact: 1, regular: 3, wide: 5 }}>
              <div className="rounded-block border border-border bg-bg-container p-3">
                <Typography.Text type="secondary">候选教师</Typography.Text>
                <div className="mt-1 text-xl font-semibold">{backfillResult.candidateCount}</div>
              </div>
              <div className="rounded-block border border-border bg-bg-container p-3">
                <Typography.Text type="secondary">可创建</Typography.Text>
                <div className="mt-1 text-xl font-semibold">{backfillResult.creatableCount}</div>
              </div>
              <div className="rounded-block border border-border bg-bg-container p-3">
                <Typography.Text type="secondary">阻断</Typography.Text>
                <div className="mt-1 text-xl font-semibold">{backfillResult.blockingCount}</div>
              </div>
              <div className="rounded-block border border-border bg-bg-container p-3">
                <Typography.Text type="secondary">本次已创建</Typography.Text>
                <div className="mt-1 text-xl font-semibold">{backfillResult.createdCount}</div>
              </div>
              <div className="rounded-block border border-border bg-bg-container p-3">
                <Typography.Text type="secondary">执行时已存在</Typography.Text>
                <div className="mt-1 text-xl font-semibold">
                  {backfillResult.alreadyExistingCount}
                </div>
              </div>
            </ResponsiveGrid>

            <Table<BackfillStaffSemesterProfilesFromCourseSchedulesItem>
              columns={backfillColumns}
              dataSource={backfillResult.items}
              locale={{
                emptyText: (
                  <Empty description="暂无补齐明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              }}
              pagination={{ pageSize: 10, size: 'small' }}
              rowKey={resolveBackfillItemRowKey}
              scroll={{ x: 886 }}
              size="small"
              tableLayout="fixed"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
