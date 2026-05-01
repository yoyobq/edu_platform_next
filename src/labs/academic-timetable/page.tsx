import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useLoaderData } from 'react-router';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import { academicTimetableLabAccess } from './access';
import {
  type AcademicTeacherSemesterScheduleItem,
  type AcademicTimetableGridItem,
  type AcademicTimetableItem,
  type AcademicTimetableQueryFilters,
  requestAcademicTeacherSemesterScheduleItems,
  requestAcademicWeeklyTimetableItems,
} from './api';
import {
  buildTimetableSlotPlacements,
  resolveCourseCategoryMeta,
  resolveCurrentTeachingWeekIndex,
  resolveTimetablePeriodCount,
} from './helpers';
import { academicTimetableLabMeta } from './meta';

import './page.css';

type TimetableSlotGroupStyle = CSSProperties & {
  '--academic-timetable-slot-layer'?: string;
};

type AcademicTimetableLabLoaderData = {
  defaultStaffId?: string | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type TimetableViewKey = 'semester' | 'weekly';

type TimetableFilters = {
  staffId: string;
  sstsCourseId: string;
  sstsTeachingClassId: string;
  weekIndex: number;
};

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SEMESTER_TIMETABLE_DAY_LABELS = DAY_OF_WEEK_LABELS.slice(0, 5);
const VIEW_LABELS: Record<TimetableViewKey, string> = {
  semester: '学期课表',
  weekly: '周课表',
};
const REQUIRED_ID_FILTER_MESSAGE =
  '请至少填写教师 ID、上游教学班 ID、上游课程 ID 之一，再发起课表查询。';
const REQUIRED_STAFF_ID_FILTER_MESSAGE = '学期课表以教师 + 学期为视口，请先填写教师 ID。';
const DEFAULT_FILTERS: TimetableFilters = {
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
  filters: TimetableFilters,
): AcademicTimetableQueryFilters {
  return {
    semesterId,
    staffId: normalizeStringFilter(filters.staffId),
    sstsCourseId: normalizeStringFilter(filters.sstsCourseId),
    sstsTeachingClassId: normalizeStringFilter(filters.sstsTeachingClassId),
  };
}

function hasAtLeastOneQueryId(filters: TimetableFilters) {
  return Boolean(
    normalizeStringFilter(filters.staffId) ||
    normalizeStringFilter(filters.sstsCourseId) ||
    normalizeStringFilter(filters.sstsTeachingClassId),
  );
}

function formatHeaderDate(value: string) {
  const [datePart] = value.split('T');
  const [, month, day] = datePart.split('-');

  if (month && day) {
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(
    2,
    '0',
  )}`;
}

function resolveOccurrenceStatusLabel(item: AcademicTimetableItem) {
  switch (item.calcEffect) {
    case 'CANCEL':
      return '停课';
    case 'MAKEUP':
      return '调课';
    case 'SWAP_IN':
      return '调课补上';
    case 'SWAP_OUT':
      return '调课停上';
    case 'NORMAL':
    default:
      return null;
  }
}

function resolveOccurrenceStatusClassName(item: AcademicTimetableItem) {
  if (!item.isEffective) {
    return 'academic-timetable-entry-status academic-timetable-entry-status-inactive';
  }

  if (item.calcEffect === 'MAKEUP' || item.calcEffect === 'SWAP_IN') {
    return 'academic-timetable-entry-status academic-timetable-entry-status-active';
  }

  return 'academic-timetable-entry-status academic-timetable-entry-status-default';
}

function getWeeklyTimetableEntryKey(item: AcademicTimetableItem) {
  return `${item.scheduleId}-${item.slotId}`;
}

function getWeeklyTimetableItemTieBreaker(item: AcademicTimetableItem) {
  return `${item.courseName}-${item.teachingClassName}-${item.date}`;
}

function getSemesterScheduleEntryKey(item: AcademicTeacherSemesterScheduleItem) {
  return `${item.scheduleId}-${item.slotId}`;
}

function getSemesterScheduleItemTieBreaker(item: AcademicTeacherSemesterScheduleItem) {
  return `${item.courseName}-${item.teachingClassName}-${item.weekPattern}`;
}

function resolveWeekPatternLabel(item: AcademicTeacherSemesterScheduleItem) {
  const normalizedWeekRanges = item.weekRanges?.trim();
  const normalizedWeekPattern = item.weekPattern.trim();

  return normalizedWeekRanges || normalizedWeekPattern || '未标注周次';
}

function BaseTimetableGrid<TItem extends AcademicTimetableGridItem>(props: {
  emptyDescription: string;
  getEntryKey: (item: TItem) => string;
  getTieBreaker: (item: TItem) => string;
  getDayHeaderSupplement?: (dayOfWeek: number) => string | null;
  items: TItem[];
  renderEntry: (item: TItem) => ReactNode;
  viewKey: TimetableViewKey;
}) {
  const slotPlacements = useMemo(
    () => buildTimetableSlotPlacements(props.items, props.getTieBreaker),
    [props.getTieBreaker, props.items],
  );
  const periodCount = useMemo(() => resolveTimetablePeriodCount(props.items), [props.items]);
  const hasWeekendItems = useMemo(
    () => props.viewKey === 'weekly' && props.items.some((item) => item.dayOfWeek >= 6),
    [props.items, props.viewKey],
  );
  const visibleDayLabels =
    props.viewKey === 'semester' || !hasWeekendItems
      ? SEMESTER_TIMETABLE_DAY_LABELS
      : DAY_OF_WEEK_LABELS;
  const visibleDayCount = visibleDayLabels.length;
  const visibleSlotPlacements = useMemo(
    () =>
      slotPlacements.filter(
        (group) =>
          group.periodStart <= periodCount &&
          group.dayOfWeek >= 1 &&
          group.dayOfWeek <= visibleDayCount,
      ),
    [periodCount, slotPlacements, visibleDayCount],
  );
  const visibleItemCount = useMemo(
    () =>
      visibleSlotPlacements.reduce(
        (currentCount, placement) => currentCount + placement.items.length,
        0,
      ),
    [visibleSlotPlacements],
  );

  if (props.items.length === 0) {
    return <Empty description={props.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Tag color="blue">课表项：{visibleItemCount}</Tag>
        <Tag color="cyan">占用格位：{visibleSlotPlacements.length}</Tag>
        <Tag color="gold">视图：{VIEW_LABELS[props.viewKey]}</Tag>
      </div>

      <div className="academic-timetable-shell overflow-x-auto">
        <div
          className="academic-timetable-grid"
          style={{
            gridTemplateColumns: `72px repeat(${visibleDayCount}, minmax(156px, 1fr))`,
            gridTemplateRows: `44px repeat(${periodCount}, minmax(72px, auto))`,
            minWidth: 72 + visibleDayCount * 156,
          }}
        >
          <div className="academic-timetable-header-cell academic-timetable-header-corner">
            节次
          </div>

          {visibleDayLabels.map((label, index) => {
            const dayHeaderSupplement = props.getDayHeaderSupplement?.(index + 1);

            return (
              <div
                key={label}
                className="academic-timetable-header-cell"
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                <span>{label}</span>
                {dayHeaderSupplement ? (
                  <span className="academic-timetable-header-date">{dayHeaderSupplement}</span>
                ) : null}
              </div>
            );
          })}

          {Array.from({ length: periodCount }, (_, periodIndex) => {
            const period = periodIndex + 1;

            return (
              <div
                key={`period-${period}`}
                className="academic-timetable-period-cell"
                style={{ gridColumn: 1, gridRow: period + 1 }}
              >
                第 {period} 节
              </div>
            );
          })}

          {Array.from({ length: periodCount }, (_, periodIndex) =>
            visibleDayLabels.map((_, dayIndex) => {
              const isWeekendColumn = props.viewKey === 'weekly' && dayIndex >= 5;

              return (
                <div
                  key={`slot-${dayIndex + 1}-${periodIndex + 1}`}
                  className={`academic-timetable-base-cell ${
                    isWeekendColumn ? 'academic-timetable-weekend-cell' : ''
                  }`}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: periodIndex + 2,
                  }}
                />
              );
            }),
          )}

          {visibleSlotPlacements.map((group) => (
            <div
              key={group.key}
              className={`academic-timetable-slot-group ${
                group.items.length > 1 ? 'academic-timetable-slot-group-stacked' : ''
              }`}
              style={
                {
                  gridColumn: group.dayOfWeek + 1,
                  gridRow: `${group.periodStart + 1} / span ${
                    Math.min(group.periodEnd, periodCount) - group.periodStart + 1
                  }`,
                  insetInlineStart:
                    group.laneCount > 1
                      ? `calc(${(group.laneIndex * 100) / group.laneCount}% + 4px)`
                      : undefined,
                  width: group.laneCount > 1 ? `calc(${100 / group.laneCount}% - 8px)` : undefined,
                  '--academic-timetable-slot-layer': String(
                    group.laneCount > 1 ? group.laneIndex + 1 : 1,
                  ),
                } as TimetableSlotGroupStyle
              }
            >
              {group.items.map((item) => (
                <div className="academic-timetable-slot-group-item" key={props.getEntryKey(item)}>
                  {props.renderEntry(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeeklyTimetableGrid(props: { emptyDescription: string; items: AcademicTimetableItem[] }) {
  const dateByDayOfWeek = useMemo(() => {
    const nextDateByDayOfWeek = new Map<number, string>();

    for (const item of props.items) {
      if (!nextDateByDayOfWeek.has(item.dayOfWeek)) {
        nextDateByDayOfWeek.set(item.dayOfWeek, formatHeaderDate(item.date));
      }
    }

    return nextDateByDayOfWeek;
  }, [props.items]);

  return (
    <BaseTimetableGrid
      emptyDescription={props.emptyDescription}
      getEntryKey={getWeeklyTimetableEntryKey}
      getTieBreaker={getWeeklyTimetableItemTieBreaker}
      getDayHeaderSupplement={(dayOfWeek) => dateByDayOfWeek.get(dayOfWeek) ?? null}
      items={props.items}
      renderEntry={(item) => {
        const courseCategoryMeta = resolveCourseCategoryMeta(item.courseCategory);
        const courseCategoryAccentClassName = courseCategoryMeta?.accentClassName || '';
        const courseCategorySurfaceClassName = courseCategoryMeta?.surfaceClassName || '';
        const statusLabel = resolveOccurrenceStatusLabel(item);

        return (
          <article
            className={[
              'academic-timetable-entry',
              courseCategorySurfaceClassName,
              item.isEffective ? '' : 'academic-timetable-entry-inactive',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="academic-timetable-entry-main-group">
              <div className="academic-timetable-entry-title-wrap">
                <p
                  className={['academic-timetable-entry-title', courseCategoryAccentClassName]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.courseName}
                </p>
              </div>
            </div>
            <div className="academic-timetable-entry-center-group">
              <p className="academic-timetable-entry-subtitle">{item.teachingClassName}</p>
            </div>
            <div className="academic-timetable-entry-footer-group">
              <p className="academic-timetable-entry-meta">
                {item.classroomName?.trim() || '待定教室'}
              </p>
              <p className="academic-timetable-entry-meta">
                {item.staffName?.trim() || '待定教师'}
              </p>
            </div>
            {statusLabel ? (
              <div className="academic-timetable-entry-status-row">
                <span className={resolveOccurrenceStatusClassName(item)}>{statusLabel}</span>
              </div>
            ) : null}
          </article>
        );
      }}
      viewKey="weekly"
    />
  );
}

function SemesterTimetableGrid(props: {
  emptyDescription: string;
  items: AcademicTeacherSemesterScheduleItem[];
}) {
  return (
    <BaseTimetableGrid
      emptyDescription={props.emptyDescription}
      getEntryKey={getSemesterScheduleEntryKey}
      getTieBreaker={getSemesterScheduleItemTieBreaker}
      items={props.items}
      renderEntry={(item) => {
        const courseCategoryMeta = resolveCourseCategoryMeta(item.courseCategory);
        const courseCategoryAccentClassName = courseCategoryMeta?.accentClassName || '';
        const courseCategorySurfaceClassName = courseCategoryMeta?.surfaceClassName || '';

        return (
          <article
            className={[
              'academic-timetable-entry',
              'academic-timetable-entry-semester',
              courseCategorySurfaceClassName,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="academic-timetable-entry-main-group">
              <div className="academic-timetable-entry-title-wrap">
                <p
                  className={['academic-timetable-entry-title', courseCategoryAccentClassName]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.courseName}
                </p>
              </div>
              <p className="academic-timetable-entry-date academic-timetable-entry-week-pattern">
                {resolveWeekPatternLabel(item)}
              </p>
            </div>
            <div className="academic-timetable-entry-center-group">
              <p className="academic-timetable-entry-subtitle">{item.teachingClassName}</p>
            </div>
            <div className="academic-timetable-entry-footer-group">
              <p className="academic-timetable-entry-meta">
                {item.classroomName?.trim() || '待定教室'}
              </p>
              <p className="academic-timetable-entry-meta">{item.staffName.trim() || '待定教师'}</p>
            </div>
          </article>
        );
      }}
      viewKey="semester"
    />
  );
}

export function AcademicTimetableLabPage() {
  const loaderData = useLoaderData() as AcademicTimetableLabLoaderData;
  const loaderDefaultStaffId = loaderData?.defaultStaffId?.trim() || '';
  const roleLabel = loaderData?.viewerKind === 'internal' ? '内部用户' : '登录用户';

  const [filters, setFilters] = useState<TimetableFilters>({
    ...DEFAULT_FILTERS,
    staffId: loaderDefaultStaffId,
  });
  const [activeViewKey, setActiveViewKey] = useState<TimetableViewKey>('weekly');
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [semesterScheduleItems, setSemesterScheduleItems] = useState<
    AcademicTeacherSemesterScheduleItem[]
  >([]);
  const [semesterScheduleItemsError, setSemesterScheduleItemsError] = useState<string | null>(null);
  const [semesterScheduleItemsLoading, setSemesterScheduleItemsLoading] = useState(false);
  const [timetableItems, setTimetableItems] = useState<AcademicTimetableItem[]>([]);
  const [timetableItemsError, setTimetableItemsError] = useState<string | null>(null);
  const [timetableItemsLoading, setTimetableItemsLoading] = useState(false);
  const autoFilledWeekSemesterIdRef = useRef<number | null>(null);
  const hasUserEditedWeekIndexRef = useRef(false);
  const latestFiltersRef = useRef(filters);

  const hasAnyQueryId = useMemo(() => hasAtLeastOneQueryId(filters), [filters]);
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
    async (semesterId: number, currentFilters: TimetableFilters) => {
      if (!hasAtLeastOneQueryId(currentFilters)) {
        setTimetableItemsError(null);
        setTimetableItems([]);
        return;
      }

      setTimetableItemsLoading(true);
      setTimetableItemsError(null);

      try {
        const result = await requestAcademicWeeklyTimetableItems({
          ...buildSharedQueryFilters(semesterId, currentFilters),
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
    [],
  );

  const loadSemesterScheduleItems = useCallback(
    async (semesterId: number, currentFilters: TimetableFilters) => {
      const normalizedStaffId = normalizeStringFilter(currentFilters.staffId);

      if (!normalizedStaffId) {
        setSemesterScheduleItemsError(null);
        setSemesterScheduleItems([]);
        return;
      }

      setSemesterScheduleItemsLoading(true);
      setSemesterScheduleItemsError(null);

      try {
        const result = await requestAcademicTeacherSemesterScheduleItems({
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
    [],
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
      setSemesterScheduleItems([]);
      return;
    }

    if (activeViewKey === 'semester') {
      void loadSemesterScheduleItems(selectedSemesterId, latestFiltersRef.current);
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
  }, [
    activeViewKey,
    loadSemesterScheduleItems,
    loadTimetableItems,
    selectedSemester,
    selectedSemesterId,
  ]);

  function renderQueryControls(viewKey: TimetableViewKey) {
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
        {viewKey === 'weekly' && !hasAnyQueryId ? (
          <Alert showIcon title={REQUIRED_ID_FILTER_MESSAGE} type="warning" />
        ) : null}

        {viewKey === 'semester' && !hasSemesterQueryId ? (
          <Alert showIcon title={REQUIRED_STAFF_ID_FILTER_MESSAGE} type="warning" />
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

          {viewKey === 'weekly' ? (
            <>
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
            </>
          ) : null}

          <div className="flex min-w-32 items-end">
            <Button
              block
              type="primary"
              loading={
                viewKey === 'semester' ? semesterScheduleItemsLoading : timetableItemsLoading
              }
              disabled={
                selectedSemesterId === null ||
                (viewKey === 'semester' ? !hasSemesterQueryId : !hasAnyQueryId)
              }
              onClick={() => {
                if (selectedSemesterId === null) {
                  return;
                }

                if (viewKey === 'semester') {
                  void loadSemesterScheduleItems(selectedSemesterId, filters);
                  return;
                }

                void loadTimetableItems(selectedSemesterId, filters);
              }}
            >
              {viewKey === 'semester' ? '查询学期课表' : '查询周课表'}
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

  function renderWeeklyTimetablePanel() {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          showIcon
          type="info"
          title="当前页面以 listAcademicWeeklyPlannedTimetable 作为基础课表视图；结合现有口径，它比“学期总览”更接近实际可用的常规课表。"
        />
        {renderQueryControls('weekly')}
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
    );
  }

  function renderSemesterTimetablePanel() {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          showIcon
          type="info"
          title="学期课表视图直接展示教师在该学期的原始排课项，不按日期展开 occurrence，也不混入校历补停调课语义；管理员 token 已验证可访问，普通 staff 账号会被拒绝。"
        />
        <Alert
          showIcon
          type="warning"
          title="正常课表展示优先使用 weekRanges；如需调试或特殊逻辑，可继续参考 weekPattern 与 weekType。"
        />
        {renderQueryControls('semester')}
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              课表视图
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
            当前页面同时提供两套只读口径：周课表使用 occurrence-based weekly planned
            timetable，以教学周为结果窗口；学期课表使用教师学期原始排课项，直接展示固定格位与
            周次表达，需管理端可用 token 调用，不再在前端拼接 schedule 与 slot。
          </Typography.Paragraph>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeViewKey}
          onChange={(key) => setActiveViewKey(key as TimetableViewKey)}
          items={[
            {
              key: 'weekly',
              label: VIEW_LABELS.weekly,
              children: (
                <div className="p-6">
                  {activeViewKey === 'weekly' ? renderWeeklyTimetablePanel() : null}
                </div>
              ),
            },
            {
              key: 'semester',
              label: VIEW_LABELS.semester,
              children: (
                <div className="p-6">
                  {activeViewKey === 'semester' ? renderSemesterTimetablePanel() : null}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
