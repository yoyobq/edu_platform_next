import {
  type CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CalendarOutlined,
  FlagOutlined,
  ReadOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  SwapOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { useWidthBand } from '@/shared/ui/responsive-layout';

import {
  formatDateTime,
  pickNextSemesterId,
  sortCalendarEvents,
  sortSemesters,
} from '../application/academic-calendar-management';
import {
  buildEventBuckets,
  buildSemesterWeeks,
  buildWeekMonthSpans,
  countTeachingWeeks,
  createLatestRequestSequence,
  formatDisplayDate,
  isWeekendDate,
  parseIsoDate,
  resolveEventDisplayTopic,
  type SemesterWeekDay,
  shouldHighlightCurrentWeekDay,
} from '../application/semester-calendar';
import type {
  AcademicCalendarEventDayPeriod,
  AcademicCalendarEventRecord,
  AcademicCalendarEventRecordStatus,
  AcademicCalendarEventType,
  AcademicCalendarTeachingCalcEffect,
  AcademicSemesterRecord,
  ListAcademicCalendarEventsInput,
  ListAcademicSemestersInput,
} from '../application/types';

import './semester-calendar-page-content.css';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const DAY_PERIOD_LABELS: Record<AcademicCalendarEventDayPeriod, string> = {
  AFTERNOON: '下',
  ALL_DAY: '全',
  MORNING: '上',
};

const DAY_PERIOD_LABELS_FULL: Record<AcademicCalendarEventDayPeriod, string> = {
  AFTERNOON: '下午',
  ALL_DAY: '全天',
  MORNING: '上午',
};

const TOOLTIP_EVENT_LIMIT = 5;
const DEFAULT_SEMESTER_QUERY_INPUT = { limit: 500 } as const;

const EVENT_TYPE_LABELS: Record<AcademicCalendarEventType, string> = {
  ACTIVITY: '活动',
  EXAM: '考试',
  HOLIDAY: '放假',
  HOLIDAY_MAKEUP: '调休补班',
  SPORTS_MEET: '运动会',
  WEEKDAY_SWAP: '工作日对调',
};

const RECORD_STATUS_LABELS: Record<AcademicCalendarEventRecordStatus, string> = {
  ACTIVE: '生效',
  EXPIRED: '失效',
  TENTATIVE: '暂定',
};

const TEACHING_CALC_EFFECT_LABELS: Record<AcademicCalendarTeachingCalcEffect, string> = {
  CANCEL: '停课',
  MAKEUP: '补课',
  NO_CHANGE: '不影响',
  SWAP: '对调',
};

type CalendarDayCellStyle = CSSProperties & {
  '--semester-calendar-day-bg': string;
};

type SelectedCalendarDayEvents = {
  dateKey: string;
  events: AcademicCalendarEventRecord[];
};

type SemesterCalendarPageContentProps = {
  emptySemestersDescription?: string;
  listAcademicCalendarEvents: (
    input: ListAcademicCalendarEventsInput,
  ) => Promise<AcademicCalendarEventRecord[]>;
  listAcademicSemesters: (input: ListAcademicSemestersInput) => Promise<AcademicSemesterRecord[]>;
  semesterQueryInput?: ListAcademicSemestersInput;
  showEventManagementMetadata?: boolean;
};

function buildDayCellTooltipLines(events: AcademicCalendarEventRecord[]) {
  const visible = events.slice(0, TOOLTIP_EVENT_LIMIT);
  const lines = visible.map((event) => {
    const period = DAY_PERIOD_LABELS_FULL[event.dayPeriod];
    const topic = resolveEventDisplayTopic(event);

    return `${period} ${topic}`;
  });

  if (events.length > TOOLTIP_EVENT_LIMIT) {
    lines.push(`…还有 ${events.length - TOOLTIP_EVENT_LIMIT} 项`);
  }

  return lines.join('\n');
}

function resolveEventMarkerClassName(event: AcademicCalendarEventRecord) {
  const parts = ['semester-calendar-event-line'];

  parts.push(`semester-calendar-event-line-${event.eventType.toLowerCase().replaceAll('_', '-')}`);

  if (event.recordStatus === 'EXPIRED') {
    parts.push('semester-calendar-event-line-expired');
  }

  return parts.join(' ');
}

function renderEventTypeIcon(eventType: AcademicCalendarEventType) {
  switch (eventType) {
    case 'EXAM':
      return <ReadOutlined />;
    case 'HOLIDAY':
      return <FlagOutlined />;
    case 'HOLIDAY_MAKEUP':
    case 'WEEKDAY_SWAP':
      return <SwapOutlined />;
    case 'SPORTS_MEET':
      return <TrophyOutlined />;
    case 'ACTIVITY':
    default:
      return <CalendarOutlined />;
  }
}

function resolveDayCellBackground(day: SemesterWeekDay, events: AcademicCalendarEventRecord[]) {
  if (day.isOutsideSemester) {
    return 'var(--ant-color-fill-tertiary)';
  }

  const hasWorkdayOverride = events.some(
    (event) =>
      event.eventType === 'HOLIDAY_MAKEUP' ||
      event.eventType === 'ACTIVITY' ||
      event.eventType === 'WEEKDAY_SWAP',
  );
  const hasHoliday =
    isWeekendDate(day.date) || events.some((event) => event.eventType === 'HOLIDAY');

  if (day.isExamPeriod || events.some((event) => event.eventType === 'EXAM')) {
    return 'var(--ant-color-error-bg)';
  }

  if (events.some((event) => event.eventType === 'SPORTS_MEET')) {
    return 'var(--ant-purple-1, var(--ant-color-success-bg))';
  }

  if (events.some((event) => event.eventType === 'ACTIVITY')) {
    return 'var(--ant-color-primary-bg)';
  }

  if (hasWorkdayOverride) {
    return 'var(--ant-color-bg-container)';
  }

  if (hasHoliday) {
    return 'var(--ant-color-warning-bg)';
  }

  return 'var(--ant-color-bg-container)';
}

function findMainScrollContainer(element: HTMLElement) {
  const mainScrollContainer = element.closest<HTMLElement>('[data-layout-scroll-container="main"]');

  if (mainScrollContainer) {
    return mainScrollContainer;
  }

  let parent = element.parentElement;

  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;

    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      parent.scrollHeight - parent.clientHeight > 8
    ) {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
}

export function SemesterCalendarPageContent({
  emptySemestersDescription = '当前还没有可浏览的学期',
  listAcademicCalendarEvents,
  listAcademicSemesters,
  semesterQueryInput = DEFAULT_SEMESTER_QUERY_INPUT,
  showEventManagementMetadata = true,
}: SemesterCalendarPageContentProps) {
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [events, setEvents] = useState<AcademicCalendarEventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<SelectedCalendarDayEvents | null>(
    null,
  );
  const [calendarScrollLeft, setCalendarScrollLeft] = useState(0);
  const calendarSummaryRef = useRef<HTMLDivElement | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const currentWeekAnchorRef = useRef<HTMLDivElement | null>(null);
  const autoScrolledSemesterIdRef = useRef<number | null>(null);
  const eventRequestSequenceRef = useRef(createLatestRequestSequence());
  const { band: calendarSummaryBand } = useWidthBand(
    calendarSummaryRef,
    [{ max: 1023, value: 'stacked' }],
    'inline',
  );

  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setSemesterError(null);

    try {
      const result = sortSemesters(await listAcademicSemesters(semesterQueryInput));

      setSemesters(result);
      setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
    } catch (error) {
      setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期列表。');
    } finally {
      setSemestersLoading(false);
    }
  }, [listAcademicSemesters, semesterQueryInput]);

  const loadEvents = useCallback(
    async (semesterId: number) => {
      const requestSequence = eventRequestSequenceRef.current.begin();

      setEventsLoading(true);
      setEventError(null);

      try {
        const result = sortCalendarEvents(
          await listAcademicCalendarEvents({
            limit: 500,
            semesterId,
          }),
        );

        if (!eventRequestSequenceRef.current.isLatest(requestSequence)) {
          return;
        }

        setEvents(result);
      } catch (error) {
        if (!eventRequestSequenceRef.current.isLatest(requestSequence)) {
          return;
        }

        setEventError(error instanceof Error ? error.message : '暂时无法加载校历事件。');
      } finally {
        if (eventRequestSequenceRef.current.isLatest(requestSequence)) {
          setEventsLoading(false);
        }
      }
    },
    [listAcademicCalendarEvents],
  );

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      eventRequestSequenceRef.current.invalidate();
      setEvents([]);
      setEventError(null);
      setEventsLoading(false);
      return;
    }

    void loadEvents(selectedSemesterId);
  }, [loadEvents, selectedSemesterId]);

  useEffect(() => {
    setSelectedDayEvents(null);
  }, [selectedSemesterId]);

  useEffect(() => {
    setCalendarScrollLeft(0);

    if (calendarScrollRef.current) {
      calendarScrollRef.current.scrollLeft = 0;
    }
  }, [selectedSemesterId]);

  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (semesters.find((record) => record.id === selectedSemesterId) ?? null);

  const weeks = useMemo(
    () => (selectedSemester ? buildSemesterWeeks(selectedSemester) : []),
    [selectedSemester],
  );
  const monthSpans = useMemo(() => buildWeekMonthSpans(weeks), [weeks]);
  const eventBuckets = useMemo(() => buildEventBuckets(events), [events]);
  const teachingWeekCount = useMemo(() => countTeachingWeeks(weeks), [weeks]);
  const hasCurrentWeek = useMemo(() => weeks.some((week) => week.hasToday), [weeks]);
  const semesterSelectOptions = useMemo(() => {
    const groups = new Map<number, AcademicSemesterRecord[]>();

    for (const semester of semesters) {
      const existing = groups.get(semester.schoolYear) ?? [];
      existing.push(semester);
      groups.set(semester.schoolYear, existing);
    }

    const options: {
      label: React.ReactNode;
      options: { value: number; plainLabel: string; label: React.ReactNode }[];
    }[] = [];

    for (const [schoolYear, groupSemesters] of groups) {
      options.push({
        label: `${schoolYear}-${schoolYear + 1} 学年`,
        options: groupSemesters.map((semester) => ({
          value: semester.id,
          plainLabel: semester.name,
          label: (
            <div className="flex items-center gap-2">
              <span>{semester.name}</span>
              {semester.isCurrent ? (
                <span
                  aria-label="当前学期"
                  title="当前学期"
                  className="semester-calendar-current-dot"
                />
              ) : null}
            </div>
          ),
        })),
      });
    }

    return options;
  }, [semesters]);

  const scrollToCurrentWeek = useCallback(() => {
    const anchor = currentWeekAnchorRef.current;

    if (!anchor) {
      return;
    }

    const scrollableAncestor = findMainScrollContainer(anchor);

    if (!scrollableAncestor) {
      anchor.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const scrollableRect = scrollableAncestor.getBoundingClientRect();
    const anchorTop =
      anchorRect.top - scrollableRect.top + scrollableAncestor.scrollTop + anchorRect.height / 2;

    scrollableAncestor.scrollTo({
      behavior: 'smooth',
      top: Math.max(0, anchorTop - scrollableAncestor.clientHeight * 0.36),
    });
  }, []);

  useEffect(() => {
    if (
      !selectedSemester ||
      eventsLoading ||
      eventError ||
      !hasCurrentWeek ||
      autoScrolledSemesterIdRef.current === selectedSemester.id
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToCurrentWeek();
      autoScrolledSemesterIdRef.current = selectedSemester.id;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [eventError, eventsLoading, hasCurrentWeek, scrollToCurrentWeek, selectedSemester]);

  function renderSemesterCardToolbar() {
    const canRenderToolbar =
      Boolean(semesterError) ||
      semestersLoading ||
      semesters.length > 0 ||
      Boolean(selectedSemester?.isCurrent);

    if (!canRenderToolbar) {
      return null;
    }

    return (
      <div className="semester-calendar-card-toolbar">
        <div className="semester-calendar-card-toolbar-control">
          {semesterError ? (
            <Button
              icon={<ReloadOutlined />}
              size="large"
              type="primary"
              onClick={() => void loadSemesters()}
            >
              重新加载学期
            </Button>
          ) : semestersLoading ? (
            <Button loading size="large">
              加载学期
            </Button>
          ) : semesters.length > 0 ? (
            <Select
              aria-label="选择学期"
              optionLabelProp="plainLabel"
              popupMatchSelectWidth={false}
              size="large"
              value={selectedSemesterId}
              options={semesterSelectOptions}
              onChange={(value) => setSelectedSemesterId(value)}
            />
          ) : null}
          {selectedSemester?.isCurrent ? (
            <Tag color="success" variant="filled">
              当前
            </Tag>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DecoratedPageHeader
        description="按周排布的校历视图，点击含事件的日期查看详情"
        icon={<ScheduleOutlined />}
        title="学期校历"
      />

      <Card title={renderSemesterCardToolbar()}>
        {semesterError ? (
          <Alert showIcon type="error" title={semesterError} />
        ) : semestersLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : semesters.length === 0 ? (
          <Empty description={emptySemestersDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : !selectedSemester ? (
          <Empty description="当前未选中学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : eventsLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : eventError ? (
          <Alert
            action={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                type="primary"
                onClick={() => {
                  if (selectedSemesterId !== null) {
                    void loadEvents(selectedSemesterId);
                  }
                }}
              >
                重试
              </Button>
            }
            showIcon
            type="error"
            title={eventError}
          />
        ) : weeks.length === 0 ? (
          <Empty description="当前学期没有可展示的周视图" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="flex flex-col gap-4">
            <div
              ref={calendarSummaryRef}
              className={`flex gap-4 ${
                calendarSummaryBand === 'inline' ? 'flex-row items-end justify-between' : 'flex-col'
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <Tag color="blue">教学周 {teachingWeekCount} 周</Tag>
                <Tag color="gold">教学开始：{selectedSemester.firstTeachingDate}</Tag>
                <Tag color="purple">考试周开始：{selectedSemester.examStartDate}</Tag>
              </div>
              <div className="semester-calendar-legend" aria-label="校历图例">
                <span className="semester-calendar-legend-item">
                  <span className="semester-calendar-legend-swatch semester-calendar-legend-swatch-holiday" />
                  周末/假期
                </span>
                <span className="semester-calendar-legend-item">
                  <span className="semester-calendar-legend-swatch semester-calendar-legend-swatch-exam" />
                  考试
                </span>
                <span className="semester-calendar-legend-item">
                  <span className="semester-calendar-legend-swatch semester-calendar-legend-swatch-activity" />
                  活动
                </span>
                <span className="semester-calendar-legend-item">
                  <span className="semester-calendar-legend-swatch semester-calendar-legend-swatch-sports-meet" />
                  运动会
                </span>
                <span className="semester-calendar-legend-item">
                  <span className="semester-calendar-legend-swatch semester-calendar-legend-swatch-current" />
                  本周
                </span>
                <span className="semester-calendar-legend-item">
                  <CalendarOutlined aria-hidden />
                  含事件
                </span>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="semester-calendar-sticky-head-shell">
                <div
                  className="semester-calendar-sticky-head grid min-w-230"
                  style={{
                    gridTemplateColumns: '52px 56px repeat(7, minmax(100px, 1fr))',
                    transform: `translateX(-${calendarScrollLeft}px)`,
                  }}
                >
                  <div className="semester-calendar-header-cell">周次</div>
                  <div className="semester-calendar-header-cell">月份</div>
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="semester-calendar-header-cell">
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div
                ref={calendarScrollRef}
                className="overflow-x-auto"
                onScroll={(event) => {
                  setCalendarScrollLeft(event.currentTarget.scrollLeft);
                }}
              >
                <div
                  className="semester-calendar-sheet min-w-230 overflow-hidden border border-t-0"
                  style={{
                    borderColor: 'var(--ant-color-border-secondary)',
                    gridTemplateColumns: '52px 56px repeat(7, minmax(100px, 1fr))',
                    gridTemplateRows: `repeat(${weeks.length}, minmax(92px, auto))`,
                  }}
                >
                  {monthSpans.map((monthSpan) => (
                    <div
                      key={monthSpan.key}
                      className="semester-calendar-axis-cell semester-calendar-month-cell"
                      style={{
                        gridColumn: 2,
                        gridRow: `${monthSpan.startIndex + 1} / span ${monthSpan.span}`,
                      }}
                    >
                      <span>{monthSpan.label}</span>
                    </div>
                  ))}

                  {weeks.map((week, weekIndex) => {
                    const hasTeachingWeekNumber = week.weekNumber !== null;

                    return (
                      <Fragment key={week.key}>
                        <div
                          ref={week.hasToday ? currentWeekAnchorRef : undefined}
                          className={`semester-calendar-axis-cell semester-calendar-week-cell ${
                            hasTeachingWeekNumber ? 'semester-calendar-week-cell-active' : ''
                          } ${week.hasToday ? 'semester-calendar-week-cell-current' : ''}`}
                          style={{
                            gridColumn: 1,
                            gridRow: weekIndex + 1,
                          }}
                          title={week.label}
                        >
                          <span>{week.weekNumber ?? ''}</span>
                        </div>

                        {week.days.map((day, dayIndex) => {
                          const dayEvents = eventBuckets.get(day.dateKey) ?? [];
                          const hasDayEvents = dayEvents.length > 0;
                          const dateObj = parseIsoDate(day.dateKey);
                          const dayNum = dateObj.getUTCDate();
                          const isFirstDayOfMonth = dayNum === 1;
                          const highlightCurrentWeekDay =
                            week.hasToday && shouldHighlightCurrentWeekDay(day);
                          const dayCellStyle: CalendarDayCellStyle = {
                            '--semester-calendar-day-bg': resolveDayCellBackground(day, dayEvents),
                            gridColumn: 3 + dayIndex,
                            gridRow: weekIndex + 1,
                          };

                          return (
                            <Tooltip
                              key={day.dateKey}
                              title={hasDayEvents ? buildDayCellTooltipLines(dayEvents) : undefined}
                              placement="right"
                            >
                              <button
                                type="button"
                                aria-label={
                                  hasDayEvents
                                    ? `${formatDisplayDate(day.dateKey)}，${dayEvents.length} 项事件`
                                    : `${formatDisplayDate(day.dateKey)}，无事件`
                                }
                                aria-disabled={!hasDayEvents}
                                className={`semester-calendar-day-cell relative min-h-23 overflow-hidden p-2 ${
                                  hasDayEvents ? 'semester-calendar-day-cell-clickable' : ''
                                } ${
                                  highlightCurrentWeekDay
                                    ? 'semester-calendar-day-cell-current-week'
                                    : ''
                                } ${day.isToday ? 'semester-calendar-day-cell-today' : ''}`}
                                data-clickable={hasDayEvents ? 'true' : 'false'}
                                style={dayCellStyle}
                                tabIndex={hasDayEvents ? undefined : -1}
                                onClick={() => {
                                  if (!hasDayEvents) {
                                    return;
                                  }

                                  setSelectedDayEvents({
                                    dateKey: day.dateKey,
                                    events: dayEvents,
                                  });
                                }}
                              >
                                <div className="mb-1.5 flex min-h-5 items-start justify-between gap-1.5">
                                  <div className="flex items-baseline gap-1">
                                    <span
                                      className={`semester-calendar-day-number ${
                                        day.isToday ? 'semester-calendar-day-number-today' : ''
                                      } ${
                                        !day.isOutsideSemester || isFirstDayOfMonth || day.isToday
                                          ? 'font-semibold'
                                          : ''
                                      } ${
                                        day.isToday
                                          ? ''
                                          : day.isOutsideSemester
                                            ? 'text-text-tertiary'
                                            : !week.hasToday
                                              ? 'text-text-secondary'
                                              : 'text-text'
                                      }`}
                                    >
                                      {dayNum}
                                    </span>
                                  </div>

                                  {day.isSemesterStart || day.isSemesterEnd ? (
                                    <span className="semester-calendar-day-note semester-calendar-day-note-primary">
                                      {day.isSemesterStart ? '学期开始' : '学期结束'}
                                    </span>
                                  ) : day.isFirstTeachingDate ? (
                                    <span className="semester-calendar-day-note semester-calendar-day-note-info">
                                      教学开始
                                    </span>
                                  ) : day.isExamStart && day.isExamPeriod ? (
                                    <span className="semester-calendar-day-note semester-calendar-day-note-error">
                                      考试周
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex flex-col gap-1">
                                  {dayEvents.map((event) => {
                                    const isExpired = event.recordStatus === 'EXPIRED';

                                    return (
                                      <div
                                        key={event.id}
                                        className={resolveEventMarkerClassName(event)}
                                        title={resolveEventDisplayTopic(event)}
                                      >
                                        <span aria-hidden className="semester-calendar-event-icon">
                                          {renderEventTypeIcon(event.eventType)}
                                        </span>
                                        {event.dayPeriod === 'ALL_DAY' ? null : (
                                          <span className="semester-calendar-event-period">
                                            {DAY_PERIOD_LABELS[event.dayPeriod]}
                                          </span>
                                        )}
                                        <span
                                          className={
                                            isExpired
                                              ? 'semester-calendar-event-title semester-calendar-event-title-expired'
                                              : 'semester-calendar-event-title'
                                          }
                                        >
                                          {resolveEventDisplayTopic(event)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </button>
                            </Tooltip>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
      <Drawer
        destroyOnClose
        open={selectedDayEvents !== null}
        placement="right"
        size={520}
        title={
          selectedDayEvents
            ? `${formatDisplayDate(selectedDayEvents.dateKey)} 事件详情（${selectedDayEvents.events.length} 项）`
            : '事件详情'
        }
        onClose={() => setSelectedDayEvents(null)}
      >
        {selectedDayEvents ? (
          <div className="flex flex-col gap-4">
            {selectedDayEvents.events.map((event, index) => {
              const isExpired = event.recordStatus === 'EXPIRED';

              return (
                <section
                  key={event.id}
                  className={`flex flex-col gap-3 ${
                    index > 0 ? 'border-border-secondary border-t pt-4' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Text
                      strong
                      style={isExpired ? { textDecoration: 'line-through' } : undefined}
                      type={isExpired ? 'secondary' : undefined}
                    >
                      {resolveEventDisplayTopic(event)}
                    </Typography.Text>
                    <Tag>{DAY_PERIOD_LABELS_FULL[event.dayPeriod]}</Tag>
                    <Tag color="blue">{EVENT_TYPE_LABELS[event.eventType]}</Tag>
                    {showEventManagementMetadata ? (
                      <Tag>{RECORD_STATUS_LABELS[event.recordStatus]}</Tag>
                    ) : null}
                  </div>

                  {(() => {
                    const detailItems = [
                      {
                        key: 'semester',
                        label: '所属学期',
                        children:
                          semesters.find((semester) => semester.id === event.semesterId)?.name ??
                          '—',
                      },
                      {
                        key: 'eventDate',
                        label: '事件日期',
                        children: formatDisplayDate(event.eventDate),
                      },
                      {
                        key: 'teachingCalcEffect',
                        label: '教学影响',
                        children: TEACHING_CALC_EFFECT_LABELS[event.teachingCalcEffect],
                      },
                      {
                        key: 'originalDate',
                        label: '原始日期',
                        children: event.originalDate ? formatDisplayDate(event.originalDate) : '—',
                      },
                      ...(showEventManagementMetadata
                        ? [
                            {
                              key: 'updatedAt',
                              label: '更新时间',
                              children: formatDateTime(event.updatedAt),
                            },
                            {
                              key: 'version',
                              label: '版本号',
                              children: event.version,
                            },
                          ]
                        : []),
                    ];

                    return <Descriptions column={1} items={detailItems} />;
                  })()}

                  <div>
                    <Typography.Text strong>规则说明</Typography.Text>
                    <Typography.Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
                      {event.ruleNote || '暂无补充说明。'}
                    </Typography.Paragraph>
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
