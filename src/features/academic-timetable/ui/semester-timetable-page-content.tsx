import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TableOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Typography } from 'antd';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
  VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT,
} from '@/entities/academic-semester';
import {
  resolveStaffDirectoryEntries,
  resolveStaffDirectoryTeacherStaffId,
  StaffDirectoryTeacherAutoComplete,
  useStaffDirectoryTeachers,
} from '@/entities/upstream-session';

import type { AcademicInternalViewerRole } from '@/shared/auth-access';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import type {
  AcademicTeacherSemesterScheduleItem,
  AcademicTeacherSemesterScheduleQueryFilters,
  ListAcademicSemestersInput,
  MyAcademicTeacherSemesterScheduleQueryFilters,
} from '../infrastructure/academic-timetable-api';

import { SemesterTimetableGrid } from './timetable-grid';

import './semester-timetable-page-content.css';

type SemesterTimetablePageContentProps = {
  defaultStaffId?: string | null;
  listAcademicSemesters: (input: ListAcademicSemestersInput) => Promise<AcademicSemesterRecord[]>;
  listAcademicTeacherSemesterScheduleItems: (
    input: AcademicTeacherSemesterScheduleQueryFilters,
  ) => Promise<AcademicTeacherSemesterScheduleItem[]>;
  listMyAcademicTeacherSemesterScheduleItems?: (
    input: MyAcademicTeacherSemesterScheduleQueryFilters,
  ) => Promise<AcademicTeacherSemesterScheduleItem[]>;
  viewerRole?: AcademicInternalViewerRole;
};

type SemesterTimetableFilters = {
  staffId: string;
};

const REQUIRED_STAFF_ID_FILTER_MESSAGE = '请选择或输入教师后再查询学期课表';

function sortSemesters(records: AcademicSemesterRecord[]) {
  return sortAcademicSemestersForDisplay(records);
}

function pickNextSemesterId(records: AcademicSemesterRecord[], currentSelection: number | null) {
  return pickAcademicSemesterId(records, currentSelection);
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
  listMyAcademicTeacherSemesterScheduleItems,
  viewerRole = 'admin',
}: SemesterTimetablePageContentProps) {
  const loaderDefaultStaffId = defaultStaffId?.trim() || '';
  const isStaffViewer = viewerRole === 'staff';
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
  const [resolvedStaffName, setResolvedStaffName] = useState<string | null>(null);
  const [staffNameLoading, setStaffNameLoading] = useState(false);
  const submittedFiltersRef = useRef<SemesterTimetableFilters>({ staffId: loaderDefaultStaffId });
  const activeStaffNameRequestIdRef = useRef(0);
  const [submittedStaffId, setSubmittedStaffId] = useState(loaderDefaultStaffId);
  const {
    error: staffDirectoryError,
    loading: staffDirectoryLoading,
    teachers: staffDirectoryTeachers,
  } = useStaffDirectoryTeachers();

  const normalizedStaffId = useMemo(
    () => resolveStaffDirectoryTeacherStaffId(filters.staffId, staffDirectoryTeachers),
    [filters.staffId, staffDirectoryTeachers],
  );
  const hasSemesterQueryId = useMemo(
    () => isStaffViewer || Boolean(normalizedStaffId),
    [isStaffViewer, normalizedStaffId],
  );
  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [semesters, selectedSemesterId],
  );

  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setSemesterError(null);

    try {
      const result = sortSemesters(
        await listAcademicSemesters(VISIBLE_ACADEMIC_SEMESTERS_QUERY_INPUT),
      );

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
      const normalizedQueryStaffId = resolveStaffDirectoryTeacherStaffId(
        currentFilters.staffId,
        staffDirectoryTeachers,
      );

      if (!isStaffViewer && !normalizedQueryStaffId) {
        setSemesterScheduleItemsError(null);
        setSemesterScheduleItems([]);
        return;
      }

      setSubmittedStaffId(normalizedQueryStaffId ?? loaderDefaultStaffId);
      setSemesterScheduleItemsLoading(true);
      setSemesterScheduleItemsError(null);

      try {
        const result =
          isStaffViewer && listMyAcademicTeacherSemesterScheduleItems
            ? await listMyAcademicTeacherSemesterScheduleItems({
                semesterId,
              })
            : await listAcademicTeacherSemesterScheduleItems({
                semesterId,
                staffId: normalizedQueryStaffId ?? loaderDefaultStaffId,
              });

        if (isStaffViewer) {
          setSubmittedStaffId(result[0]?.staffId ?? loaderDefaultStaffId);
        }
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
    [
      isStaffViewer,
      listAcademicTeacherSemesterScheduleItems,
      listMyAcademicTeacherSemesterScheduleItems,
      loaderDefaultStaffId,
      staffDirectoryTeachers,
    ],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

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

    void loadSemesterScheduleItems(selectedSemesterId, submittedFiltersRef.current);
  }, [loadSemesterScheduleItems, selectedSemesterId]);

  useEffect(() => {
    if (!submittedStaffId) {
      activeStaffNameRequestIdRef.current += 1;
      setResolvedStaffName(null);
      setStaffNameLoading(false);
      return;
    }

    const requestId = activeStaffNameRequestIdRef.current + 1;
    activeStaffNameRequestIdRef.current = requestId;
    setStaffNameLoading(true);

    resolveStaffDirectoryEntries([submittedStaffId])
      .then((result) => {
        if (activeStaffNameRequestIdRef.current !== requestId) {
          return;
        }

        const matchedEntry = result.entries.find((entry) => entry.staffId === submittedStaffId);
        setResolvedStaffName(matchedEntry?.name.trim() || null);
      })
      .catch(() => {
        if (activeStaffNameRequestIdRef.current === requestId) {
          setResolvedStaffName(null);
        }
      })
      .finally(() => {
        if (activeStaffNameRequestIdRef.current === requestId) {
          setStaffNameLoading(false);
        }
      });
  }, [submittedStaffId]);

  function renderQueryControls() {
    if (semesterError) {
      return (
        <div className="semester-timetable-query-state">
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
        </div>
      );
    }

    if (semestersLoading) {
      return (
        <div className="semester-timetable-query-state">
          <Skeleton active paragraph={{ rows: 1 }} title={false} />
        </div>
      );
    }

    if (!semesters.length) {
      return (
        <div className="semester-timetable-query-state">
          <Empty description="当前还没有可用学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return (
      <div className="semester-timetable-query-content">
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
                    <span>教师姓名</span>
                    <strong>
                      {staffNameLoading
                        ? '读取中'
                        : resolvedStaffName || submittedStaffId || '未填写'}
                    </strong>
                  </div>
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
            <div className="semester-timetable-control-field">
              <Typography.Text strong>学期</Typography.Text>
              <div className="semester-timetable-control-input">
                <AcademicSemesterSelect
                  value={selectedSemesterId ?? undefined}
                  records={semesters}
                  onChange={(value) => setSelectedSemesterId(value)}
                />
              </div>
            </div>

            <div className="semester-timetable-control-field">
              <Typography.Text strong>教师</Typography.Text>
              <div className="semester-timetable-control-input">
                <StaffDirectoryTeacherAutoComplete
                  disabled={isStaffViewer}
                  directoryUnavailableContent={
                    staffDirectoryError ? '目录不可用，可手动输入' : undefined
                  }
                  loading={staffDirectoryLoading}
                  popupMatchSelectWidth={240}
                  placeholder={isStaffViewer ? '当前登录教师' : 'ID 或姓名'}
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
              <span
                className={`semester-timetable-control-help ${
                  hasSemesterQueryId ? 'semester-timetable-control-help-hidden' : ''
                }`}
              >
                {REQUIRED_STAFF_ID_FILTER_MESSAGE}
              </span>
            </div>

            <div className="semester-timetable-control-action">
              <Button
                block
                type="primary"
                loading={semesterScheduleItemsLoading}
                disabled={selectedSemesterId === null || !hasSemesterQueryId}
                onClick={() => {
                  if (selectedSemesterId === null) {
                    return;
                  }

                  const submittedFilters = { staffId: normalizedStaffId };

                  submittedFiltersRef.current = submittedFilters;
                  void loadSemesterScheduleItems(selectedSemesterId, submittedFilters);
                }}
              >
                查询学期课表
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DecoratedPageHeader
        description="按教师和学期查看排课分布"
        icon={<TableOutlined />}
        title="学期课表"
      />

      <Card styles={{ body: { overflow: 'hidden', padding: 0 } }}>{renderQueryControls()}</Card>

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
