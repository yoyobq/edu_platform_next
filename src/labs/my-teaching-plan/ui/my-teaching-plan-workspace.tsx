import { useEffect, useMemo, useRef, useState } from 'react';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  theme,
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
  TeachingPlanOccurrenceEnvelope,
  TeachingPlanTeacherOption,
} from '../types';

import { TeachingPlanSheet } from './teaching-plan-sheet';

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

export function MyTeachingPlanWorkspace({
  canManage,
  currentAccountId,
  currentStaff,
}: MyTeachingPlanLabLoaderData) {
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
  const draftStaffId =
    selectedStaffId ?? currentStaff?.staffId ?? planState.data?.items[0]?.staffId ?? 'unknown';
  const draftTeacherName = viewerName ?? planState.data?.items[0]?.staffName ?? '教师';

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
              title="课程教学计划"
            >
              <Tabs
                activeKey={selectedScheduleId === null ? undefined : String(selectedScheduleId)}
                items={projection.courses.map((course) => ({
                  children: (
                    <TeachingPlanSheet
                      course={course}
                      currentAccountId={currentAccountId}
                      isCompact={isCompact}
                      semesterId={selectedSemesterId}
                      semesterName={selectedSemester?.name ?? `学期 ${selectedSemesterId}`}
                      targetStaffId={draftStaffId}
                      teacherName={draftTeacherName}
                    />
                  ),
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
