import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import type { AcademicInternalViewerRole } from '@/shared/auth-access';
import {
  resolveStaffDirectoryTeacherStaffId,
  type StaffDirectoryEntry,
  StaffDirectoryTeacherAutoComplete,
  useStaffDirectoryTeachers,
} from '@/shared/upstream';

import { academicTimetableLabAccess } from './access';
import {
  type AcademicTimetableItem,
  type AcademicTimetableQueryFilters,
  requestAcademicWeeklyTimetableItems,
  requestMyAcademicSemesterTimetableItems,
} from './api';
import { resolveCurrentTeachingWeekIndex } from './helpers';
import { academicTimetableLabMeta } from './meta';
import { WeeklyTimetableGrid } from './timetable-grid';

type AcademicTimetableLabLoaderData = {
  defaultStaffId?: string | null;
  viewerRole?: AcademicInternalViewerRole;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type WeeklyTimetableFilters = {
  staffId: string;
  sstsCourseId: string;
  sstsTeachingClassId: string;
  weekIndex: number;
};

const REQUIRED_ID_FILTER_MESSAGE =
  '请至少填写教师 ID、上游教学班 ID、上游课程 ID 之一，再发起课表查询。';
const DEFAULT_FILTERS: WeeklyTimetableFilters = {
  staffId: '',
  sstsCourseId: '',
  sstsTeachingClassId: '',
  weekIndex: 1,
};

function sortSemesters(records: AcademicSemesterRecord[]) {
  return [...records].sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) {
      return left.isCurrent ? -1 : 1;
    }

    if (left.schoolYear !== right.schoolYear) {
      return right.schoolYear - left.schoolYear;
    }

    if (left.termNumber !== right.termNumber) {
      return right.termNumber - left.termNumber;
    }

    return right.id - left.id;
  });
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  if (currentSelection !== null && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records.find((record) => record.isCurrent)?.id ?? records[0]?.id ?? null;
}

function formatSemesterDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN');
}

function normalizeStringFilter(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function buildSharedQueryFilters(
  semesterId: number,
  filters: WeeklyTimetableFilters,
  teachers: readonly StaffDirectoryEntry[],
): AcademicTimetableQueryFilters {
  return {
    semesterId,
    staffId: resolveStaffDirectoryTeacherStaffId(filters.staffId, teachers) || undefined,
    sstsCourseId: normalizeStringFilter(filters.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(filters.sstsTeachingClassId),
  };
}

function hasAtLeastOneQueryId(
  filters: WeeklyTimetableFilters,
  teachers: readonly StaffDirectoryEntry[],
) {
  return Boolean(
    resolveStaffDirectoryTeacherStaffId(filters.staffId, teachers) ||
    normalizeStringFilter(filters.sstsCourseId) ||
    normalizeStringFilter(filters.sstsTeachingClassId),
  );
}

export function AcademicTimetableLabPage() {
  const loaderData = useLoaderData() as AcademicTimetableLabLoaderData;
  const loaderDefaultStaffId = loaderData?.defaultStaffId?.trim() || '';
  const isStaffViewer = loaderData?.viewerRole === 'staff';
  const roleLabel = loaderData?.viewerKind === 'internal' ? '内部用户' : '登录用户';

  const [filters, setFilters] = useState<WeeklyTimetableFilters>({
    ...DEFAULT_FILTERS,
    staffId: loaderDefaultStaffId,
  });
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [timetableItems, setTimetableItems] = useState<AcademicTimetableItem[]>([]);
  const [timetableItemsError, setTimetableItemsError] = useState<string | null>(null);
  const [timetableItemsLoading, setTimetableItemsLoading] = useState(false);
  const autoFilledWeekSemesterIdRef = useRef<number | null>(null);
  const hasUserEditedWeekIndexRef = useRef(false);
  const latestFiltersRef = useRef(filters);
  const {
    error: staffDirectoryError,
    loading: staffDirectoryLoading,
    teachers: staffDirectoryTeachers,
  } = useStaffDirectoryTeachers();

  const hasAnyQueryId = useMemo(
    () => isStaffViewer || hasAtLeastOneQueryId(filters, staffDirectoryTeachers),
    [filters, isStaffViewer, staffDirectoryTeachers],
  );
  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [semesters, selectedSemesterId],
  );

  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setSemesterError(null);

    try {
      const result = sortSemesters(await requestAcademicSemesters({ limit: 500 }));

      setSemesters(result);
      setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
    } catch (error) {
      setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期信息。');
    } finally {
      setSemestersLoading(false);
    }
  }, []);

  const loadTimetableItems = useCallback(
    async (semesterId: number, currentFilters: WeeklyTimetableFilters) => {
      if (!isStaffViewer && !hasAtLeastOneQueryId(currentFilters, staffDirectoryTeachers)) {
        setTimetableItemsError(null);
        setTimetableItems([]);
        return;
      }

      setTimetableItemsLoading(true);
      setTimetableItemsError(null);

      try {
        const result = isStaffViewer
          ? (
              await requestMyAcademicSemesterTimetableItems(
                buildSharedQueryFilters(semesterId, currentFilters, staffDirectoryTeachers),
              )
            ).filter((item) => item.weekIndex === currentFilters.weekIndex)
          : await requestAcademicWeeklyTimetableItems({
              ...buildSharedQueryFilters(semesterId, currentFilters, staffDirectoryTeachers),
              weekIndex: currentFilters.weekIndex,
            });

        setTimetableItems(result);
      } catch (error) {
        setTimetableItemsError(error instanceof Error ? error.message : '暂时无法加载课表。');
        setTimetableItems([]);
      } finally {
        setTimetableItemsLoading(false);
      }
    },
    [isStaffViewer, staffDirectoryTeachers],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    latestFiltersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (!loaderDefaultStaffId) {
      return;
    }

    setFilters((current) => {
      if (normalizeStringFilter(current.staffId)) {
        return current;
      }

      return {
        ...current,
        staffId: loaderDefaultStaffId,
      };
    });
  }, [loaderDefaultStaffId]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setTimetableItems([]);
      return;
    }

    let currentFilters = latestFiltersRef.current;

    if (
      selectedSemester &&
      !hasUserEditedWeekIndexRef.current &&
      autoFilledWeekSemesterIdRef.current !== selectedSemester.id
    ) {
      const currentTeachingWeekIndex = resolveCurrentTeachingWeekIndex(selectedSemester);

      if (currentTeachingWeekIndex !== null) {
        autoFilledWeekSemesterIdRef.current = selectedSemester.id;
        currentFilters = {
          ...currentFilters,
          weekIndex: currentTeachingWeekIndex,
        };
        latestFiltersRef.current = currentFilters;
        setFilters((current) =>
          current.weekIndex === currentTeachingWeekIndex
            ? current
            : {
                ...current,
                weekIndex: currentTeachingWeekIndex,
              },
        );
      }
    }

    void loadTimetableItems(selectedSemesterId, currentFilters);
  }, [loadTimetableItems, selectedSemester, selectedSemesterId]);

  function renderQueryControls() {
    if (semesterError) {
      return (
        <Alert
          action={
            <Button size="small" type="primary" onClick={() => void loadSemesters()}>
              重试
            </Button>
          }
          showIcon
          title={semesterError}
          type="error"
        />
      );
    }

    if (semestersLoading) {
      return <Skeleton active paragraph={{ rows: 1 }} title={false} />;
    }

    if (!semesters.length) {
      return <Empty description="当前还没有可用学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div className="flex flex-col gap-4">
        {!hasAnyQueryId ? (
          <Alert showIcon title={REQUIRED_ID_FILTER_MESSAGE} type="warning" />
        ) : null}

        <div className="flex flex-wrap gap-4">
          <div className="min-w-56 flex-1">
            <Typography.Text strong>学期</Typography.Text>
            <Select
              style={{ marginTop: 8, width: '100%' }}
              value={selectedSemesterId ?? undefined}
              options={semesters.map((semester) => ({
                label: semester.isCurrent ? `${semester.name} · 当前` : semester.name,
                value: semester.id,
              }))}
              onChange={(value) => setSelectedSemesterId(value)}
            />
          </div>

          <div className="min-w-40 flex-1">
            <Typography.Text strong>教师</Typography.Text>
            <StaffDirectoryTeacherAutoComplete
              disabled={isStaffViewer}
              directoryUnavailableContent={
                staffDirectoryError ? '目录不可用，可手动输入' : undefined
              }
              loading={staffDirectoryLoading}
              popupMatchSelectWidth={240}
              style={{ marginTop: 8 }}
              placeholder={
                isStaffViewer
                  ? '本人课表由当前登录身份确定'
                  : loaderDefaultStaffId || '默认尝试带出当前登录用户 staffId'
              }
              teachers={staffDirectoryTeachers}
              value={filters.staffId}
              onChange={(value) => {
                setFilters((current) => ({
                  ...current,
                  staffId: value,
                }));
              }}
            />
          </div>

          <div className="min-w-40 flex-1">
            <Typography.Text strong>上游教学班 ID</Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="sstsTeachingClassId"
              value={filters.sstsTeachingClassId}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  sstsTeachingClassId: event.target.value,
                }));
              }}
            />
          </div>

          <div className="min-w-40 flex-1">
            <Typography.Text strong>上游课程 ID</Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder="sstsCourseId"
              value={filters.sstsCourseId}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  sstsCourseId: event.target.value,
                }));
              }}
            />
          </div>

          <div className="w-32">
            <Typography.Text strong>教学周</Typography.Text>
            <InputNumber
              style={{ marginTop: 8, width: '100%' }}
              min={1}
              value={filters.weekIndex}
              onChange={(value) => {
                hasUserEditedWeekIndexRef.current = true;
                setFilters((current) => ({
                  ...current,
                  weekIndex: typeof value === 'number' ? value : 1,
                }));
              }}
            />
          </div>

          <div className="flex min-w-32 items-end">
            <Button
              block
              type="primary"
              loading={timetableItemsLoading}
              disabled={selectedSemesterId === null || !hasAnyQueryId}
              onClick={() => {
                if (selectedSemesterId === null) {
                  return;
                }

                void loadTimetableItems(selectedSemesterId, filters);
              }}
            >
              查询周课表
            </Button>
          </div>
        </div>

        {selectedSemester ? (
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2, lg: 4 }}
            items={[
              {
                key: 'semester-name',
                label: '学期名称',
                children: selectedSemester.name,
              },
              {
                key: 'semester-start',
                label: '开始日期',
                children: formatSemesterDate(selectedSemester.startDate),
              },
              {
                key: 'semester-first-teaching',
                label: '教学开始',
                children: formatSemesterDate(selectedSemester.firstTeachingDate),
              },
              {
                key: 'semester-end',
                label: '结束日期',
                children: formatSemesterDate(selectedSemester.endDate),
              },
            ]}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              周课表视图
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {academicTimetableLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{academicTimetableLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{academicTimetableLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{academicTimetableLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{academicTimetableLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
            <Tag color="cyan">当前身份：{roleLabel}</Tag>
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            当前页面在管理视角以 listAcademicWeeklyPlannedTimetable 作为基础课表视图；普通 staff
            视角读取 listMyAcademicSemesterPlannedTimetable 后按周过滤。
          </Typography.Paragraph>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          {renderQueryControls()}
          {timetableItemsError ? <Alert showIcon title={timetableItemsError} type="error" /> : null}
          {timetableItemsLoading ? (
            <Skeleton active paragraph={{ rows: 10 }} />
          ) : (
            <WeeklyTimetableGrid
              emptyDescription="当前教学周没有命中的课表项"
              items={timetableItems}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
