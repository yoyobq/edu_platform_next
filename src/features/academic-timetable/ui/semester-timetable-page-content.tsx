import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Select, Skeleton, Typography } from 'antd';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';

import type {
  AcademicTeacherSemesterScheduleItem,
  AcademicTeacherSemesterScheduleQueryFilters,
} from '../infrastructure/academic-timetable-api';

import { SemesterTimetableGrid } from './timetable-grid';

import './semester-timetable-page-content.css';

type SemesterTimetablePageContentProps = {
  defaultStaffId?: string | null;
  listAcademicSemesters: (input: { limit?: number }) => Promise<AcademicSemesterRecord[]>;
  listAcademicTeacherSemesterScheduleItems: (
    input: AcademicTeacherSemesterScheduleQueryFilters,
  ) => Promise<AcademicTeacherSemesterScheduleItem[]>;
};

type SemesterTimetableFilters = {
  staffId: string;
};

const REQUIRED_STAFF_ID_FILTER_MESSAGE = '学期课表以教师 + 学期为视口，请先填写教师 ID。';

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

export function SemesterTimetablePageContent({
  defaultStaffId,
  listAcademicSemesters,
  listAcademicTeacherSemesterScheduleItems,
}: SemesterTimetablePageContentProps) {
  const loaderDefaultStaffId = defaultStaffId?.trim() || '';
  const [filters, setFilters] = useState<SemesterTimetableFilters>({
    staffId: loaderDefaultStaffId,
  });
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [semesterScheduleItems, setSemesterScheduleItems] = useState<
    AcademicTeacherSemesterScheduleItem[]
  >([]);
  const [semesterScheduleItemsError, setSemesterScheduleItemsError] = useState<string | null>(null);
  const [semesterScheduleItemsLoading, setSemesterScheduleItemsLoading] = useState(false);
  const latestFiltersRef = useRef(filters);

  const hasSemesterQueryId = useMemo(
    () => Boolean(normalizeStringFilter(filters.staffId)),
    [filters.staffId],
  );
  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [semesters, selectedSemesterId],
  );

  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setSemesterError(null);

    try {
      const result = sortSemesters(await listAcademicSemesters({ limit: 500 }));

      setSemesters(result);
      setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
    } catch (error) {
      setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期信息。');
    } finally {
      setSemestersLoading(false);
    }
  }, [listAcademicSemesters]);

  const loadSemesterScheduleItems = useCallback(
    async (semesterId: number, currentFilters: SemesterTimetableFilters) => {
      const normalizedStaffId = normalizeStringFilter(currentFilters.staffId);

      if (!normalizedStaffId) {
        setSemesterScheduleItemsError(null);
        setSemesterScheduleItems([]);
        return;
      }

      setSemesterScheduleItemsLoading(true);
      setSemesterScheduleItemsError(null);

      try {
        const result = await listAcademicTeacherSemesterScheduleItems({
          semesterId,
          staffId: normalizedStaffId,
        });

        setSemesterScheduleItems(result);
      } catch (error) {
        setSemesterScheduleItemsError(
          error instanceof Error ? error.message : '暂时无法加载学期课表。',
        );
        setSemesterScheduleItems([]);
      } finally {
        setSemesterScheduleItemsLoading(false);
      }
    },
    [listAcademicTeacherSemesterScheduleItems],
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
      setSemesterScheduleItems([]);
      return;
    }

    void loadSemesterScheduleItems(selectedSemesterId, latestFiltersRef.current);
  }, [loadSemesterScheduleItems, selectedSemesterId]);

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
        {!hasSemesterQueryId ? (
          <Alert showIcon title={REQUIRED_STAFF_ID_FILTER_MESSAGE} type="warning" />
        ) : null}

        <div className="semester-timetable-query-panel">
          <div className="semester-timetable-summary">
            {selectedSemester ? (
              <>
                <div className="semester-timetable-summary-heading">
                  <span className="semester-timetable-summary-eyebrow">当前学期</span>
                  <p className="semester-timetable-summary-title">{selectedSemester.name}</p>
                </div>
                <div className="semester-timetable-summary-meta">
                  <div className="semester-timetable-summary-meta-item">
                    <span>教学开始</span>
                    <strong>{formatSemesterDate(selectedSemester.firstTeachingDate)}</strong>
                  </div>
                  <div className="semester-timetable-summary-meta-item">
                    <span>考试周开始</span>
                    <strong>{formatSemesterDate(selectedSemester.examStartDate)}</strong>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="semester-timetable-controls">
            <div>
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

            <div>
              <Typography.Text strong>教师 ID</Typography.Text>
              <Input
                style={{ marginTop: 8 }}
                placeholder={loaderDefaultStaffId || '默认尝试带出当前登录用户 staffId'}
                value={filters.staffId}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    staffId: event.target.value,
                  }));
                }}
              />
            </div>

            <Button
              block
              type="primary"
              loading={semesterScheduleItemsLoading}
              disabled={selectedSemesterId === null || !hasSemesterQueryId}
              onClick={() => {
                if (selectedSemesterId === null) {
                  return;
                }

                void loadSemesterScheduleItems(selectedSemesterId, filters);
              }}
            >
              查询学期课表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            学期课表
          </Typography.Title>
          {renderQueryControls()}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        {semesterScheduleItemsError ? (
          <Alert showIcon title={semesterScheduleItemsError} type="error" />
        ) : null}
        {semesterScheduleItemsLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <SemesterTimetableGrid
            emptyDescription="当前教师在该学期还没有命中的排课项"
            items={semesterScheduleItems}
          />
        )}
      </div>
    </div>
  );
}
