import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Flex,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  theme,
  Timeline,
  Typography,
} from 'antd';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

import { ResponsiveGrid, useWidthBand } from '@/shared/ui/responsive-layout';

import {
  buildTeachingPlanProjection,
  formatTeachingPlanBusinessDate,
  formatTeachingPlanCalcEffect,
  formatTeachingPlanWeekday,
  resolveCourseCategoryPresentation,
  type TeachingPlanCourseProjection,
} from '../application/teaching-plan-projection';
import {
  requestManagedTeachingPlan,
  requestManagedTeachingPlanTeacherOptions,
  requestMyTeachingPlan,
  requestMyTeachingPlanAcademicSemesters,
} from '../infrastructure/api';
import type {
  MyTeachingPlanLabLoaderData,
  TeachingPlanOccurrence,
  TeachingPlanOccurrenceEnvelope,
  TeachingPlanTeacherOption,
} from '../types';

type AsyncState<T> = {
  data: T;
  error: string | null;
  loading: boolean;
};

const EMPTY_SEMESTERS_STATE: AsyncState<AcademicSemesterRecord[]> = {
  data: [],
  error: null,
  loading: true,
};

const EMPTY_PLAN_STATE: AsyncState<TeachingPlanOccurrenceEnvelope | null> = {
  data: null,
  error: null,
  loading: false,
};

const EMPTY_TEACHER_OPTIONS_STATE: AsyncState<TeachingPlanTeacherOption[]> = {
  data: [],
  error: null,
  loading: false,
};

const WORKSPACE_WIDTH_RULES = [{ max: 767, value: 'compact' }] as const;

const CATEGORY_STYLES = {
  integrated: {
    background: 'var(--course-category-integrated-bg)',
    color: 'var(--course-category-integrated-color)',
  },
  neutral: undefined,
  practice: {
    background: 'var(--course-category-practice-bg)',
    color: 'var(--course-category-practice-color)',
  },
  theory: {
    background: 'var(--course-category-theory-bg)',
    color: 'var(--course-category-theory-color)',
  },
} as const;

export function MyTeachingPlanWorkspace({ canManage, currentStaff }: MyTeachingPlanLabLoaderData) {
  const { token } = theme.useToken();
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const { band } = useWidthBand(workspaceRef, [...WORKSPACE_WIDTH_RULES], 'regular');
  const isCompact = band === 'compact';
  const [semestersState, setSemestersState] =
    useState<AsyncState<AcademicSemesterRecord[]>>(EMPTY_SEMESTERS_STATE);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [teacherOptionsState, setTeacherOptionsState] = useState<
    AsyncState<TeachingPlanTeacherOption[]>
  >(EMPTY_TEACHER_OPTIONS_STATE);
  const [teacherKeyword, setTeacherKeyword] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    canManage ? (currentStaff?.staffId ?? null) : null,
  );
  const [planState, setPlanState] =
    useState<AsyncState<TeachingPlanOccurrenceEnvelope | null>>(EMPTY_PLAN_STATE);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;

    setSemestersState(EMPTY_SEMESTERS_STATE);
    void requestMyTeachingPlanAcademicSemesters()
      .then((records) => {
        if (!isActive) {
          return;
        }

        const sortedRecords = sortAcademicSemestersForDisplay(records);
        setSemestersState({ data: sortedRecords, error: null, loading: false });
        setSelectedSemesterId((current) => pickAcademicSemesterId(sortedRecords, current));
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setSemestersState({ data: [], error: getErrorMessage(error), loading: false });
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!canManage || selectedSemesterId === null) {
      setTeacherOptionsState(EMPTY_TEACHER_OPTIONS_STATE);
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(() => {
      setTeacherOptionsState((current) => ({ ...current, error: null, loading: true }));
      void requestManagedTeachingPlanTeacherOptions({
        keyword: teacherKeyword,
        semesterId: selectedSemesterId,
      })
        .then((items) => {
          if (!isActive) {
            return;
          }

          setTeacherOptionsState((current) => ({
            data: mergeTeacherOptions(
              items,
              currentStaff,
              current.data.find((option) => option.staffId === selectedStaffId),
            ),
            error: null,
            loading: false,
          }));
        })
        .catch((error: unknown) => {
          if (!isActive) {
            return;
          }

          setTeacherOptionsState((current) => ({
            ...current,
            error: getErrorMessage(error),
            loading: false,
          }));
        });
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [canManage, currentStaff, selectedSemesterId, selectedStaffId, teacherKeyword]);

  useEffect(() => {
    if (selectedSemesterId === null || (canManage && !selectedStaffId)) {
      setPlanState(EMPTY_PLAN_STATE);
      return;
    }

    let isActive = true;
    setPlanState({ data: null, error: null, loading: true });
    const request = canManage
      ? requestManagedTeachingPlan({
          semesterId: selectedSemesterId,
          staffId: selectedStaffId as string,
        })
      : requestMyTeachingPlan(selectedSemesterId);

    void request
      .then((data) => {
        if (isActive) {
          setPlanState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPlanState({ data: null, error: getErrorMessage(error), loading: false });
        }
      });

    return () => {
      isActive = false;
    };
  }, [canManage, reloadKey, selectedSemesterId, selectedStaffId]);

  const projection = useMemo(
    () => buildTeachingPlanProjection(planState.data?.items ?? []),
    [planState.data?.items],
  );

  useEffect(() => {
    setSelectedScheduleId((current) => {
      if (current !== null && projection.courses.some((course) => course.scheduleId === current)) {
        return current;
      }

      return projection.courses[0]?.scheduleId ?? null;
    });
  }, [projection.courses]);

  const selectedSemester = semestersState.data.find(
    (semester) => semester.id === selectedSemesterId,
  );
  const selectedTeacher = resolveSelectedTeacher({
    currentStaff,
    options: teacherOptionsState.data,
    selectedStaffId,
  });
  const viewerName = canManage ? selectedTeacher?.staffName : currentStaff?.displayName;

  return (
    <div ref={workspaceRef} className="flex flex-col gap-4">
      <Card>
        <Flex gap="middle" justify="space-between" vertical={isCompact}>
          <ResponsiveGrid
            className="min-w-0 flex-1 gap-4"
            columns={{ compact: 1, regular: canManage ? 2 : 1 }}
          >
            <FilterField label="学期">
              <AcademicSemesterSelect
                allowClear={false}
                disabled={semestersState.loading}
                loading={semestersState.loading}
                records={semestersState.data}
                value={selectedSemesterId ?? undefined}
                onChange={(semesterId) => {
                  setSelectedSemesterId(semesterId);
                  setSelectedScheduleId(null);
                  setSelectedStaffId(canManage ? (currentStaff?.staffId ?? null) : null);
                  setTeacherKeyword('');
                }}
              />
            </FilterField>

            {canManage ? (
              <FilterField label="教师">
                <Select
                  allowClear
                  filterOption={false}
                  loading={teacherOptionsState.loading}
                  notFoundContent={
                    teacherOptionsState.loading
                      ? '正在查找教师…'
                      : teacherOptionsState.error
                        ? '教师列表加载失败'
                        : '没有匹配的教师'
                  }
                  options={teacherOptionsState.data.map((teacher) => ({
                    label: teacher.staffName,
                    title: `${teacher.staffName}（${teacher.staffId}）`,
                    value: teacher.staffId,
                  }))}
                  optionFilterProp="label"
                  placeholder="输入姓名或工号选择教师"
                  popupMatchSelectWidth={false}
                  showSearch
                  value={selectedStaffId ?? undefined}
                  onChange={(staffId) => {
                    setSelectedStaffId(staffId ?? null);
                    setSelectedScheduleId(null);
                  }}
                  onSearch={setTeacherKeyword}
                />
              </FilterField>
            ) : null}
          </ResponsiveGrid>

          <Button
            disabled={selectedSemesterId === null || (canManage && !selectedStaffId)}
            icon={<ReloadOutlined />}
            loading={planState.loading}
            onClick={() => setReloadKey((current) => current + 1)}
          >
            刷新
          </Button>
        </Flex>

        {semestersState.error ? (
          <div className="mt-4">
            <Alert showIcon title={semestersState.error} type="error" />
          </div>
        ) : null}
        {teacherOptionsState.error ? (
          <div className="mt-4">
            <Alert showIcon title={teacherOptionsState.error} type="warning" />
          </div>
        ) : null}
      </Card>

      {selectedSemesterId === null ? (
        <Card>
          <Empty description={semestersState.loading ? '正在加载当前学期…' : '没有可查看的学期'} />
        </Card>
      ) : canManage && !selectedStaffId ? (
        <Card>
          <Empty description="先选择一位教师，再查看该教师的课程与具体上课日期" />
        </Card>
      ) : planState.loading ? (
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : planState.error ? (
        <Alert
          action={
            <Button size="small" onClick={() => setReloadKey((current) => current + 1)}>
              重试
            </Button>
          }
          description="学期、人员范围或真源计算状态可能已经变化。"
          showIcon
          title={planState.error}
          type="error"
        />
      ) : planState.data && !planState.data.isValid ? (
        <Alert
          description={planState.data.invalidReason ?? '当前学期尚未形成可用的计划课次真源。'}
          showIcon
          title="教学计划暂不可用"
          type="error"
        />
      ) : planState.data ? (
        <>
          {!planState.data.isComplete ? (
            <Alert
              description={planState.data.truncationReason ?? '部分日期可能尚未完成投影。'}
              showIcon
              title="当前结果不完整"
              type="warning"
            />
          ) : null}

          <ResponsiveGrid className="gap-4" columns={{ compact: 1, regular: 3 }}>
            <MetricCard
              hint={selectedSemester?.name ?? '所选学期'}
              title="课程"
              value={projection.courses.length}
            />
            <MetricCard hint="去重后的有效上课日" title="上课日期" value={projection.dateCount} />
            <MetricCard
              hint="按节次保留课次片段"
              title="有效课次"
              value={projection.effectiveOccurrenceCount}
            />
          </ResponsiveGrid>

          {projection.courses.length ? (
            <Card
              extra={
                <Space wrap size="small">
                  {viewerName ? <Tag icon={<UserOutlined />}>{viewerName}</Tag> : null}
                  <Tag color="blue">计划真源</Tag>
                </Space>
              }
              title="课程日期投影"
            >
              <Tabs
                activeKey={selectedScheduleId === null ? undefined : String(selectedScheduleId)}
                items={projection.courses.map((course) => ({
                  children: <CoursePlan course={course} isCompact={isCompact} />,
                  key: String(course.scheduleId),
                  label: <CourseTabLabel course={course} />,
                }))}
                tabBarGutter={token.marginXS}
                tabPlacement={isCompact ? 'top' : 'start'}
                onChange={(key) => setSelectedScheduleId(Number(key))}
              />
            </Card>
          ) : (
            <Card>
              <Empty description="所选教师在该学期没有计划课次" />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function FilterField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Typography.Text type="secondary">{label}</Typography.Text>
      {children}
    </div>
  );
}

function MetricCard({ hint, title, value }: { hint: string; title: string; value: number }) {
  return (
    <Card size="small">
      <Statistic title={title} value={value} />
      <Typography.Text type="secondary">{hint}</Typography.Text>
    </Card>
  );
}

function CourseTabLabel({ course }: { course: TeachingPlanCourseProjection }) {
  const category = resolveCourseCategoryPresentation(course.courseCategory);

  return (
    <div className="flex min-w-0 flex-col gap-1 py-1 text-left">
      <Space size="small" wrap>
        <Typography.Text strong>{course.courseName}</Typography.Text>
        <Tag style={CATEGORY_STYLES[category.kind]} variant="filled">
          {category.label}
        </Tag>
      </Space>
      <Typography.Text type="secondary">
        {course.teachingClassName} · {course.dateCount} 天
      </Typography.Text>
    </div>
  );
}

function CoursePlan({
  course,
  isCompact,
}: {
  course: TeachingPlanCourseProjection;
  isCompact: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Flex gap="small" justify="space-between" vertical={isCompact}>
        <Space orientation="vertical" size={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {course.courseName}
          </Typography.Title>
          <Typography.Text type="secondary">{course.teachingClassName}</Typography.Text>
        </Space>
        <Space wrap>
          <Tag color="blue">{course.dateCount} 个上课日</Tag>
          <Tag>{course.effectiveOccurrenceCount} 个课次片段</Tag>
        </Space>
      </Flex>

      {course.months.map((month) => (
        <section key={month.key} className="flex flex-col gap-3">
          <Flex align="center" gap="small">
            <CalendarOutlined />
            <Typography.Title level={5} style={{ margin: 0 }}>
              {month.label}
            </Typography.Title>
            <Typography.Text type="secondary">{month.dates.length} 天</Typography.Text>
          </Flex>
          <Timeline
            items={month.dates.map((dateGroup) => ({
              content: (
                <Card
                  size="small"
                  title={`${formatTeachingPlanBusinessDate(dateGroup.date)} · ${formatTeachingPlanWeekday(dateGroup.physicalDayOfWeek)}`}
                >
                  <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      教学周第 {dateGroup.weekIndex} 周
                    </Typography.Text>
                    {dateGroup.occurrences.map((occurrence) => (
                      <OccurrenceRow key={occurrence.slotId} occurrence={occurrence} />
                    ))}
                  </Space>
                </Card>
              ),
              color: 'blue',
            }))}
          />
        </section>
      ))}

      {course.adjustmentOccurrences.length ? (
        <Collapse
          ghost={isCompact}
          items={[
            {
              children: (
                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                  {course.adjustmentOccurrences.map((occurrence) => (
                    <AdjustmentRow key={occurrence.slotId} occurrence={occurrence} />
                  ))}
                </Space>
              ),
              key: 'adjustments',
              label: `停课与调出记录（${course.adjustmentOccurrences.length}）`,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

function OccurrenceRow({ occurrence }: { occurrence: TeachingPlanOccurrence }) {
  const hasLogicalDayChange = occurrence.logicalDayOfWeek !== occurrence.physicalDayOfWeek;

  return (
    <Flex align="center" gap="small" justify="space-between" wrap>
      <Space wrap size="small">
        <Tag icon={<ClockCircleOutlined />}>
          第 {occurrence.periodStart}
          {occurrence.periodEnd === occurrence.periodStart ? '' : `–${occurrence.periodEnd}`} 节
        </Tag>
        {occurrence.classroomName ? (
          <Tag icon={<EnvironmentOutlined />}>{occurrence.classroomName}</Tag>
        ) : (
          <Tag>教室待定</Tag>
        )}
        {occurrence.calcEffect !== 'NORMAL' ? (
          <Tag color={occurrence.calcEffect === 'MAKEUP' ? 'green' : 'purple'}>
            {formatTeachingPlanCalcEffect(occurrence.calcEffect)}
          </Tag>
        ) : null}
      </Space>
      {hasLogicalDayChange ? (
        <Typography.Text type="secondary">
          原课表 {formatTeachingPlanWeekday(occurrence.logicalDayOfWeek)}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

function AdjustmentRow({ occurrence }: { occurrence: TeachingPlanOccurrence }) {
  return (
    <Card size="small">
      <Flex gap="small" justify="space-between" wrap>
        <Space wrap size="small">
          <Tag color={occurrence.calcEffect === 'CANCEL' ? 'red' : 'orange'}>
            {formatTeachingPlanCalcEffect(occurrence.calcEffect)}
          </Tag>
          <Typography.Text>
            {formatTeachingPlanBusinessDate(occurrence.date)} ·{' '}
            {formatTeachingPlanWeekday(occurrence.physicalDayOfWeek)}
          </Typography.Text>
          <Typography.Text type="secondary">
            第 {occurrence.periodStart}
            {occurrence.periodEnd === occurrence.periodStart ? '' : `–${occurrence.periodEnd}`} 节
          </Typography.Text>
        </Space>
        {occurrence.classroomName ? (
          <Typography.Text type="secondary">{occurrence.classroomName}</Typography.Text>
        ) : null}
      </Flex>
    </Card>
  );
}

function mergeTeacherOptions(
  options: readonly TeachingPlanTeacherOption[],
  currentStaff: MyTeachingPlanLabLoaderData['currentStaff'],
  selectedTeacher?: TeachingPlanTeacherOption,
) {
  const merged = new Map(options.map((option) => [option.staffId, option]));

  if (selectedTeacher) {
    merged.set(selectedTeacher.staffId, selectedTeacher);
  }

  if (currentStaff) {
    merged.set(currentStaff.staffId, {
      staffId: currentStaff.staffId,
      staffName: currentStaff.displayName,
    });
  }

  return Array.from(merged.values());
}

function resolveSelectedTeacher(input: {
  currentStaff: MyTeachingPlanLabLoaderData['currentStaff'];
  options: readonly TeachingPlanTeacherOption[];
  selectedStaffId: string | null;
}) {
  if (!input.selectedStaffId) {
    return null;
  }

  return (
    input.options.find((option) => option.staffId === input.selectedStaffId) ??
    (input.currentStaff?.staffId === input.selectedStaffId
      ? { staffId: input.currentStaff.staffId, staffName: input.currentStaff.displayName }
      : null)
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。';
}
