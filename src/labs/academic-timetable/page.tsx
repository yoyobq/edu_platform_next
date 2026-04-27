import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { buildTimetableSlotPlacements, resolveCourseCategoryMeta } from './helpers';
import { academicTimetableLabMeta } from './meta';

import './page.css';

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
const MIN_PERIOD_COUNT = 12;
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

function resolvePeriodCount<TItem extends AcademicTimetableGridItem>(items: TItem[]) {
  const maxPeriodEnd = items.reduce(
    (currentMax, item) => Math.max(currentMax, item.periodEnd),
    MIN_PERIOD_COUNT,
  );

  return Math.max(MIN_PERIOD_COUNT, maxPeriodEnd);
}

function formatOccurrenceDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function resolveOccurrenceStatusLabel(item: AcademicTimetableItem) {
  switch (item.calcEffect) {
    case 'CANCEL':
      return '停课';
    case 'MAKEUP':
      return '调休补课';
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

function formatCoefficient(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function resolveWeekTypeLabel(value: string) {
  switch (value) {
    case 'ALL':
    case 'EVERY':
      return '全周';
    case 'ODD':
      return '单周';
    case 'EVEN':
      return '双周';
    default:
      return value || '未知周型';
  }
}

function resolveWeekPatternLabel(item: AcademicTeacherSemesterScheduleItem) {
  const normalizedWeekRanges = item.weekRanges?.trim();
  const normalizedWeekPattern = item.weekPattern.trim();

  return normalizedWeekRanges || normalizedWeekPattern || '未标注周次';
}

function resolvePeriodRangeLabel(periodStart: number, periodEnd: number) {
  return periodStart === periodEnd ? `第 ${periodStart} 节` : `第 ${periodStart}-${periodEnd} 节`;
}

function BaseTimetableGrid<TItem extends AcademicTimetableGridItem>(props: {
  emptyDescription: string;
  getEntryKey: (item: TItem) => string;
  getTieBreaker: (item: TItem) => string;
  items: TItem[];
  renderEntry: (item: TItem) => ReactNode;
  viewKey: TimetableViewKey;
}) {
  const slotPlacements = useMemo(
    () => buildTimetableSlotPlacements(props.items, props.getTieBreaker),
    [props.getTieBreaker, props.items],
  );
  const periodCount = useMemo(() => resolvePeriodCount(props.items), [props.items]);

  if (props.items.length === 0) {
    return <Empty description={props.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Tag color="blue">课表项：{props.items.length}</Tag>
        <Tag color="cyan">占用格位：{slotPlacements.length}</Tag>
        <Tag color="gold">视图：{VIEW_LABELS[props.viewKey]}</Tag>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-secondary bg-bg-container">
        <div
          className="academic-timetable-grid min-w-295"
          style={{
            gridTemplateColumns: '72px repeat(7, minmax(156px, 1fr))',
            gridTemplateRows: `44px repeat(${periodCount}, minmax(72px, auto))`,
          }}
        >
          <div className="academic-timetable-header-cell academic-timetable-header-corner">
            节次
          </div>

          {DAY_OF_WEEK_LABELS.map((label, index) => (
            <div
              key={label}
              className="academic-timetable-header-cell"
              style={{ gridColumn: index + 2, gridRow: 1 }}
            >
              {label}
            </div>
          ))}

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
            DAY_OF_WEEK_LABELS.map((_, dayIndex) => (
              <div
                key={`slot-${dayIndex + 1}-${periodIndex + 1}`}
                className="academic-timetable-base-cell"
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: periodIndex + 2,
                }}
              />
            )),
          )}

          {slotPlacements.map((group) => (
            <div
              key={group.key}
              className={`academic-timetable-slot-group ${
                group.items.length > 1 ? 'academic-timetable-slot-group-stacked' : ''
              }`}
              style={{
                gridColumn: group.dayOfWeek + 1,
                gridRow: `${group.periodStart + 1} / span ${group.periodEnd - group.periodStart + 1}`,
                insetInlineStart:
                  group.laneCount > 1
                    ? `calc(${(group.laneIndex * 100) / group.laneCount}% + 4px)`
                    : undefined,
                width: group.laneCount > 1 ? `calc(${100 / group.laneCount}% - 8px)` : undefined,
                '--academic-timetable-slot-layer': String(
                  group.laneCount > 1 ? group.laneIndex + 1 : 1,
                ),
              }}
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
  return (
    <BaseTimetableGrid
      emptyDescription={props.emptyDescription}
      getEntryKey={getWeeklyTimetableEntryKey}
      getTieBreaker={getWeeklyTimetableItemTieBreaker}
      items={props.items}
      renderEntry={(item) => {
        const coefficient = formatCoefficient(item.coefficient);
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
            <div className="academic-timetable-entry-status-row">
              {statusLabel ? (
                <span className={resolveOccurrenceStatusClassName(item)}>{statusLabel}</span>
              ) : (
                <span />
              )}
              <span className="academic-timetable-entry-date">
                {formatOccurrenceDate(item.date)}
              </span>
            </div>
            <div className="academic-timetable-entry-title-wrap">
              <p
                className={['academic-timetable-entry-title', courseCategoryAccentClassName]
                  .filter(Boolean)
                  .join(' ')}
              >
                {item.courseName}
              </p>
              {courseCategoryMeta ? (
                <span
                  className={[
                    'academic-timetable-course-category-badge',
                    courseCategoryAccentClassName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {courseCategoryMeta.label}
                </span>
              ) : null}
            </div>
            <p className="academic-timetable-entry-subtitle">{item.teachingClassName}</p>
            <p className="academic-timetable-entry-meta">
              {item.classroomName?.trim() || '待定教室'}
              {' · '}
              {item.staffName?.trim() || '待定教师'}
            </p>
            <p className="academic-timetable-entry-foot">
              {resolvePeriodRangeLabel(item.periodStart, item.periodEnd)}
              {coefficient ? ` · 系数 ${coefficient}` : ''}
            </p>
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
        const coefficient = formatCoefficient(item.coefficient);
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
            <div className="academic-timetable-entry-pill-row">
              <span className="academic-timetable-entry-pill">
                {resolveWeekTypeLabel(item.weekType)}
              </span>
              <span className="academic-timetable-entry-date academic-timetable-entry-week-pattern">
                {resolveWeekPatternLabel(item)}
              </span>
            </div>
            <div className="academic-timetable-entry-title-wrap">
              <p
                className={['academic-timetable-entry-title', courseCategoryAccentClassName]
                  .filter(Boolean)
                  .join(' ')}
              >
                {item.courseName}
              </p>
              {courseCategoryMeta ? (
                <span
                  className={[
                    'academic-timetable-course-category-badge',
                    courseCategoryAccentClassName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {courseCategoryMeta.label}
                </span>
              ) : null}
            </div>
            <p className="academic-timetable-entry-subtitle">{item.teachingClassName}</p>
            <p className="academic-timetable-entry-meta">
              {item.classroomName?.trim() || '待定教室'}
              {' · '}
              {item.staffName.trim() || '待定教师'}
            </p>
            <p className="academic-timetable-entry-foot">
              {resolvePeriodRangeLabel(item.periodStart, item.periodEnd)}
              {coefficient ? ` · 系数 ${coefficient}` : ''}
            </p>
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

    void loadTimetableItems(selectedSemesterId, latestFiltersRef.current);
  }, [activeViewKey, loadSemesterScheduleItems, loadTimetableItems, selectedSemesterId]);

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
