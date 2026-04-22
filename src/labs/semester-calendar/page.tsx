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
  ReadOutlined,
  ScheduleOutlined,
  SwapOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useLoaderData, useNavigate } from 'react-router';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

import { semesterCalendarLabAccess } from './access';
import { semesterCalendarLabMeta } from './meta';

type AcademicCalendarEventDayPeriod = 'AFTERNOON' | 'ALL_DAY' | 'MORNING';
type AcademicCalendarEventRecordStatus = 'ACTIVE' | 'EXPIRED' | 'TENTATIVE';
type AcademicCalendarEventType =
  | 'ACTIVITY'
  | 'EXAM'
  | 'HOLIDAY'
  | 'HOLIDAY_MAKEUP'
  | 'SPORTS_MEET'
  | 'WEEKDAY_SWAP';
type AcademicCalendarTeachingCalcEffect = 'CANCEL' | 'MAKEUP' | 'NO_CHANGE' | 'SWAP';

type AcademicSemesterRecord = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};

type AcademicCalendarEventRecord = {
  createdAt: string;
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  id: number;
  originalDate: string | null;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote: string | null;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  updatedAt: string;
  updatedByAccountId: number | null;
  version: number;
};

type SemesterCalendarLabLoaderData = {
  viewerKind?: 'authenticated' | 'guest' | 'internal';
} | null;

type SemesterWeekDay = {
  date: Date;
  dateKey: string;
  isExamPeriod: boolean;
  isExamStart: boolean;
  isFirstTeachingDate: boolean;
  isToday: boolean;
  isOutsideSemester: boolean;
  isSemesterEnd: boolean;
  isSemesterStart: boolean;
};

type SemesterWeek = {
  days: SemesterWeekDay[];
  endDate: string;
  hasToday: boolean;
  key: string;
  label: string;
  weekNumber: number | null;
  startDate: string;
};

type SemesterMonthSpan = {
  key: string;
  label: string;
  span: number;
  startIndex: number;
};

type CalendarDayCellStyle = CSSProperties & {
  '--semester-calendar-day-bg': string;
};

type SelectedCalendarDayEvents = {
  dateKey: string;
  events: AcademicCalendarEventRecord[];
};

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const DAY_PERIOD_LABELS: Record<AcademicCalendarEventDayPeriod, string> = {
  AFTERNOON: '下午',
  ALL_DAY: '全天',
  MORNING: '上午',
};

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

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters($limit: Int) {
    academicSemesters(limit: $limit) {
      createdAt
      endDate
      examStartDate
      firstTeachingDate
      id
      isCurrent
      name
      schoolYear
      startDate
      termNumber
      updatedAt
    }
  }
`;

const LIST_ACADEMIC_CALENDAR_EVENTS_QUERY = `
  query AcademicCalendarEvents($limit: Int, $semesterId: Int) {
    academicCalendarEvents(limit: $limit, semesterId: $semesterId) {
      createdAt
      dayPeriod
      eventDate
      eventType
      id
      originalDate
      recordStatus
      ruleNote
      semesterId
      teachingCalcEffect
      topic
      updatedAt
      updatedByAccountId
      version
    }
  }
`;

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(date);
}

function formatMonthDay(value: string) {
  const date = parseIsoDate(value);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${month}-${day}`;
}

function formatWeekday(value: string) {
  const date = parseIsoDate(value);

  return WEEKDAY_LABELS[(date.getUTCDay() + 6) % 7];
}

function isAdjustedTeachingEvent(event: AcademicCalendarEventRecord) {
  return (
    event.originalDate !== null &&
    (event.eventType === 'HOLIDAY_MAKEUP' ||
      event.eventType === 'WEEKDAY_SWAP' ||
      event.teachingCalcEffect === 'MAKEUP' ||
      event.teachingCalcEffect === 'SWAP')
  );
}

function resolveEventDisplayTopic(event: AcademicCalendarEventRecord) {
  if (isAdjustedTeachingEvent(event) && event.originalDate) {
    return `调 ${formatMonthDay(event.originalDate)} 课(${formatWeekday(event.originalDate)})`;
  }

  return event.topic;
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
      return <ScheduleOutlined />;
    case 'HOLIDAY_MAKEUP':
    case 'WEEKDAY_SWAP':
      return <SwapOutlined />;
    case 'SPORTS_MEET':
      return <TeamOutlined />;
    case 'ACTIVITY':
    default:
      return <CalendarOutlined />;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  });
}

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

function getDayPeriodOrder(value: AcademicCalendarEventDayPeriod) {
  switch (value) {
    case 'MORNING':
      return 0;
    case 'AFTERNOON':
      return 1;
    case 'ALL_DAY':
      return 2;
    default:
      return 99;
  }
}

function sortCalendarEvents(records: AcademicCalendarEventRecord[]) {
  return [...records].sort((left, right) => {
    if (left.eventDate !== right.eventDate) {
      return left.eventDate.localeCompare(right.eventDate);
    }

    if (left.dayPeriod !== right.dayPeriod) {
      return getDayPeriodOrder(left.dayPeriod) - getDayPeriodOrder(right.dayPeriod);
    }

    return left.id - right.id;
  });
}

function pickNextSemesterId(
  records: AcademicSemesterRecord[],
  currentSelection: number | null,
  preferredSelection?: number | null,
) {
  if (preferredSelection && records.some((record) => record.id === preferredSelection)) {
    return preferredSelection;
  }

  if (currentSelection && records.some((record) => record.id === currentSelection)) {
    return currentSelection;
  }

  return records[0]?.id ?? null;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 86400000);
}

function startOfWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addDays(date, -weekday);
}

function endOfWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addDays(date, 6 - weekday);
}

function isSameIsoDate(left: Date, right: Date) {
  return formatIsoDate(left) === formatIsoDate(right);
}

function isDateWithinRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function buildSemesterWeeks(semester: AcademicSemesterRecord): SemesterWeek[] {
  const semesterStart = parseIsoDate(semester.startDate);
  const semesterEnd = parseIsoDate(semester.endDate);
  const examStart = parseIsoDate(semester.examStartDate);
  const examWeekEnd = endOfWeek(examStart);
  const firstTeachingDate = parseIsoDate(semester.firstTeachingDate);
  const firstWeekStart = startOfWeek(semesterStart);
  const firstTeachingWeekStart = startOfWeek(firstTeachingDate);
  const lastWeekEnd = endOfWeek(semesterEnd);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const weeks: SemesterWeek[] = [];

  for (
    let cursor = firstWeekStart, index = 1;
    cursor.getTime() <= lastWeekEnd.getTime();
    cursor = addDays(cursor, 7), index += 1
  ) {
    const weekEnd = addDays(cursor, 6);
    const days: SemesterWeekDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const currentDate = addDays(cursor, dayIndex);

      days.push({
        date: currentDate,
        dateKey: formatIsoDate(currentDate),
        isExamPeriod:
          isDateWithinRange(currentDate, examStart, examWeekEnd) && !isWeekendDate(currentDate),
        isExamStart: isSameIsoDate(currentDate, examStart),
        isFirstTeachingDate: isSameIsoDate(currentDate, firstTeachingDate),
        isToday: isSameIsoDate(currentDate, todayUtc),
        isOutsideSemester: !isDateWithinRange(currentDate, semesterStart, semesterEnd),
        isSemesterEnd: isSameIsoDate(currentDate, semesterEnd),
        isSemesterStart: isSameIsoDate(currentDate, semesterStart),
      });
    }

    weeks.push({
      days,
      endDate: formatIsoDate(weekEnd),
      hasToday: isDateWithinRange(todayUtc, cursor, weekEnd),
      key: formatIsoDate(cursor),
      label: `第 ${index} 周`,
      startDate: formatIsoDate(cursor),
      weekNumber:
        cursor.getTime() < firstTeachingWeekStart.getTime()
          ? null
          : Math.floor((cursor.getTime() - firstTeachingWeekStart.getTime()) / (7 * 86400000)) + 1,
    });
  }

  return weeks;
}

function buildEventBuckets(events: AcademicCalendarEventRecord[]) {
  const buckets = new Map<string, AcademicCalendarEventRecord[]>();

  for (const event of events) {
    const current = buckets.get(event.eventDate) ?? [];
    current.push(event);
    buckets.set(event.eventDate, current);
  }

  return buckets;
}

function resolveWeekMonth(week: SemesterWeek) {
  const representativeDay = week.days.find((day) => !day.isOutsideSemester) ?? week.days[0];
  const year = representativeDay.date.getUTCFullYear();
  const month = representativeDay.date.getUTCMonth() + 1;

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: `${month}月`,
  };
}

function buildWeekMonthSpans(weeks: SemesterWeek[]): SemesterMonthSpan[] {
  const spans: SemesterMonthSpan[] = [];

  for (const [index, week] of weeks.entries()) {
    const weekMonth = resolveWeekMonth(week);
    const currentSpan = spans.at(-1);

    if (currentSpan?.key === weekMonth.key) {
      currentSpan.span += 1;
    } else {
      spans.push({
        key: weekMonth.key,
        label: weekMonth.label,
        span: 1,
        startIndex: index,
      });
    }
  }

  return spans;
}

function isWeekendDate(date: Date) {
  const weekday = date.getUTCDay();

  return weekday === 0 || weekday === 6;
}

function shouldHighlightCurrentWeekDay(day: SemesterWeekDay) {
  return !day.isOutsideSemester && !isWeekendDate(day.date);
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

  if (hasWorkdayOverride) {
    return 'var(--ant-color-bg-container)';
  }

  if (hasHoliday) {
    return 'var(--ant-color-warning-bg)';
  }

  if (day.isExamPeriod || events.some((event) => event.eventType === 'EXAM')) {
    return 'var(--ant-color-error-bg)';
  }

  if (events.some((event) => event.eventType === 'SPORTS_MEET')) {
    return 'var(--ant-color-success-bg)';
  }

  return 'var(--ant-color-bg-container)';
}

function resolveAcademicCalendarErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

async function requestAcademicSemesters() {
  try {
    const response = await executeGraphQL<
      { academicSemesters: AcademicSemesterRecord[] },
      { limit: number }
    >(LIST_ACADEMIC_SEMESTERS_QUERY, { limit: 500 });

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法加载学期信息。'));
  }
}

async function requestAcademicCalendarEvents(semesterId: number) {
  try {
    const response = await executeGraphQL<
      { academicCalendarEvents: AcademicCalendarEventRecord[] },
      { limit: number; semesterId: number }
    >(LIST_ACADEMIC_CALENDAR_EVENTS_QUERY, {
      limit: 500,
      semesterId,
    });

    return response.academicCalendarEvents;
  } catch (error) {
    throw new Error(resolveAcademicCalendarErrorMessage(error, '暂时无法加载校历事件。'));
  }
}

export function SemesterCalendarLabPage() {
  const navigate = useNavigate();
  const loaderData = useLoaderData() as SemesterCalendarLabLoaderData;
  const internalViewer = loaderData?.viewerKind === 'internal';
  const roleLabel =
    loaderData?.viewerKind === 'internal'
      ? '内部用户'
      : loaderData?.viewerKind === 'guest'
        ? '访客身份'
        : '登录用户';

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
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);

  const loadSemesters = useCallback(async () => {
    setSemestersLoading(true);
    setSemesterError(null);

    try {
      const result = sortSemesters(await requestAcademicSemesters());

      setSemesters(result);
      setSelectedSemesterId((currentSelection) => pickNextSemesterId(result, currentSelection));
    } catch (error) {
      setSemesterError(error instanceof Error ? error.message : '暂时无法加载学期信息。');
    } finally {
      setSemestersLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (semesterId: number) => {
    setEventsLoading(true);
    setEventError(null);

    try {
      const result = sortCalendarEvents(await requestAcademicCalendarEvents(semesterId));

      setEvents(result);
    } catch (error) {
      setEventError(error instanceof Error ? error.message : '暂时无法加载校历事件。');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (selectedSemesterId === null) {
      setEvents([]);
      setEventError(null);
      return;
    }

    void loadEvents(selectedSemesterId);
  }, [loadEvents, selectedSemesterId]);

  const selectedSemester =
    selectedSemesterId === null
      ? null
      : (semesters.find((record) => record.id === selectedSemesterId) ?? null);

  useEffect(() => {
    setSelectedDayEvents(null);
  }, [selectedSemesterId]);

  useEffect(() => {
    setCalendarScrollLeft(0);

    if (calendarScrollRef.current) {
      calendarScrollRef.current.scrollLeft = 0;
    }
  }, [selectedSemesterId]);

  const weeks = useMemo(
    () => (selectedSemester ? buildSemesterWeeks(selectedSemester) : []),
    [selectedSemester],
  );
  const teachingWeekCount = weeks.filter((week) => week.weekNumber !== null).length;
  const monthSpans = useMemo(() => buildWeekMonthSpans(weeks), [weeks]);
  const eventBuckets = useMemo(() => buildEventBuckets(events), [events]);
  const activeCount = events.filter((event) => event.recordStatus === 'ACTIVE').length;
  const tentativeCount = events.filter((event) => event.recordStatus === 'TENTATIVE').length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              学期校历
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {semesterCalendarLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{semesterCalendarLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{semesterCalendarLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{semesterCalendarLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">
              访问级别：{semesterCalendarLabAccess.allowedAccessLevels.join(', ')}
            </Tag>
            <Tag color="cyan">当前身份：{roleLabel}</Tag>
          </div>

          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            这里按学期周视图展示校历：可视范围从 `startDate` 所在周开始，到 `endDate`
            所在周结束；周次从 `firstTeachingDate` 所在周开始计为第 1 周。
            淡化日期表示补齐该周时带出的学期外日期。
          </Typography.Paragraph>
        </div>
      </Card>

      {internalViewer ? (
        <Alert
          action={
            <Button
              type="primary"
              onClick={() => {
                navigate('/academic-affairs/academic-calendar');
              }}
            >
              进入正式管理页
            </Button>
          }
          description="正式区继续负责学期与校历事件的新增、编辑和删除；labs 页只负责更适合阅读的学期周视图。"
          showIcon
          title="当前为只读校历工作台"
          type="info"
        />
      ) : null}

      <Card title="学期切换">
        {semesterError ? (
          <Alert
            action={
              <Button size="small" type="primary" onClick={() => void loadSemesters()}>
                重试
              </Button>
            }
            title={semesterError}
            showIcon
            type="error"
          />
        ) : semestersLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : semesters.length === 0 ? (
          <Empty description="当前还没有可浏览的学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="flex flex-wrap gap-3">
            {semesters.map((semester) => {
              const selected = semester.id === selectedSemesterId;

              return (
                <Button
                  key={semester.id}
                  type={selected ? 'primary' : 'default'}
                  onClick={() => setSelectedSemesterId(semester.id)}
                >
                  {semester.name}
                </Button>
              );
            })}
          </div>
        )}
      </Card>

      {selectedSemester ? (
        <Fragment>
          <Card
            extra={
              selectedSemester.isCurrent ? (
                <Tag color="green" variant="filled">
                  当前学期
                </Tag>
              ) : null
            }
            title={selectedSemester.name}
          >
            <div className="flex flex-col gap-4">
              <Typography.Paragraph style={{ marginBottom: 0 }} type="secondary">
                {selectedSemester.startDate} 至 {selectedSemester.endDate}
              </Typography.Paragraph>

              <Descriptions
                column={2}
                items={[
                  {
                    key: 'range',
                    label: '学期范围',
                    children: `${selectedSemester.startDate} - ${selectedSemester.endDate}`,
                  },
                  {
                    key: 'teaching',
                    label: '教学开始',
                    children: selectedSemester.firstTeachingDate,
                  },
                  {
                    key: 'exam',
                    label: '考试周开始',
                    children: selectedSemester.examStartDate,
                  },
                  {
                    key: 'weeks',
                    label: '周数',
                    children: `共 ${teachingWeekCount} 周（按教学开始日所在周计算）`,
                  },
                  {
                    key: 'events',
                    label: '事件概览',
                    children: `${events.length} 项事件 / ${activeCount} 项生效`,
                  },
                ]}
              />

              <Space wrap>
                {tentativeCount > 0 ? <Tag color="gold">暂定 {tentativeCount}</Tag> : null}
                {events.length > activeCount + tentativeCount ? (
                  <Tag>弱化展示 {events.length - activeCount - tentativeCount}</Tag>
                ) : null}
              </Space>
            </div>
          </Card>

          <Card title="学期周视图">
            {eventsLoading ? (
              <Skeleton active paragraph={{ rows: 10 }} />
            ) : eventError ? (
              <Alert
                action={
                  <Button
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
                title={eventError}
                showIcon
                type="error"
              />
            ) : weeks.length === 0 ? (
              <Empty
                description="当前学期没有可展示的周视图"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="flex flex-col">
                <div className="semester-calendar-sticky-head-shell">
                  <div
                    className="semester-calendar-sticky-head grid min-w-[920px]"
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
                    className="semester-calendar-sheet min-w-[920px] overflow-hidden rounded-b-md border border-t-0"
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
                            className={`semester-calendar-axis-cell semester-calendar-week-cell ${
                              hasTeachingWeekNumber ? 'semester-calendar-week-cell-active' : ''
                            } ${week.hasToday ? 'semester-calendar-week-cell-current' : ''}`}
                            style={{
                              gridColumn: 1,
                              gridRow: weekIndex + 1,
                            }}
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
                              '--semester-calendar-day-bg': resolveDayCellBackground(
                                day,
                                dayEvents,
                              ),
                              gridColumn: 3 + dayIndex,
                              gridRow: weekIndex + 1,
                            };
                            const dayCellContent = (
                              <Fragment>
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
                              </Fragment>
                            );

                            const dayCellClassName = `semester-calendar-day-cell relative min-h-[92px] overflow-hidden p-2 ${
                              hasDayEvents ? 'semester-calendar-day-cell-clickable' : ''
                            } ${
                              highlightCurrentWeekDay
                                ? 'semester-calendar-day-cell-current-week'
                                : ''
                            } ${day.isToday ? 'semester-calendar-day-cell-today' : ''}`;

                            return (
                              <button
                                key={day.dateKey}
                                type="button"
                                aria-label={
                                  hasDayEvents
                                    ? `${formatDisplayDate(day.dateKey)}，${dayEvents.length} 项事件`
                                    : `${formatDisplayDate(day.dateKey)}，无事件`
                                }
                                aria-disabled={!hasDayEvents}
                                className={dayCellClassName}
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
                                {dayCellContent}
                              </button>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </Fragment>
      ) : null}

      <Modal
        destroyOnHidden
        footer={
          internalViewer ? (
            <Button
              type="primary"
              onClick={() => {
                navigate('/academic-affairs/academic-calendar');
              }}
            >
              去正式页维护
            </Button>
          ) : null
        }
        open={selectedDayEvents !== null}
        title={
          selectedDayEvents
            ? `${formatDisplayDate(selectedDayEvents.dateKey)} 事件详情（${selectedDayEvents.events.length} 项）`
            : '事件详情'
        }
        width={760}
        onCancel={() => setSelectedDayEvents(null)}
      >
        {selectedDayEvents ? (
          <div className="flex flex-col gap-4 pt-2">
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
                    <Tag>{DAY_PERIOD_LABELS[event.dayPeriod]}</Tag>
                    <Tag color="blue">{EVENT_TYPE_LABELS[event.eventType]}</Tag>
                    {internalViewer ? <Tag>{RECORD_STATUS_LABELS[event.recordStatus]}</Tag> : null}
                  </div>

                  <Descriptions
                    column={1}
                    items={[
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
                      ...(internalViewer
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
                    ]}
                  />

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
      </Modal>
    </div>
  );
}
