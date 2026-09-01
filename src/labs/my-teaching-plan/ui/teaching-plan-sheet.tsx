import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DownloadOutlined,
  EnvironmentOutlined,
  FileExcelOutlined,
  FormOutlined,
  LaptopOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Collapse,
  Flex,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';

import {
  formatTeachingPlanBusinessDate,
  formatTeachingPlanCalcEffect,
  formatTeachingPlanWeekday,
  type TeachingPlanCourseProjection,
} from '../application/teaching-plan-projection';
import {
  buildTeachingPlanSheetRows,
  fillEmptyTeachingPlanLocations,
  type TeachingPlanCourseDraft,
  type TeachingPlanDeliveryMode,
  updateTeachingPlanRowDraft,
} from '../application/teaching-plan-sheet';
import {
  buildTeachingPlanDraftStorageKey,
  readTeachingPlanCourseDraft,
  TEACHING_PLAN_DRAFT_TTL_HOURS,
  writeTeachingPlanCourseDraft,
} from '../infrastructure/draft-storage';
import { exportTeachingPlanExcel } from '../infrastructure/teaching-plan-excel-export';
import type { TeachingPlanOccurrence } from '../types';

const DELIVERY_MODE_OPTIONS = [
  { label: '线下', value: 'OFFLINE' },
  { label: '线上', value: 'ONLINE' },
] satisfies readonly { label: string; value: TeachingPlanDeliveryMode }[];

export function TeachingPlanSheet({
  course,
  currentAccountId,
  isCompact,
  semesterId,
  semesterName,
  targetStaffId,
  teacherName,
}: {
  course: TeachingPlanCourseProjection;
  currentAccountId: number;
  isCompact: boolean;
  semesterId: number;
  semesterName: string;
  targetStaffId: string;
  teacherName: string;
}) {
  const { message } = AntApp.useApp();
  const storageKey = useMemo(
    () =>
      buildTeachingPlanDraftStorageKey({
        currentAccountId,
        scheduleId: course.scheduleId,
        semesterId,
        targetStaffId,
      }),
    [course.scheduleId, currentAccountId, semesterId, targetStaffId],
  );
  const [draft, setDraft] = useState<TeachingPlanCourseDraft>(() =>
    readTeachingPlanCourseDraft(storageKey),
  );
  const [isExporting, setIsExporting] = useState(false);
  const draftRef = useRef(draft);

  useEffect(() => {
    const nextDraft = readTeachingPlanCourseDraft(storageKey);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, [storageKey]);

  const rows = useMemo(() => buildTeachingPlanSheetRows(course, draft), [course, draft]);
  const rowKeys = useMemo(() => rows.map((row) => row.rowKey), [rows]);
  const firstLocation = rows.find((row) => row.location.trim())?.location.trim() ?? '';
  const emptyLocationCount = rows.filter((row) => !row.location.trim()).length;

  const applyDraft = (nextDraft: TeachingPlanCourseDraft) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    writeTeachingPlanCourseDraft(storageKey, nextDraft);
  };

  const updateRow = (
    rowKey: string,
    patch: Parameters<typeof updateTeachingPlanRowDraft>[0]['patch'],
  ) => {
    applyDraft(
      updateTeachingPlanRowDraft({
        draft: draftRef.current,
        patch,
        rowKey,
      }),
    );
  };

  const commitInitialLocation = (location: string) => {
    const current = draftRef.current;
    if (current.initialLocationApplied || !location.trim()) {
      return;
    }

    const result = fillEmptyTeachingPlanLocations({
      draft: current,
      location,
      markInitialApplied: true,
      rowKeys,
    });
    applyDraft(result.draft);

    if (result.filledCount > 0) {
      void message.success(
        `已将“${location.trim()}”填入本课程其余 ${result.filledCount} 个空白课次`,
      );
    }
  };

  const fillRemainingLocations = () => {
    if (!firstLocation) {
      return;
    }

    const result = fillEmptyTeachingPlanLocations({
      draft: draftRef.current,
      location: firstLocation,
      rowKeys,
    });
    applyDraft(result.draft);
    void message.success(`已填充 ${result.filledCount} 个空白授课地点`);
  };

  const handleExport = async () => {
    if (isExporting || rows.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      await exportTeachingPlanExcel({
        courseName: course.courseName,
        rows,
        teachingClassName: course.teachingClassName,
      });
      void message.success('Excel 已导出；需要长期保留时，请妥善保存该文件');
    } catch {
      void message.error('Excel 导出失败，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-bg-container shadow-card">
        <div className="flex flex-col gap-4 border-b border-border p-4">
          <Flex gap="middle" justify="space-between" vertical={isCompact}>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <FileExcelOutlined className="text-success" />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  课程教学计划
                </Typography.Title>
                <Tag color="blue">Excel A–E</Tag>
                <Tag icon={<FormOutlined />}>本地草稿</Tag>
              </div>
              <Typography.Text type="secondary">
                每行对应一个真源课次片段；连续四节若已切成两个双节片段，将保持为两行。
              </Typography.Text>
            </div>
            <Space wrap>
              {firstLocation && emptyLocationCount > 0 ? (
                <Button icon={<EnvironmentOutlined />} onClick={fillRemainingLocations}>
                  填充 {emptyLocationCount} 个空白地点
                </Button>
              ) : null}
              <Button
                disabled={rows.length === 0}
                icon={<DownloadOutlined />}
                loading={isExporting}
                type="primary"
                onClick={() => void handleExport()}
              >
                导出 Excel
              </Button>
            </Space>
          </Flex>

          <div>
            <Alert
              description={`授课方式和地点只保存在当前浏览器，最后一次编辑 ${TEACHING_PLAN_DRAFT_TTL_HOURS} 小时后自动清除，服务器不会保存。需要长期保留时，请以导出的 Excel 文件为准。`}
              showIcon
              title="这是限时本地草稿，请及时导出"
              type="warning"
            />
          </div>

          <div
            className="grid gap-4 bg-bg-layout p-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
          >
            <SheetMeta label="课程" value={course.courseName} />
            <SheetMeta label="教学班" value={course.teachingClassName} />
            <SheetMeta label="教师" value={teacherName} />
            <SheetMeta label="学期" value={semesterName} />
            <SheetMeta label="计划行" value={`${rows.length} 行`} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            aria-label={`${course.courseName}课程教学计划`}
            className="w-full min-w-[800px] border-separate border-spacing-0 text-sm"
          >
            <colgroup>
              <col className="w-12" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-32" />
              <col />
            </colgroup>
            <thead>
              <tr className="bg-bg-layout text-xs text-text-tertiary">
                <th className="border-b border-r border-border px-3 py-2" scope="col">
                  #
                </th>
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <th
                    className="border-b border-r border-border px-3 py-2 font-medium last:border-r-0"
                    key={letter}
                    scope="col"
                  >
                    {letter}
                  </th>
                ))}
              </tr>
              <tr className="bg-fill-secondary text-left text-text">
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  行
                </th>
                <th className="border-b border-r border-border px-3 py-3" scope="col">
                  授课时间
                </th>
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  学时数
                </th>
                <th className="border-b border-r border-border px-3 py-3 text-center" scope="col">
                  节次
                </th>
                <th className="border-b border-r border-border px-3 py-3" scope="col">
                  授课方式
                </th>
                <th className="border-b border-border px-3 py-3" scope="col">
                  授课地点
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  className="transition-colors duration-150 hover:bg-fill-secondary"
                  key={row.rowKey}
                >
                  <td className="border-b border-r border-border bg-bg-layout px-3 py-3 text-center text-xs text-text-tertiary">
                    {index + 2}
                  </td>
                  <td className="border-b border-r border-border px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-text">{row.teachingDate}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span>{formatTeachingPlanWeekday(row.occurrence.physicalDayOfWeek)}</span>
                        <span>第 {row.occurrence.weekIndex} 周</span>
                        {row.occurrence.calcEffect !== 'NORMAL' ? (
                          <Tag color={row.occurrence.calcEffect === 'MAKEUP' ? 'green' : 'purple'}>
                            {formatTeachingPlanCalcEffect(row.occurrence.calcEffect)}
                          </Tag>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                    {row.teachingHours}
                  </td>
                  <td className="border-b border-r border-border px-3 py-3 text-center font-medium text-text">
                    {row.periodsText}
                  </td>
                  <td className="border-b border-r border-border px-2 py-2">
                    <Select<TeachingPlanDeliveryMode>
                      aria-label={`${row.teachingDate}第${row.periodsText}节授课方式`}
                      options={DELIVERY_MODE_OPTIONS}
                      size="small"
                      value={row.deliveryMode}
                      variant="borderless"
                      style={{ width: '100%' }}
                      onChange={(deliveryMode) => updateRow(row.rowKey, { deliveryMode })}
                    />
                  </td>
                  <td className="border-b border-border px-2 py-2">
                    <Input
                      aria-label={`${row.teachingDate}第${row.periodsText}节授课地点`}
                      placeholder={
                        row.sourceClassroomName
                          ? `填写地点（课表参考：${row.sourceClassroomName}）`
                          : '填写授课地点'
                      }
                      size="small"
                      value={row.location}
                      variant="borderless"
                      onBlur={(event) => commitInitialLocation(event.currentTarget.value)}
                      onChange={(event) => updateRow(row.rowKey, { location: event.target.value })}
                      onPressEnter={(event) => event.currentTarget.blur()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 bg-bg-layout p-3 text-xs text-text-secondary">
          <LaptopOutlined className="mt-0.5" />
          <span>
            每次打开页面都会根据当前真源重新生成 A–C；本地草稿只匹配当前仍存在的课次行。
            F“授课章节与内容”和 G“课外作业”暂留空后直接导出。
          </span>
        </div>
      </div>

      {course.adjustmentOccurrences.length ? (
        <Collapse
          ghost={isCompact}
          items={[
            {
              children: (
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  {course.adjustmentOccurrences.map((occurrence) => (
                    <AdjustmentRow
                      key={`${occurrence.date}:${occurrence.slotId}:${occurrence.calcEffect}`}
                      occurrence={occurrence}
                    />
                  ))}
                </Space>
              ),
              key: 'adjustments',
              label: `停课与调出记录（${course.adjustmentOccurrences.length}）`,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function SheetMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="truncate font-medium text-text" title={value}>
        {value}
      </span>
    </div>
  );
}

function AdjustmentRow({ occurrence }: { occurrence: TeachingPlanOccurrence }) {
  return (
    <Card size="small">
      <Flex gap="small" justify="space-between" wrap>
        <Space wrap size="small">
          <Tag color={occurrence.calcEffect === 'CANCEL' ? 'red' : 'orange'}>
            {formatTeachingPlanCalcEffect(occurrence.calcEffect)}
          </Tag>
          <Typography.Text>
            {formatTeachingPlanBusinessDate(occurrence.date)} ·{' '}
            {formatTeachingPlanWeekday(occurrence.physicalDayOfWeek)}
          </Typography.Text>
          <Typography.Text type="secondary">
            第 {occurrence.periodStart}
            {occurrence.periodEnd === occurrence.periodStart ? '' : `–${occurrence.periodEnd}`} 节
          </Typography.Text>
        </Space>
        {occurrence.classroomName ? (
          <Typography.Text type="secondary">{occurrence.classroomName}</Typography.Text>
        ) : null}
      </Flex>
    </Card>
  );
}
