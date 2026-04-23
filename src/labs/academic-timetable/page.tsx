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
  type AcademicTimetableItem,
  type AcademicTimetableQueryFilters,
  requestAcademicSemesterTimetableItems,
  requestAcademicWeeklyTimetableItems,
} from './api';
import { academicTimetableLabMeta } from './meta';

import './page.css';

type AcademicTimetableLabLoaderData = {
  defaultStaffId?: string | null;
  viewerKind?: 'authenticated' | 'internal';
} | null;

type TimetableViewKey = 'semester' | 'weekly';

type TimetableFilters = {
  limit: number;
  staffId: string;
  sstsCourseId: string;
  sstsTeachingClassId: string;
  weekIndex: number;
};

type TimetableSlotGroup = {
  dayOfWeek: number;
  items: AcademicTimetableItem[];
  key: string;
  periodEnd: number;
  periodStart: number;
};

const DAY_OF_WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MIN_PERIOD_COUNT = 12;
const VIEW_LABELS: Record<TimetableViewKey, string> = {
  semester: '学期总览',
  weekly: '单周课表',
};
const WEEK_TYPE_LABELS = {
  ALL: '全周',
  EVEN: '双周',
  ODD: '单周',
} as const;
const REQUIRED_ID_FILTER_MESSAGE =
  '请至少填写教师 ID、上游教学班 ID、上游课程 ID 之一，再发起课表查询。';
const DEFAULT_FILTERS: TimetableFilters = {
  limit: 100,
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
    limit: filters.limit,
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

function sortTimetableItems(items: AcademicTimetableItem[]) {
  return [...items].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }

    if (left.periodStart !== right.periodStart) {
      return left.periodStart - right.periodStart;
    }

    if (left.periodEnd !== right.periodEnd) {
      return left.periodEnd - right.periodEnd;
    }

    return `${left.courseName}-${left.teachingClassName}`.localeCompare(
      `${right.courseName}-${right.teachingClassName}`,
      'zh-CN',
    );
  });
}

function groupTimetableItems(items: AcademicTimetableItem[]) {
  const groups = new Map<string, TimetableSlotGroup>();

  for (const item of sortTimetableItems(items)) {
    const key = `${item.dayOfWeek}:${item.periodStart}-${item.periodEnd}`;
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.items.push(item);
      continue;
    }

    groups.set(key, {
      dayOfWeek: item.dayOfWeek,
      items: [item],
      key,
      periodEnd: item.periodEnd,
      periodStart: item.periodStart,
    });
  }

  return [...groups.values()];
}

function resolvePeriodCount(items: AcademicTimetableItem[]) {
  const maxPeriodEnd = items.reduce(
    (currentMax, item) => Math.max(currentMax, item.periodEnd),
    MIN_PERIOD_COUNT,
  );

  return Math.max(MIN_PERIOD_COUNT, maxPeriodEnd);
}

function formatWeekScope(item: AcademicTimetableItem) {
  const weekPattern = item.weekPattern?.trim();
  const weekTypeLabel = WEEK_TYPE_LABELS[item.weekType];

  if (weekPattern) {
    return `${weekPattern} · ${weekTypeLabel}`;
  }

  return weekTypeLabel;
}

function formatCoefficient(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TimetableGrid(props: {
  emptyDescription: string;
  items: AcademicTimetableItem[];
  showWeekMeta: boolean;
  viewKey: TimetableViewKey;
}) {
  const slotGroups = useMemo(() => groupTimetableItems(props.items), [props.items]);
  const periodCount = useMemo(() => resolvePeriodCount(props.items), [props.items]);

  if (props.items.length === 0) {
    return <Empty description={props.emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Tag color="blue">课表项：{props.items.length}</Tag>
        <Tag color="cyan">占用格位：{slotGroups.length}</Tag>
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

          {slotGroups.map((group) => (
            <div
              key={group.key}
              className="academic-timetable-slot-group"
              style={{
                gridColumn: group.dayOfWeek + 1,
                gridRow: `${group.periodStart + 1} / span ${group.periodEnd - group.periodStart + 1}`,
              }}
            >
              {group.items.map((item) => {
                const coefficient = formatCoefficient(item.coefficient);

                return (
                  <article
                    key={`${item.scheduleId}-${item.slotId}`}
                    className="academic-timetable-entry"
                  >
                    <p className="academic-timetable-entry-title">{item.courseName}</p>
                    <p className="academic-timetable-entry-subtitle">{item.teachingClassName}</p>
                    <p className="academic-timetable-entry-meta">
                      {item.classroomName?.trim() || '待定教室'}
                      {' · '}
                      {item.staffName?.trim() || '待定教师'}
                    </p>
                    {props.showWeekMeta ? (
                      <p className="academic-timetable-entry-week">{formatWeekScope(item)}</p>
                    ) : null}
                    <p className="academic-timetable-entry-foot">
                      {item.courseCategory?.trim() || '未标注课程类别'}
                      {coefficient ? ` · 系数 ${coefficient}` : ''}
                    </p>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AcademicTimetableLabPage() {
  const loaderData = useLoaderData() as AcademicTimetableLabLoaderData;
  const loaderDefaultStaffId = loaderData?.defaultStaffId?.trim() || '';
  const roleLabel = loaderData?.viewerKind === 'internal' ? '内部用户' : '登录用户';

  const [activeView, setActiveView] = useState<TimetableViewKey>('semester');
  const [filters, setFilters] = useState<TimetableFilters>({
    ...DEFAULT_FILTERS,
    staffId: loaderDefaultStaffId,
  });
  const [semesterError, setSemesterError] = useState<string | null>(null);
  const [semesterItems, setSemesterItems] = useState<AcademicTimetableItem[]>([]);
  const [semesterItemsError, setSemesterItemsError] = useState<string | null>(null);
  const [semesterItemsLoading, setSemesterItemsLoading] = useState(false);
  const [semesters, setSemesters] = useState<AcademicSemesterRecord[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [weeklyItems, setWeeklyItems] = useState<AcademicTimetableItem[]>([]);
  const [weeklyItemsError, setWeeklyItemsError] = useState<string | null>(null);
  const [weeklyItemsLoading, setWeeklyItemsLoading] = useState(false);
  const latestFiltersRef = useRef(filters);

  const hasAnyQueryId = useMemo(() => hasAtLeastOneQueryId(filters), [filters]);

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

  const loadSemesterItems = useCallback(
    async (semesterId: number, currentFilters: TimetableFilters) => {
      if (!hasAtLeastOneQueryId(currentFilters)) {
        return;
      }

      setSemesterItemsLoading(true);
      setSemesterItemsError(null);

      try {
        const result = await requestAcademicSemesterTimetableItems(
          buildSharedQueryFilters(semesterId, currentFilters),
        );

        setSemesterItems(result);
      } catch (error) {
        setSemesterItemsError(error instanceof Error ? error.message : '暂时无法加载学期课表。');
        setSemesterItems([]);
      } finally {
        setSemesterItemsLoading(false);
      }
    },
    [],
  );

  const loadWeeklyItems = useCallback(
    async (semesterId: number, currentFilters: TimetableFilters) => {
      if (!hasAtLeastOneQueryId(currentFilters)) {
        return;
      }

      setWeeklyItemsLoading(true);
      setWeeklyItemsError(null);

      try {
        const result = await requestAcademicWeeklyTimetableItems({
          ...buildSharedQueryFilters(semesterId, currentFilters),
          weekIndex: currentFilters.weekIndex,
        });

        setWeeklyItems(result);
      } catch (error) {
        setWeeklyItemsError(error instanceof Error ? error.message : '暂时无法加载单周课表。');
        setWeeklyItems([]);
      } finally {
        setWeeklyItemsLoading(false);
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
      setSemesterItems([]);
      setWeeklyItems([]);
      return;
    }

    void loadSemesterItems(selectedSemesterId, latestFiltersRef.current);
    setWeeklyItems([]);
    setWeeklyItemsError(null);
  }, [loadSemesterItems, selectedSemesterId]);

  function renderSemesterSelector() {
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

          {activeView === 'weekly' ? (
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
          ) : null}

          <div className="w-32">
            <Typography.Text strong>limit</Typography.Text>
            <InputNumber
              style={{ marginTop: 8, width: '100%' }}
              min={1}
              max={500}
              value={filters.limit}
              onChange={(value) => {
                setFilters((current) => ({
                  ...current,
                  limit: typeof value === 'number' ? value : 100,
                }));
              }}
            />
          </div>

          <div className="flex min-w-32 items-end">
            <Button
              block
              type="primary"
              loading={activeView === 'semester' ? semesterItemsLoading : weeklyItemsLoading}
              disabled={selectedSemesterId === null || !hasAnyQueryId}
              onClick={() => {
                if (selectedSemesterId === null) {
                  return;
                }

                if (activeView === 'semester') {
                  void loadSemesterItems(selectedSemesterId, filters);
                  return;
                }

                void loadWeeklyItems(selectedSemesterId, filters);
              }}
            >
              查询{VIEW_LABELS[activeView]}
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

  function renderSemesterPanel() {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          showIcon
          type="info"
          title="学期总览直接读取 listAcademicSemesterTimetableItems，前端只按星期和节次排版，不再 join 两张表。"
        />
        {renderSemesterSelector()}
        {semesterItemsError ? <Alert showIcon title={semesterItemsError} type="error" /> : null}
        {semesterItemsLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <TimetableGrid
            emptyDescription="当前筛选下没有学期课表项"
            items={semesterItems}
            showWeekMeta
            viewKey="semester"
          />
        )}
      </div>
    );
  }

  function renderWeeklyPanel() {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          showIcon
          type="info"
          title="单周课表读取 listAcademicWeeklyTimetableItems；接口已经按周命中过滤，本页不解析 weekPattern 判断是否上课。"
        />
        {renderSemesterSelector()}
        {weeklyItemsError ? <Alert showIcon title={weeklyItemsError} type="error" /> : null}
        {weeklyItemsLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <TimetableGrid
            emptyDescription="当前教学周没有命中的课表项"
            items={weeklyItems}
            showWeekMeta={false}
            viewKey="weekly"
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
            后端返回的是可直接渲染的扁平课表项列表：学期视图保留原始 weekPattern 与
            weekType，单周视图只展示该周实际命中的课程。
          </Typography.Paragraph>
        </div>
      </Card>

      <Card>
        <Tabs
          activeKey={activeView}
          items={[
            {
              key: 'semester',
              label: '学期总览',
              children: renderSemesterPanel(),
            },
            {
              key: 'weekly',
              label: '单周课表',
              children: renderWeeklyPanel(),
            },
          ]}
          onChange={(value) => setActiveView(value as TimetableViewKey)}
        />
      </Card>
    </div>
  );
}
