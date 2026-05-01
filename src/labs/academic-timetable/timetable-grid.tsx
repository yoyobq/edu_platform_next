import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { Empty } from 'antd';

import type {
  AcademicTeacherSemesterScheduleItem,
  AcademicTimetableGridItem,
  AcademicTimetableItem,
} from './api';
import {
  buildTimetableSlotPlacements,
  resolveCourseCategoryMeta,
  resolveTimetablePeriodCount,
} from './helpers';

import './academic-timetable-grid.css';

type TimetableSlotGroupStyle = CSSProperties & {
  '--academic-timetable-slot-layer'?: string;
};

type TimetableViewKey = 'semester' | 'weekly';

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SEMESTER_TIMETABLE_DAY_LABELS = DAY_OF_WEEK_LABELS.slice(0, 5);
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

  if (props.items.length === 0) {
    return <Empty description={props.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="flex flex-col gap-4">
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

export function WeeklyTimetableGrid(props: {
  emptyDescription: string;
  items: AcademicTimetableItem[];
}) {
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

export function SemesterTimetableGrid(props: {
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
