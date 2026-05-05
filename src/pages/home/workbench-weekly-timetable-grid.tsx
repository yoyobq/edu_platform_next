import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CloseOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal } from 'antd';

import {
  type AcademicTimetableGridItem,
  type AcademicTimetableItem,
  buildTimetableSlotPlacements,
  resolveCourseCategoryMeta,
  resolveTimetablePeriodCount,
} from '@/features/academic-timetable';

import './workbench-weekly-timetable-grid.css';

type TimetableSlotGroupStyle = CSSProperties & {
  '--workbench-weekly-timetable-slot-layer'?: string;
};

type TimetableViewKey = 'semester' | 'weekly';
type TimetableDisplayRow =
  | {
      key: string;
      kind: 'break';
      label: string;
    }
  | {
      key: string;
      kind: 'period';
      period: number;
    };
type VisibleTimetableDay = {
  dayOfWeek: number;
  label: string;
};
type TimetableCustomItem = {
  backgroundColor?: string;
  dayOfWeek: number;
  id: string;
  rowKey: string;
  title: string;
};
type EditingCustomCell = {
  dayOfWeek: number;
  dayLabel: string;
  rowKey: string;
  rowLabel: string;
};
type CurrentTimeIndicatorStyle = {
  left: number;
  top: number;
  width: number;
};
type TimetableTimeSegment = {
  endMinute: number;
  rowKey: string;
  startMinute: number;
};

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEKEND_DAY_OF_WEEKS = [6, 7] as const;
const TIMETABLE_CUSTOM_ITEMS_STORAGE_PREFIX = 'edu-mate:timetable-custom-items:v1';
const DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR = 'var(--color-ai-accent-bg)';
const PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR = 'rgb(243 232 255 / 0.82)';
const DEFAULT_CUSTOM_ITEMS: readonly TimetableCustomItem[] = [
  {
    backgroundColor: PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR,
    dayOfWeek: 5,
    id: 'default-friday-period-5-class-meeting',
    rowKey: 'period-5',
    title: '班会',
  },
];
const CUSTOM_ITEM_BACKGROUND_OPTIONS = [
  {
    label: 'AI 橙',
    value: DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '蓝',
    value: 'rgb(219 234 254 / 0.82)',
  },
  {
    label: '绿',
    value: 'rgb(220 252 231 / 0.82)',
  },
  {
    label: '紫',
    value: PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '黄',
    value: 'rgb(254 249 195 / 0.82)',
  },
] as const;

const TIMETABLE_TIME_SEGMENTS: readonly TimetableTimeSegment[] = [
  { endMinute: 8 * 60 + 15, rowKey: 'break-morning', startMinute: 8 * 60 },
  { endMinute: 9 * 60 + 5, rowKey: 'period-1', startMinute: 8 * 60 + 25 },
  { endMinute: 9 * 60 + 55, rowKey: 'period-2', startMinute: 9 * 60 + 15 },
  { endMinute: 10 * 60 + 55, rowKey: 'period-3', startMinute: 10 * 60 + 15 },
  { endMinute: 11 * 60 + 45, rowKey: 'period-4', startMinute: 11 * 60 + 5 },
  { endMinute: 13 * 60 + 30, rowKey: 'break-lunch', startMinute: 11 * 60 + 45 },
  { endMinute: 14 * 60 + 10, rowKey: 'period-5', startMinute: 13 * 60 + 30 },
  { endMinute: 15 * 60, rowKey: 'period-6', startMinute: 14 * 60 + 20 },
  { endMinute: 15 * 60 + 50, rowKey: 'period-7', startMinute: 15 * 60 + 10 },
  { endMinute: 16 * 60 + 40, rowKey: 'period-8', startMinute: 16 * 60 },
  { endMinute: 16 * 60 + 30, rowKey: 'break-after-school', startMinute: 15 * 60 },
] as const;

function formatLocalDatePart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function normalizeDatePart(value: string) {
  const [datePart] = value.split('T');
  const [year, month, day] = datePart.split('-');

  if (year && month && day) {
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatLocalDatePart(date);
}

function parseLocalDatePart(value: string) {
  const [yearValue, monthValue, dayValue] = value.split('-').map(Number);

  if (!yearValue || !monthValue || !dayValue) {
    return null;
  }

  return new Date(yearValue, monthValue - 1, dayValue);
}

function addLocalDays(date: Date, offset: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + offset);

  return nextDate;
}

function resolveMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function resolveEffectiveTimeSegments(periodCount: number) {
  return TIMETABLE_TIME_SEGMENTS.filter((segment) => {
    if (segment.rowKey.startsWith('period-')) {
      return Number(segment.rowKey.replace('period-', '')) <= periodCount;
    }

    if (segment.rowKey === 'break-lunch') {
      return periodCount >= 4;
    }

    if (segment.rowKey === 'break-after-school') {
      return periodCount <= 6;
    }

    return true;
  });
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

function buildWeeklyDateByDayOfWeek(items: readonly AcademicTimetableItem[]) {
  const nextDateByDayOfWeek = new Map<number, string>();
  const anchors: Array<{ datePart: string; dayOfWeek: number }> = [];

  for (const item of items) {
    const datePart = normalizeDatePart(item.date);

    if (!datePart) {
      continue;
    }

    if (!nextDateByDayOfWeek.has(item.dayOfWeek)) {
      nextDateByDayOfWeek.set(item.dayOfWeek, datePart);
    }

    anchors.push({ datePart, dayOfWeek: item.dayOfWeek });
  }

  const anchor = anchors[0];
  const anchorDate = anchor ? parseLocalDatePart(anchor.datePart) : null;

  if (!anchor || !anchorDate) {
    return nextDateByDayOfWeek;
  }

  const mondayDate = addLocalDays(anchorDate, 1 - anchor.dayOfWeek);

  for (let dayOfWeek = 1; dayOfWeek <= DAY_OF_WEEK_LABELS.length; dayOfWeek += 1) {
    if (!nextDateByDayOfWeek.has(dayOfWeek)) {
      nextDateByDayOfWeek.set(
        dayOfWeek,
        formatLocalDatePart(addLocalDays(mondayDate, dayOfWeek - 1)),
      );
    }
  }

  return nextDateByDayOfWeek;
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
    return 'workbench-weekly-timetable-entry-status workbench-weekly-timetable-entry-status-inactive';
  }

  if (item.calcEffect === 'MAKEUP' || item.calcEffect === 'SWAP_IN') {
    return 'workbench-weekly-timetable-entry-status workbench-weekly-timetable-entry-status-active';
  }

  return 'workbench-weekly-timetable-entry-status workbench-weekly-timetable-entry-status-default';
}

function getWeeklyTimetableEntryKey(item: AcademicTimetableItem) {
  return `${item.scheduleId}-${item.slotId}`;
}

function getWeeklyTimetableItemTieBreaker(item: AcademicTimetableItem) {
  return `${item.courseName}-${item.teachingClassName}-${item.date}`;
}

function toWorkbenchTimetableClassName(className: string) {
  return className.replaceAll('academic-timetable-', 'workbench-weekly-timetable-');
}

function buildTimetableDisplayRows(periodCount: number): TimetableDisplayRow[] {
  const rows: TimetableDisplayRow[] = [
    {
      key: 'break-morning',
      kind: 'break',
      label: '晨会',
    },
  ];

  for (let period = 1; period <= periodCount; period += 1) {
    rows.push({
      key: `period-${period}`,
      kind: 'period',
      period,
    });

    if (period === 4) {
      rows.push({
        key: 'break-lunch',
        kind: 'break',
        label: '午休',
      });
    }
  }

  rows.push({
    key: 'break-after-school',
    kind: 'break',
    label: '课后',
  });

  return rows;
}

function buildVisibleTimetableDays<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
  expandedWeekendDayOfWeeks: readonly number[],
  viewKey: TimetableViewKey,
  forceVisibleDayOfWeek?: number | null,
): VisibleTimetableDay[] {
  const dayOfWeeksWithItems = new Set(items.map((item) => item.dayOfWeek));
  const expandedWeekendDayOfWeekSet = new Set(expandedWeekendDayOfWeeks);

  return DAY_OF_WEEK_LABELS.map((label, index) => ({
    dayOfWeek: index + 1,
    label,
  })).filter((day) => {
    if (day.dayOfWeek <= 5) {
      return true;
    }

    return (
      viewKey === 'weekly' &&
      (dayOfWeeksWithItems.has(day.dayOfWeek) ||
        expandedWeekendDayOfWeekSet.has(day.dayOfWeek) ||
        forceVisibleDayOfWeek === day.dayOfWeek)
    );
  });
}

function hasStringRecordValue<TValue extends string>(
  item: AcademicTimetableGridItem,
  key: TValue,
): item is AcademicTimetableGridItem & Record<TValue, string> {
  return typeof (item as Record<string, unknown>)[key] === 'string';
}

function hasNumberRecordValue<TValue extends string>(
  item: AcademicTimetableGridItem,
  key: TValue,
): item is AcademicTimetableGridItem & Record<TValue, number> {
  return typeof (item as Record<string, unknown>)[key] === 'number';
}

function buildCustomItemStorageKey<TItem extends AcademicTimetableGridItem>(
  items: TItem[],
  viewKey: TimetableViewKey,
) {
  const pathname = typeof window === 'undefined' ? 'server' : window.location.pathname;
  const semesterScope = Array.from(
    new Set(
      items
        .filter((item) => hasNumberRecordValue(item, 'semesterId'))
        .map((item) => item.semesterId),
    ),
  )
    .sort((left, right) => left - right)
    .join(',');
  const dateScope = Array.from(
    new Set(
      items
        .filter((item) => hasStringRecordValue(item, 'date'))
        .map((item) => item.date.split('T')[0]),
    ),
  )
    .sort()
    .join(',');

  return [
    TIMETABLE_CUSTOM_ITEMS_STORAGE_PREFIX,
    pathname,
    viewKey,
    semesterScope || 'no-semester',
    dateScope || 'no-dates',
  ].join(':');
}

function isTimetableCustomItem(value: unknown): value is TimetableCustomItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<TimetableCustomItem>;

  return (
    typeof item.dayOfWeek === 'number' &&
    (item.backgroundColor === undefined || typeof item.backgroundColor === 'string') &&
    typeof item.id === 'string' &&
    typeof item.rowKey === 'string' &&
    typeof item.title === 'string'
  );
}

function readCustomItems(storageKey: string): TimetableCustomItem[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_CUSTOM_ITEMS];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return [...DEFAULT_CUSTOM_ITEMS];
    }

    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue) ? parsedValue.filter(isTimetableCustomItem) : [];
  } catch {
    return [...DEFAULT_CUSTOM_ITEMS];
  }
}

function writeCustomItems(storageKey: string, items: readonly TimetableCustomItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

function createCustomItemId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function BaseTimetableGrid<TItem extends AcademicTimetableGridItem>(props: {
  currentWeekIndex?: number | null;
  emptyDescription: string;
  getDayDate?: (dayOfWeek: number) => string | null;
  getEntryKey: (item: TItem) => string;
  getTieBreaker: (item: TItem) => string;
  getDayHeaderSupplement?: (dayOfWeek: number) => string | null;
  isWeekNavigationLoading?: boolean;
  items: TItem[];
  maxWeekIndex?: number | null;
  onWeekChange?: (weekIndex: number) => void;
  renderEntry: (item: TItem) => ReactNode;
  selectedWeekIndex?: number | null;
  showCurrentTimeIndicator?: boolean;
  viewKey: TimetableViewKey;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [expandedWeekendDayOfWeeks, setExpandedWeekendDayOfWeeks] = useState<readonly number[]>([]);
  const [currentDatePart, setCurrentDatePart] = useState(() => formatLocalDatePart(new Date()));
  const [currentTimeIndicatorStyle, setCurrentTimeIndicatorStyle] =
    useState<CurrentTimeIndicatorStyle | null>(null);
  const [customItems, setCustomItems] = useState<TimetableCustomItem[]>([]);
  const [editingCustomCell, setEditingCustomCell] = useState<EditingCustomCell | null>(null);
  const [customItemBackgroundColor, setCustomItemBackgroundColor] = useState(
    DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  );
  const [customItemTitle, setCustomItemTitle] = useState('');
  const slotPlacements = useMemo(
    () => buildTimetableSlotPlacements(props.items, props.getTieBreaker),
    [props.getTieBreaker, props.items],
  );
  const customItemStorageKey = useMemo(
    () => buildCustomItemStorageKey(props.items, props.viewKey),
    [props.items, props.viewKey],
  );
  const periodCount = useMemo(() => resolveTimetablePeriodCount(props.items), [props.items]);
  const dayOfWeeksWithItems = useMemo(
    () => new Set(props.items.map((item) => item.dayOfWeek)),
    [props.items],
  );
  const currentTimeIndicatorDayOfWeek = useMemo(() => {
    if (!props.showCurrentTimeIndicator || !props.getDayDate) {
      return null;
    }

    for (let dayOfWeek = 1; dayOfWeek <= DAY_OF_WEEK_LABELS.length; dayOfWeek += 1) {
      if (props.getDayDate(dayOfWeek) === currentDatePart) {
        return dayOfWeek;
      }
    }

    return null;
  }, [currentDatePart, props]);
  const hiddenWeekendDays = useMemo(
    () =>
      WEEKEND_DAY_OF_WEEKS.filter(
        (dayOfWeek) =>
          props.viewKey === 'weekly' &&
          dayOfWeek !== currentTimeIndicatorDayOfWeek &&
          !dayOfWeeksWithItems.has(dayOfWeek) &&
          !expandedWeekendDayOfWeeks.includes(dayOfWeek),
      ),
    [currentTimeIndicatorDayOfWeek, dayOfWeeksWithItems, expandedWeekendDayOfWeeks, props.viewKey],
  );
  const expandedEmptyWeekendDays = useMemo(
    () =>
      WEEKEND_DAY_OF_WEEKS.filter(
        (dayOfWeek) =>
          props.viewKey === 'weekly' &&
          dayOfWeek !== currentTimeIndicatorDayOfWeek &&
          !dayOfWeeksWithItems.has(dayOfWeek) &&
          expandedWeekendDayOfWeeks.includes(dayOfWeek),
      ),
    [currentTimeIndicatorDayOfWeek, dayOfWeeksWithItems, expandedWeekendDayOfWeeks, props.viewKey],
  );
  const visibleDays = useMemo(
    () =>
      buildVisibleTimetableDays(
        props.items,
        expandedWeekendDayOfWeeks,
        props.viewKey,
        currentTimeIndicatorDayOfWeek,
      ),
    [currentTimeIndicatorDayOfWeek, expandedWeekendDayOfWeeks, props.items, props.viewKey],
  );
  const visibleDayCount = visibleDays.length;
  const gridColumnByDayOfWeek = useMemo(() => {
    const nextGridColumnByDayOfWeek = new Map<number, number>();

    visibleDays.forEach((day, index) => {
      nextGridColumnByDayOfWeek.set(day.dayOfWeek, index + 2);
    });

    return nextGridColumnByDayOfWeek;
  }, [visibleDays]);
  const customItemRowKeys = useMemo(() => {
    const visibleDayOfWeekSet = new Set(visibleDays.map((day) => day.dayOfWeek));

    return new Set(
      customItems
        .filter((item) => visibleDayOfWeekSet.has(item.dayOfWeek))
        .map((item) => item.rowKey),
    );
  }, [customItems, visibleDays]);
  const visibleSlotPlacements = useMemo(
    () =>
      slotPlacements.filter(
        (group) => group.periodStart <= periodCount && gridColumnByDayOfWeek.has(group.dayOfWeek),
      ),
    [gridColumnByDayOfWeek, periodCount, slotPlacements],
  );
  const displayRows = useMemo(() => buildTimetableDisplayRows(periodCount), [periodCount]);
  const effectiveTimeSegments = useMemo(
    () => resolveEffectiveTimeSegments(periodCount),
    [periodCount],
  );
  const gridRowByPeriod = useMemo(() => {
    const nextGridRowByPeriod = new Map<number, number>();

    displayRows.forEach((row, index) => {
      if (row.kind === 'period') {
        nextGridRowByPeriod.set(row.period, index + 2);
      }
    });

    return nextGridRowByPeriod;
  }, [displayRows]);
  const displayWeekIndex = props.selectedWeekIndex ?? props.currentWeekIndex ?? null;
  const isCurrentWeek =
    displayWeekIndex !== null &&
    props.currentWeekIndex !== null &&
    displayWeekIndex === props.currentWeekIndex;
  const canNavigatePreviousWeek =
    Boolean(props.onWeekChange) && displayWeekIndex !== null && displayWeekIndex > 1;
  const canNavigateNextWeek =
    Boolean(props.onWeekChange) &&
    displayWeekIndex !== null &&
    (props.maxWeekIndex === null ||
      props.maxWeekIndex === undefined ||
      displayWeekIndex < props.maxWeekIndex);

  useEffect(() => {
    setCustomItems(readCustomItems(customItemStorageKey));
  }, [customItemStorageKey]);

  useEffect(() => {
    if (!props.showCurrentTimeIndicator) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setCurrentDatePart(formatLocalDatePart(new Date()));
    }, 30_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [props.showCurrentTimeIndicator]);

  const updateCurrentTimeIndicator = useCallback(() => {
    if (!props.showCurrentTimeIndicator || currentTimeIndicatorDayOfWeek === null) {
      setCurrentTimeIndicatorStyle(null);
      return;
    }

    const gridElement = gridRef.current;

    if (!gridElement) {
      setCurrentTimeIndicatorStyle(null);
      return;
    }

    const dayElement = gridElement.querySelector<HTMLElement>(
      `[data-workbench-weekly-timetable-day="${currentTimeIndicatorDayOfWeek}"]`,
    );
    const measuredSegments = effectiveTimeSegments
      .map((segment) => {
        const rowElement = gridElement.querySelector<HTMLElement>(
          `[data-workbench-weekly-timetable-row="${segment.rowKey}"]`,
        );

        return rowElement ? { rowElement, segment } : null;
      })
      .filter(
        (item): item is { rowElement: HTMLElement; segment: TimetableTimeSegment } => item !== null,
      );

    if (!dayElement || measuredSegments.length === 0) {
      setCurrentTimeIndicatorStyle(null);
      return;
    }

    const gridRect = gridElement.getBoundingClientRect();
    const dayRect = dayElement.getBoundingClientRect();
    const nowMinute = resolveMinuteOfDay(new Date());
    const firstSegment = measuredSegments[0];

    if (nowMinute < firstSegment.segment.startMinute) {
      setCurrentTimeIndicatorStyle(null);
      return;
    }

    let top: number | null = null;

    for (let index = 0; index < measuredSegments.length; index += 1) {
      const measuredSegment = measuredSegments[index];
      const rowRect = measuredSegment.rowElement.getBoundingClientRect();

      if (
        nowMinute >= measuredSegment.segment.startMinute &&
        nowMinute <= measuredSegment.segment.endMinute
      ) {
        const duration = measuredSegment.segment.endMinute - measuredSegment.segment.startMinute;
        const progress =
          duration > 0 ? (nowMinute - measuredSegment.segment.startMinute) / duration : 0;

        top = rowRect.top - gridRect.top + rowRect.height * progress;
        break;
      }

      const nextMeasuredSegment = measuredSegments[index + 1];

      if (
        nextMeasuredSegment &&
        nowMinute > measuredSegment.segment.endMinute &&
        nowMinute < nextMeasuredSegment.segment.startMinute
      ) {
        const nextRowRect = nextMeasuredSegment.rowElement.getBoundingClientRect();
        const gapDuration =
          nextMeasuredSegment.segment.startMinute - measuredSegment.segment.endMinute;
        const gapProgress =
          gapDuration > 0 ? (nowMinute - measuredSegment.segment.endMinute) / gapDuration : 1;
        const gapStart = rowRect.bottom - gridRect.top;
        const gapEnd = nextRowRect.top - gridRect.top;

        top = gapStart + (gapEnd - gapStart) * gapProgress;
        break;
      }
    }

    if (top === null) {
      setCurrentTimeIndicatorStyle(null);
      return;
    }

    const clampedTop = Math.max(0, Math.min(top, gridElement.clientHeight - 1));
    const nextStyle = {
      left: dayRect.left - gridRect.left,
      top: clampedTop,
      width: dayRect.width,
    };

    setCurrentTimeIndicatorStyle((currentStyle) => {
      if (
        currentStyle &&
        Math.abs(currentStyle.left - nextStyle.left) < 0.5 &&
        Math.abs(currentStyle.top - nextStyle.top) < 0.5 &&
        Math.abs(currentStyle.width - nextStyle.width) < 0.5
      ) {
        return currentStyle;
      }

      return nextStyle;
    });
  }, [currentTimeIndicatorDayOfWeek, effectiveTimeSegments, props.showCurrentTimeIndicator]);

  useEffect(() => {
    if (!props.showCurrentTimeIndicator) {
      setCurrentTimeIndicatorStyle(null);
      return undefined;
    }

    updateCurrentTimeIndicator();

    const timerId = window.setInterval(updateCurrentTimeIndicator, 30_000);
    const gridElement = gridRef.current;
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => updateCurrentTimeIndicator());

    if (gridElement) {
      resizeObserver?.observe(gridElement);
    }

    window.addEventListener('resize', updateCurrentTimeIndicator);

    return () => {
      window.clearInterval(timerId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateCurrentTimeIndicator);
    };
  }, [props.showCurrentTimeIndicator, updateCurrentTimeIndicator]);

  if (props.items.length === 0) {
    return <Empty description={props.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  function updateCustomItems(nextItems: TimetableCustomItem[]) {
    setCustomItems(nextItems);
    writeCustomItems(customItemStorageKey, nextItems);
  }

  function resolveCellCustomItems(dayOfWeek: number, rowKey: string) {
    return customItems.filter((item) => item.dayOfWeek === dayOfWeek && item.rowKey === rowKey);
  }

  function isCellOccupied(dayOfWeek: number, row: TimetableDisplayRow) {
    return (
      row.kind === 'period' &&
      visibleSlotPlacements.some(
        (group) =>
          group.dayOfWeek === dayOfWeek &&
          group.periodStart <= row.period &&
          group.periodEnd >= row.period,
      )
    );
  }

  function openCustomItemEditor(day: VisibleTimetableDay, row: TimetableDisplayRow) {
    setCustomItemTitle('');
    setCustomItemBackgroundColor(DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR);
    setEditingCustomCell({
      dayOfWeek: day.dayOfWeek,
      dayLabel: day.label,
      rowKey: row.key,
      rowLabel: row.kind === 'period' ? `第 ${row.period} 节` : row.label,
    });
  }

  function closeCustomItemEditor() {
    setEditingCustomCell(null);
    setCustomItemTitle('');
  }

  function addCustomItem() {
    const normalizedTitle = customItemTitle.trim();

    if (!editingCustomCell || !normalizedTitle) {
      return;
    }

    updateCustomItems([
      ...customItems,
      {
        dayOfWeek: editingCustomCell.dayOfWeek,
        backgroundColor: customItemBackgroundColor,
        id: createCustomItemId(),
        rowKey: editingCustomCell.rowKey,
        title: normalizedTitle,
      },
    ]);
    closeCustomItemEditor();
  }

  function removeCustomItem(itemId: string) {
    updateCustomItems(customItems.filter((item) => item.id !== itemId));
  }

  return (
    <div className="flex flex-col gap-4">
      {displayWeekIndex || hiddenWeekendDays.length > 0 || expandedEmptyWeekendDays.length > 0 ? (
        <div className="workbench-weekly-timetable-toolbar">
          {displayWeekIndex ? (
            <div className="workbench-weekly-timetable-week-navigator">
              <div className="workbench-weekly-timetable-week-stepper">
                <Button
                  aria-label="上一周"
                  disabled={!canNavigatePreviousWeek || props.isWeekNavigationLoading}
                  icon={<LeftOutlined />}
                  size="small"
                  onClick={() => {
                    if (canNavigatePreviousWeek) {
                      props.onWeekChange?.(displayWeekIndex - 1);
                    }
                  }}
                />
                <span className="workbench-weekly-timetable-week-value">
                  第 {displayWeekIndex} 周
                </span>
                <Button
                  aria-label="下一周"
                  disabled={!canNavigateNextWeek || props.isWeekNavigationLoading}
                  icon={<RightOutlined />}
                  size="small"
                  onClick={() => {
                    if (canNavigateNextWeek) {
                      props.onWeekChange?.(displayWeekIndex + 1);
                    }
                  }}
                />
              </div>
              {isCurrentWeek ? (
                <span
                  aria-label="当前周"
                  className="workbench-weekly-timetable-current-week-dot"
                  title="当前周"
                />
              ) : null}
            </div>
          ) : (
            <span />
          )}
          {hiddenWeekendDays.length > 0 || expandedEmptyWeekendDays.length > 0 ? (
            <div className="workbench-weekly-timetable-weekend-controls">
              {hiddenWeekendDays.map((dayOfWeek) => (
                <Button
                  key={`show-weekend-${dayOfWeek}`}
                  size="small"
                  onClick={() => {
                    setExpandedWeekendDayOfWeeks((current) =>
                      current.includes(dayOfWeek) ? current : [...current, dayOfWeek],
                    );
                  }}
                >
                  显示{DAY_OF_WEEK_LABELS[dayOfWeek - 1]}
                </Button>
              ))}
              {expandedEmptyWeekendDays.map((dayOfWeek) => (
                <Button
                  key={`hide-weekend-${dayOfWeek}`}
                  size="small"
                  onClick={() => {
                    setExpandedWeekendDayOfWeeks((current) =>
                      current.filter((currentDayOfWeek) => currentDayOfWeek !== dayOfWeek),
                    );
                  }}
                >
                  隐藏{DAY_OF_WEEK_LABELS[dayOfWeek - 1]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="workbench-weekly-timetable-shell overflow-x-auto">
        <div
          ref={gridRef}
          className="workbench-weekly-timetable-grid"
          style={{
            gridTemplateColumns: `72px repeat(${visibleDayCount}, minmax(156px, 1fr))`,
            gridTemplateRows: `44px ${displayRows
              .map((row) => {
                if (row.kind === 'period') {
                  return customItemRowKeys.has(row.key)
                    ? 'minmax(96px, auto)'
                    : 'minmax(72px, auto)';
                }

                return customItemRowKeys.has(row.key) ? 'minmax(64px, auto)' : '44px';
              })
              .join(' ')}`,
            minWidth: 72 + visibleDayCount * 156,
          }}
        >
          <div className="workbench-weekly-timetable-header-cell workbench-weekly-timetable-header-corner">
            节次
          </div>

          {visibleDays.map((day, index) => {
            const dayHeaderSupplement = props.getDayHeaderSupplement?.(day.dayOfWeek);

            return (
              <div
                key={day.dayOfWeek}
                className="workbench-weekly-timetable-header-cell"
                data-workbench-weekly-timetable-day={day.dayOfWeek}
                style={{ gridColumn: index + 2, gridRow: 1 }}
              >
                <span>{day.label}</span>
                {dayHeaderSupplement ? (
                  <span className="workbench-weekly-timetable-header-date">
                    {dayHeaderSupplement}
                  </span>
                ) : null}
              </div>
            );
          })}

          {displayRows.map((row, rowIndex) => {
            const label = row.kind === 'period' ? `第 ${row.period} 节` : row.label;
            const className =
              row.kind === 'period'
                ? 'workbench-weekly-timetable-period-cell'
                : 'workbench-weekly-timetable-period-cell workbench-weekly-timetable-break-cell';

            return (
              <div
                key={row.key}
                className={className}
                data-workbench-weekly-timetable-row={row.key}
                style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
              >
                {label}
              </div>
            );
          })}

          {displayRows.flatMap((row, rowIndex) =>
            visibleDays.map((day, dayIndex) => {
              const isWeekendColumn = props.viewKey === 'weekly' && day.dayOfWeek >= 6;
              const isBreakRow = row.kind === 'break';
              const isOccupied = isCellOccupied(day.dayOfWeek, row);
              const cellCustomItems = resolveCellCustomItems(day.dayOfWeek, row.key);

              return (
                <div
                  key={`slot-${day.dayOfWeek}-${row.key}`}
                  className={`workbench-weekly-timetable-base-cell ${
                    isWeekendColumn ? 'workbench-weekly-timetable-weekend-cell' : ''
                  } ${isBreakRow ? 'workbench-weekly-timetable-break-cell' : ''} ${
                    !isOccupied ? 'workbench-weekly-timetable-custom-cell' : ''
                  }`}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: rowIndex + 2,
                  }}
                >
                  {!isOccupied ? (
                    <div className="workbench-weekly-timetable-custom-cell-content">
                      {cellCustomItems.length > 0 ? (
                        <div className="workbench-weekly-timetable-custom-items">
                          {cellCustomItems.map((item) => (
                            <div
                              className="workbench-weekly-timetable-custom-item"
                              key={item.id}
                              style={
                                item.backgroundColor
                                  ? {
                                      backgroundColor: item.backgroundColor,
                                      borderColor: item.backgroundColor,
                                    }
                                  : undefined
                              }
                            >
                              <span>{item.title}</span>
                              <button
                                aria-label={`删除事项 ${item.title}`}
                                className="workbench-weekly-timetable-custom-item-remove"
                                type="button"
                                onClick={() => removeCustomItem(item.id)}
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <button
                        aria-label={`添加${day.label}${row.kind === 'period' ? `第 ${row.period} 节` : row.label}事项`}
                        className="workbench-weekly-timetable-custom-add"
                        title="添加自定义事项"
                        type="button"
                        onClick={() => openCustomItemEditor(day, row)}
                      >
                        <PlusOutlined />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }),
          )}

          {visibleSlotPlacements.map((group) => (
            <div
              key={group.key}
              className={`workbench-weekly-timetable-slot-group ${
                group.items.length > 1 ? 'workbench-weekly-timetable-slot-group-stacked' : ''
              }`}
              style={
                {
                  gridColumn: gridColumnByDayOfWeek.get(group.dayOfWeek) ?? group.dayOfWeek + 1,
                  gridRow: `${gridRowByPeriod.get(group.periodStart) ?? group.periodStart + 1} / ${
                    (gridRowByPeriod.get(Math.min(group.periodEnd, periodCount)) ??
                      Math.min(group.periodEnd, periodCount) + 1) + 1
                  }`,
                  insetInlineStart:
                    group.laneCount > 1
                      ? `calc(${(group.laneIndex * 100) / group.laneCount}% + 4px)`
                      : undefined,
                  width: group.laneCount > 1 ? `calc(${100 / group.laneCount}% - 8px)` : undefined,
                  '--workbench-weekly-timetable-slot-layer': String(
                    group.laneCount > 1 ? group.laneIndex + 1 : 1,
                  ),
                } as TimetableSlotGroupStyle
              }
            >
              {group.items.map((item) => (
                <div
                  className="workbench-weekly-timetable-slot-group-item"
                  key={props.getEntryKey(item)}
                >
                  {props.renderEntry(item)}
                </div>
              ))}
            </div>
          ))}
          {props.showCurrentTimeIndicator && currentTimeIndicatorStyle ? (
            <div
              aria-hidden="true"
              className="workbench-weekly-timetable-now-line"
              style={{
                left: currentTimeIndicatorStyle.left,
                top: currentTimeIndicatorStyle.top,
                width: currentTimeIndicatorStyle.width,
              }}
            />
          ) : null}
        </div>
      </div>
      <Modal
        cancelText="取消"
        okButtonProps={{ disabled: !customItemTitle.trim() }}
        okText="添加"
        open={editingCustomCell !== null}
        title={
          editingCustomCell
            ? `添加事项 · ${editingCustomCell.dayLabel} ${editingCustomCell.rowLabel}`
            : '添加事项'
        }
        onCancel={closeCustomItemEditor}
        onOk={addCustomItem}
      >
        <div className="workbench-weekly-timetable-custom-editor">
          <Input
            autoFocus
            maxLength={40}
            placeholder="输入事项名称"
            showCount
            value={customItemTitle}
            onChange={(event) => setCustomItemTitle(event.target.value)}
            onPressEnter={addCustomItem}
          />
          <div className="workbench-weekly-timetable-custom-editor-color">
            <span>背景颜色</span>
            <div className="workbench-weekly-timetable-custom-color-options">
              {CUSTOM_ITEM_BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  aria-label={option.label}
                  aria-pressed={customItemBackgroundColor === option.value}
                  className="workbench-weekly-timetable-custom-color-option"
                  style={{ backgroundColor: option.value }}
                  title={option.label}
                  type="button"
                  onClick={() => setCustomItemBackgroundColor(option.value)}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function WorkbenchWeeklyTimetableGrid(props: {
  currentWeekIndex?: number | null;
  emptyDescription: string;
  isWeekNavigationLoading?: boolean;
  items: AcademicTimetableItem[];
  maxWeekIndex?: number | null;
  selectedWeekIndex?: number | null;
  showCurrentTimeIndicator?: boolean;
  onWeekChange?: (weekIndex: number) => void;
}) {
  const rawDateByDayOfWeek = useMemo(() => buildWeeklyDateByDayOfWeek(props.items), [props.items]);
  const dateByDayOfWeek = useMemo(() => {
    const nextDateByDayOfWeek = new Map<number, string>();

    rawDateByDayOfWeek.forEach((date, dayOfWeek) => {
      nextDateByDayOfWeek.set(dayOfWeek, formatHeaderDate(date));
    });

    return nextDateByDayOfWeek;
  }, [rawDateByDayOfWeek]);

  return (
    <BaseTimetableGrid
      currentWeekIndex={props.currentWeekIndex}
      emptyDescription={props.emptyDescription}
      getDayDate={(dayOfWeek) => rawDateByDayOfWeek.get(dayOfWeek) ?? null}
      getEntryKey={getWeeklyTimetableEntryKey}
      getTieBreaker={getWeeklyTimetableItemTieBreaker}
      getDayHeaderSupplement={(dayOfWeek) => dateByDayOfWeek.get(dayOfWeek) ?? null}
      isWeekNavigationLoading={props.isWeekNavigationLoading}
      items={props.items}
      maxWeekIndex={props.maxWeekIndex}
      onWeekChange={props.onWeekChange}
      renderEntry={(item) => {
        const courseCategoryMeta = resolveCourseCategoryMeta(item.courseCategory);
        const courseCategoryAccentClassName = courseCategoryMeta
          ? toWorkbenchTimetableClassName(courseCategoryMeta.accentClassName)
          : '';
        const courseCategorySurfaceClassName = courseCategoryMeta
          ? toWorkbenchTimetableClassName(courseCategoryMeta.surfaceClassName)
          : '';
        const statusLabel = resolveOccurrenceStatusLabel(item);

        return (
          <article
            className={[
              'workbench-weekly-timetable-entry',
              courseCategorySurfaceClassName,
              item.isEffective ? '' : 'workbench-weekly-timetable-entry-inactive',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="workbench-weekly-timetable-entry-main-group">
              <div className="workbench-weekly-timetable-entry-title-wrap">
                <p
                  className={[
                    'workbench-weekly-timetable-entry-title',
                    courseCategoryAccentClassName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.courseName}
                </p>
              </div>
            </div>
            <div className="workbench-weekly-timetable-entry-center-group">
              <p className="workbench-weekly-timetable-entry-class">{item.teachingClassName}</p>
            </div>
            <div className="workbench-weekly-timetable-entry-footer-group">
              <p className="workbench-weekly-timetable-entry-meta">
                {item.classroomName?.trim() || '待定教室'}
              </p>
            </div>
            {statusLabel ? (
              <div className="workbench-weekly-timetable-entry-status-row">
                <span className={resolveOccurrenceStatusClassName(item)}>{statusLabel}</span>
              </div>
            ) : null}
          </article>
        );
      }}
      selectedWeekIndex={props.selectedWeekIndex}
      showCurrentTimeIndicator={props.showCurrentTimeIndicator}
      viewKey="weekly"
    />
  );
}
