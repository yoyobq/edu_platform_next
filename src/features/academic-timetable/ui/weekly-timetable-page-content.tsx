// src/features/academic-timetable/ui/weekly-timetable-page-content.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TableOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, InputNumber, Select, Skeleton, Typography } from 'antd';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import {
  isExpiredUpstreamSessionError,
  resolveStaffDirectoryCache,
  resolveStaffDirectoryTeacherStaffId,
  type StaffDirectoryResult,
  StaffDirectoryTeacherAutoComplete,
  type StoredUpstreamSession,
  type UpstreamAccountIdentity,
  useUpstreamSession,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  buildAcademicTeachingClassOptionLabel,
  resolveCurrentTeachingWeekIndex,
  resolveTeachingWeekCount,
  resolveTeachingWeekDateRange,
  type TeachingWeekDateRange,
} from '../application/timetable-grid';
import type {
  AcademicTeachingClassOption,
  AcademicTeachingClassOptionsQueryFilters,
  AcademicTimetableItem,
  AcademicWeeklyTimetableQueryFilters,
} from '../infrastructure/academic-timetable-api';

import { WeeklyTimetableGrid } from './timetable-grid';

import './weekly-timetable-page-content.css';

type WeeklyTimetablePageContentProps = {
  defaultStaffId?: string | null;
  listAcademicSemesters: (input: { limit?: number }) => Promise<AcademicSemesterRecord[]>;
  listAcademicTeachingClassOptions: (
    input: AcademicTeachingClassOptionsQueryFilters,
  ) => Promise<AcademicTeachingClassOption[]>;
  listAcademicWeeklyTimetableItems: (
    input: AcademicWeeklyTimetableQueryFilters,
  ) => Promise<AcademicTimetableItem[]>;
  lockedUpstreamLoginUserId?: string | null;
  upstreamAccount?: UpstreamAccountIdentity | null;
};

type WeeklyTimetableFilters = {
  staffId: string;
  sstsTeachingClassId: string;
  weekIndex: number;
};

const ENABLE_TEACHING_CLASS_FILTER = false;
const REQUIRED_QUERY_FILTER_MESSAGE = ENABLE_TEACHING_CLASS_FILTER
  ? '请选择教师或课程教学班后再查询每周课表'
  : '请选择教师后再查询每周课表';
const TEACHING_CLASS_OPTION_LIMIT = 50;
const TEACHING_CLASS_SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_FILTERS: WeeklyTimetableFilters = {
  staffId: '',
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

function normalizeStringFilter(value: string) {
  const normalizedValue = value.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function clampWeekIndex(value: number, maxWeekIndex: number | null) {
  const minValue = Math.max(1, value);

  return maxWeekIndex ? Math.min(minValue, maxWeekIndex) : minValue;
}

function formatMonthDay(value: string) {
  const [yearText, monthText, dayText] = value.split('-');
  const month = Number(monthText);
  const day = Number(dayText);

  if (!yearText || !month || !day) {
    return value;
  }

  return `${month}月${String(day).padStart(2, '0')}日`;
}

function formatWeekDateRange(range: TeachingWeekDateRange | null) {
  if (!range) {
    return null;
  }

  return `${formatMonthDay(range.startDate)} - ${formatMonthDay(range.endDate)}`;
}

function formatSemesterDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN');
}

function buildTeachingClassSelectOption(option: AcademicTeachingClassOption) {
  const label = buildAcademicTeachingClassOptionLabel(option);

  return {
    label,
    title: label,
    value: option.sstsTeachingClassId,
  };
}

export function WeeklyTimetablePageContent({
  defaultStaffId,
  listAcademicSemesters,
  listAcademicTeachingClassOptions,
  listAcademicWeeklyTimetableItems,
  lockedUpstreamLoginUserId = null,
  upstreamAccount = null,
}: WeeklyTimetablePageContentProps) {
  const {
    clear,
    persistSessionFromResult,
    session: storedSession,
  } = useUpstreamSession({
    account: upstreamAccount,
    lockedUserId: lockedUpstreamLoginUserId,
  });
  const storedSessionRef = useRef<StoredUpstreamSession | null>(storedSession);
  const loaderDefaultStaffId = defaultStaffId?.trim() || '';
  const [filters, setFilters] = useState<WeeklyTimetableFilters>({
    ...DEFAULT_FILTERS,
    staffId: loaderDefaultStaffId,
  });
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [staffDirectoryResult, setStaffDirectoryResult] = useState<StaffDirectoryResult | null>(
    null,
  );
  const [teachingClassKeyword, setTeachingClassKeyword] = useState('');
  const [teachingClassOptions, setTeachingClassOptions] = useState<AcademicTeachingClassOption[]>(
    [],
  );
  const [teachingClassOptionsError, setTeachingClassOptionsError] = useState<string | null>(null);
  const [teachingClassOptionsLoading, setTeachingClassOptionsLoading] = useState(false);
  const [timetableItems, setTimetableItems] = useState<AcademicTimetableItem[]>([]);
  const [timetableItemsError, setTimetableItemsError] = useState<string | null>(null);
  const [timetableItemsLoading, setTimetableItemsLoading] = useState(false);
  const [staffDirectoryError, setStaffDirectoryError] = useState<string | null>(null);
  const [staffDirectoryLoading, setStaffDirectoryLoading] = useState(false);
  const [hasSubmittedQuery, setHasSubmittedQuery] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const submittedFiltersRef = useRef<WeeklyTimetableFilters>({
    ...DEFAULT_FILTERS,
    staffId: loaderDefaultStaffId,
  });
  const storedSessionDirectoryKey = storedSession
    ? [
        storedSession.accountId,
        storedSession.upstreamLoginId || 'unknown',
        storedSession.upstreamSessionToken,
      ].join(':')
    : 'none';
  const staffDirectoryTeachers = useMemo(
    () => staffDirectoryResult?.teachers ?? [],
    [staffDirectoryResult?.teachers],
  );

  const selectedSemester = useMemo(
    () => semesters.find((record) => record.id === selectedSemesterId) ?? null,
    [semesters, selectedSemesterId],
  );
  const currentWeekIndex = useMemo(() => {
    if (!selectedSemester) {
      return null;
    }

    return resolveCurrentTeachingWeekIndex(selectedSemester);
  }, [selectedSemester]);
  const maxWeekIndex = useMemo(
    () => (selectedSemester ? resolveTeachingWeekCount(selectedSemester) : null),
    [selectedSemester],
  );
  const normalizedStaffId = useMemo(
    () => resolveStaffDirectoryTeacherStaffId(filters.staffId, staffDirectoryTeachers),
    [filters.staffId, staffDirectoryTeachers],
  );
  const hasQueryFilter = Boolean(
    normalizedStaffId ||
    (ENABLE_TEACHING_CLASS_FILTER && normalizeStringFilter(filters.sstsTeachingClassId)),
  );
  const displayWeekIndex = selectedWeekIndex ?? filters.weekIndex;
  const weekDateRangeLabel = useMemo(
    () =>
      formatWeekDateRange(
        selectedSemester ? resolveTeachingWeekDateRange(selectedSemester, displayWeekIndex) : null,
      ),
    [displayWeekIndex, selectedSemester],
  );
  const teachingClassSelectOptions = useMemo(
    () => teachingClassOptions.map(buildTeachingClassSelectOption),
    [teachingClassOptions],
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

  const loadTimetableItems = useCallback(
    async (semesterId: number, currentFilters: WeeklyTimetableFilters) => {
      const resolvedStaffId = resolveStaffDirectoryTeacherStaffId(
        currentFilters.staffId,
        staffDirectoryTeachers,
      );
      const resolvedTeachingClassId = ENABLE_TEACHING_CLASS_FILTER
        ? normalizeStringFilter(currentFilters.sstsTeachingClassId)
        : undefined;

      if (!resolvedStaffId && !resolvedTeachingClassId) {
        setTimetableItemsError(null);
        setTimetableItems([]);
        setHasSubmittedQuery(false);
        return;
      }

      setTimetableItemsLoading(true);
      setTimetableItemsError(null);

      try {
        const result = await listAcademicWeeklyTimetableItems({
          semesterId,
          staffId: resolvedStaffId,
          sstsTeachingClassId: resolvedTeachingClassId,
          weekIndex: currentFilters.weekIndex,
        });

        submittedFiltersRef.current = currentFilters;
        setTimetableItems(result);
        setSelectedWeekIndex(currentFilters.weekIndex);
        setHasSubmittedQuery(true);
      } catch (error) {
        setTimetableItemsError(error instanceof Error ? error.message : '暂时无法加载每周课表。');
        setTimetableItems([]);
      } finally {
        setTimetableItemsLoading(false);
      }
    },
    [listAcademicWeeklyTimetableItems, staffDirectoryTeachers],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    storedSessionRef.current = storedSession;
  }, [storedSession]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaffDirectory() {
      setStaffDirectoryLoading(true);
      setStaffDirectoryError(null);

      try {
        const outcome = await resolveStaffDirectoryCache({
          canPopulate: true,
          persistSessionFromResult,
          session: storedSessionRef.current,
        });

        if (!cancelled) {
          setStaffDirectoryResult(outcome.directory);
        }
      } catch (error) {
        if (!cancelled) {
          if (isExpiredUpstreamSessionError(error)) {
            clear();
          }

          setStaffDirectoryError(error instanceof Error ? error.message : '暂时无法加载教师目录。');
        }
      } finally {
        if (!cancelled) {
          setStaffDirectoryLoading(false);
        }
      }
    }

    void loadStaffDirectory();

    return () => {
      cancelled = true;
    };
  }, [clear, persistSessionFromResult, storedSessionDirectoryKey]);

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
    const nextWeekIndex = clampWeekIndex(currentWeekIndex ?? 1, maxWeekIndex);

    setTeachingClassKeyword('');
    setTeachingClassOptions([]);
    setTeachingClassOptionsError(null);
    setTimetableItems([]);
    setTimetableItemsError(null);
    setHasSubmittedQuery(false);
    setSelectedWeekIndex(null);
    setFilters((current) => ({
      ...current,
      sstsTeachingClassId: '',
      weekIndex: nextWeekIndex,
    }));
    submittedFiltersRef.current = {
      ...submittedFiltersRef.current,
      sstsTeachingClassId: '',
      weekIndex: nextWeekIndex,
    };
  }, [currentWeekIndex, maxWeekIndex, selectedSemesterId]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setTeachingClassOptions([]);
      setTeachingClassOptionsError(null);
      setTeachingClassOptionsLoading(false);
      return undefined;
    }

    if (!ENABLE_TEACHING_CLASS_FILTER) {
      setTeachingClassOptions([]);
      setTeachingClassOptionsError(null);
      setTeachingClassOptionsLoading(false);
      return undefined;
    }

    let isActive = true;

    const timerId = window.setTimeout(() => {
      setTeachingClassOptionsLoading(true);
      setTeachingClassOptionsError(null);

      listAcademicTeachingClassOptions({
        semesterId: selectedSemesterId,
        keyword: teachingClassKeyword,
        limit: TEACHING_CLASS_OPTION_LIMIT,
      })
        .then((result) => {
          if (isActive) {
            setTeachingClassOptions(result);
          }
        })
        .catch((error) => {
          if (isActive) {
            setTeachingClassOptions([]);
            setTeachingClassOptionsError(
              error instanceof Error ? error.message : '暂时无法加载教学班选项。',
            );
          }
        })
        .finally(() => {
          if (isActive) {
            setTeachingClassOptionsLoading(false);
          }
        });
    }, TEACHING_CLASS_SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timerId);
    };
  }, [listAcademicTeachingClassOptions, selectedSemesterId, teachingClassKeyword]);

  function submitQuery() {
    if (selectedSemesterId === null || !hasQueryFilter) {
      return;
    }

    const submittedFilters: WeeklyTimetableFilters = {
      staffId: normalizedStaffId,
      sstsTeachingClassId: ENABLE_TEACHING_CLASS_FILTER ? filters.sstsTeachingClassId : '',
      weekIndex: clampWeekIndex(filters.weekIndex, maxWeekIndex),
    };

    setFilters((current) => ({
      ...current,
      weekIndex: submittedFilters.weekIndex,
    }));
    void loadTimetableItems(selectedSemesterId, submittedFilters);
  }

  function changeWeek(nextWeekIndex: number) {
    if (selectedSemesterId === null || !hasSubmittedQuery) {
      return;
    }

    const nextFilters = {
      ...submittedFiltersRef.current,
      weekIndex: clampWeekIndex(nextWeekIndex, maxWeekIndex),
    };

    setFilters((current) => ({
      ...current,
      weekIndex: nextFilters.weekIndex,
    }));
    void loadTimetableItems(selectedSemesterId, nextFilters);
  }

  function renderQueryControls() {
    if (semesterError) {
      return (
        <div className="weekly-timetable-query-state">
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
        <div className="weekly-timetable-query-state">
          <Skeleton active paragraph={{ rows: 1 }} title={false} />
        </div>
      );
    }

    if (!semesters.length) {
      return (
        <div className="weekly-timetable-query-state">
          <Empty description="当前还没有可用学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return (
      <div className="weekly-timetable-query-content">
        <div className="weekly-timetable-summary">
          {selectedSemester ? (
            <>
              <div className="weekly-timetable-summary-heading">
                <span className="weekly-timetable-summary-eyebrow">当前查询</span>
                <p className="weekly-timetable-summary-title">{selectedSemester.name}</p>
              </div>
              <div className="weekly-timetable-summary-meta">
                <div className="weekly-timetable-summary-meta-item">
                  <span>教学周</span>
                  <strong>第 {displayWeekIndex} 周</strong>
                </div>
                <div className="weekly-timetable-summary-meta-item">
                  <span>日期范围</span>
                  <strong>{weekDateRangeLabel ?? '未识别'}</strong>
                </div>
                <div className="weekly-timetable-summary-meta-item">
                  <span>教学开始</span>
                  <strong>{formatSemesterDate(selectedSemester.firstTeachingDate)}</strong>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="weekly-timetable-controls">
          <div className="weekly-timetable-control-field">
            <Typography.Text strong>学期</Typography.Text>
            <div className="weekly-timetable-control-input">
              <Select
                value={selectedSemesterId ?? undefined}
                options={semesters.map((semester) => ({
                  label: semester.isCurrent ? `${semester.name} · 当前` : semester.name,
                  value: semester.id,
                }))}
                onChange={(value) => setSelectedSemesterId(value)}
              />
            </div>
          </div>

          <div className="weekly-timetable-control-field">
            <Typography.Text strong>教师</Typography.Text>
            <div className="weekly-timetable-control-input">
              <StaffDirectoryTeacherAutoComplete
                directoryUnavailableContent={
                  staffDirectoryError ? '目录不可用，可手动输入' : undefined
                }
                loading={staffDirectoryLoading}
                popupMatchSelectWidth={280}
                placeholder="ID 或姓名"
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
              className={`weekly-timetable-control-help ${
                hasQueryFilter ? 'weekly-timetable-control-help-hidden' : ''
              }`}
            >
              {REQUIRED_QUERY_FILTER_MESSAGE}
            </span>
          </div>

          {ENABLE_TEACHING_CLASS_FILTER ? (
            <div className="weekly-timetable-control-field weekly-timetable-control-field-wide">
              <Typography.Text strong>课程教学班</Typography.Text>
              <div className="weekly-timetable-control-input">
                <Select
                  allowClear
                  disabled={selectedSemesterId === null}
                  filterOption={false}
                  loading={teachingClassOptionsLoading}
                  notFoundContent={selectedSemesterId === null ? '先选择学期' : '暂无课程教学班'}
                  options={teachingClassSelectOptions}
                  placeholder="按课程、课程教学班或教师搜索"
                  showSearch
                  value={filters.sstsTeachingClassId || undefined}
                  onChange={(value) => {
                    setFilters((current) => ({
                      ...current,
                      sstsTeachingClassId: value ?? '',
                    }));
                  }}
                  onSearch={setTeachingClassKeyword}
                />
              </div>
            </div>
          ) : null}

          <div className="weekly-timetable-control-field weekly-timetable-control-field-week">
            <Typography.Text strong>教学周</Typography.Text>
            <div className="weekly-timetable-control-input">
              <InputNumber
                min={1}
                max={maxWeekIndex ?? undefined}
                value={filters.weekIndex}
                onChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    weekIndex: typeof value === 'number' ? value : 1,
                  }));
                }}
              />
            </div>
          </div>

          <div className="weekly-timetable-control-action">
            <Button
              block
              disabled={selectedSemesterId === null || !hasQueryFilter}
              loading={timetableItemsLoading}
              type="primary"
              onClick={submitQuery}
            >
              查询每周课表
            </Button>
          </div>
        </div>

        {teachingClassOptionsError ? (
          <div className="weekly-timetable-query-alert">
            <Alert showIcon title={teachingClassOptionsError} type="warning" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="weekly-timetable-page">
      <DecoratedPageHeader
        description={
          ENABLE_TEACHING_CLASS_FILTER
            ? '按学期、教师或课程教学班快速查阅单周排课'
            : '按学期和教师快速查阅单周排课'
        }
        icon={<TableOutlined />}
        title="每周课表"
      />

      <Card styles={{ body: { overflow: 'hidden', padding: 0 } }}>{renderQueryControls()}</Card>

      <div className="weekly-timetable-result">
        {timetableItemsError ? <Alert showIcon title={timetableItemsError} type="error" /> : null}
        {timetableItemsLoading && !hasSubmittedQuery ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : hasSubmittedQuery ? (
          <WeeklyTimetableGrid
            currentWeekIndex={currentWeekIndex}
            emptyDescription="当前教学周没有命中的课表项"
            isWeekNavigationLoading={timetableItemsLoading}
            items={timetableItems}
            maxWeekIndex={maxWeekIndex}
            selectedWeekIndex={selectedWeekIndex}
            weekDateRangeLabel={weekDateRangeLabel}
            onWeekChange={(weekIndex) => changeWeek(weekIndex)}
          />
        ) : (
          <Empty
            description={
              ENABLE_TEACHING_CLASS_FILTER
                ? '请选择教师或课程教学班后查询每周课表'
                : '请选择教师后查询每周课表'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </div>
  );
}
