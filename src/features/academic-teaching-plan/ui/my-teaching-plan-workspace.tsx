// src/features/academic-teaching-plan/ui/my-teaching-plan-workspace.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeftOutlined, RightOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Space, Tabs, Tag, Typography } from 'antd';

import {
  type AcademicSemesterRecord,
  AcademicSemesterSelect,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';
import {
  resolveUpstreamErrorMessage,
  StaffDirectoryTeacherAutoComplete,
  type StoredUpstreamSession,
  UpstreamIdentityBar,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
  useVerifiedUpstreamIdentity,
} from '@/entities/upstream-session';

import {
  CompactQueryBar,
  CompactQueryBarAction,
  CompactQueryBarField,
  CompactQueryBarSeparator,
} from '@/shared/ui/compact-query-bar';
import { useWidthBand } from '@/shared/ui/responsive-layout';

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
  AcademicTeachingPlanPageLoaderData,
  TeachingPlanOccurrenceEnvelope,
  TeachingPlanTeacherOption,
} from '../types';

import { TeachingPlanSheet } from './teaching-plan-sheet';

type AsyncState<T> = {
  data: T;
  error: string | null;
  loading: boolean;
};

type AppliedTeachingPlanQuery = {
  semesterId: number;
  staffId: string;
  staffName: string;
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
  currentAccount,
  currentStaff,
}: AcademicTeachingPlanPageLoaderData) {
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
  const [appliedQuery, setAppliedQuery] = useState<AppliedTeachingPlanQuery | null>(null);
  const [planState, setPlanState] =
    useState<AsyncState<TeachingPlanOccurrenceEnvelope | null>>(EMPTY_PLAN_STATE);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const pendingUpstreamActionRef = useRef<((session: StoredUpstreamSession) => void) | null>(null);
  const handleUpstreamLoginSuccess = useCallback(
    ({ session }: { session: StoredUpstreamSession }) => {
      const pendingAction = pendingUpstreamActionRef.current;
      pendingUpstreamActionRef.current = null;
      pendingAction?.(session);
    },
    [],
  );
  const {
    clearSession: clearUpstreamSession,
    modalProps: upstreamLoginModalProps,
    openLoginModal,
    openLoginModalForExpiredSession,
    persistSessionFromResult,
    session: upstreamSession,
  } = useUpstreamLoginModalController<'run-pending'>({
    account: currentAccount,
    keepAlive: true,
    lockedUserId: currentAccount.lockedUpstreamLoginUserId,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '校园网登录失败，请检查账号或密码。'),
    onLoginSuccess: handleUpstreamLoginSuccess,
  });
  const {
    error: upstreamIdentityError,
    identity: upstreamIdentity,
    loading: isLoadingUpstreamIdentity,
  } = useVerifiedUpstreamIdentity({
    onExpiredSession: clearUpstreamSession,
    persistSessionFromResult,
    session: upstreamSession,
  });

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
    if (!appliedQuery) {
      setPlanState(EMPTY_PLAN_STATE);
      return;
    }

    let isActive = true;
    setPlanState({ data: null, error: null, loading: true });
    const request = canManage
      ? requestManagedTeachingPlan({
          semesterId: appliedQuery.semesterId,
          staffId: appliedQuery.staffId,
        })
      : requestMyTeachingPlan(appliedQuery.semesterId);

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
  }, [appliedQuery, canManage, reloadKey]);

  const projection = useMemo(
    () => buildTeachingPlanProjection(planState.data?.items ?? []),
    [planState.data?.items],
  );

  const updateClassroomNameInPlan = (scheduleId: number, classroomName: string) => {
    setPlanState((current) => {
      if (!current.data) {
        return current;
      }

      return {
        ...current,
        data: {
          ...current.data,
          items: current.data.items.map((item) =>
            item.scheduleId === scheduleId ? { ...item, classroomName } : item,
          ),
        },
      };
    });
  };

  useEffect(() => {
    setSelectedScheduleId((current) => {
      if (current !== null && projection.courses.some((course) => course.scheduleId === current)) {
        return current;
      }

      return projection.courses[0]?.scheduleId ?? null;
    });
  }, [projection.courses]);

  const appliedSemester = semestersState.data.find(
    (semester) => semester.id === appliedQuery?.semesterId,
  );
  const selectedTeacher = resolveSelectedTeacher({
    currentStaff,
    options: teacherOptionsState.data,
    selectedStaffId,
  });
  const toolbarTeachers = useMemo(
    () =>
      canManage
        ? teacherOptionsState.data.map((teacher) => ({
            name: teacher.staffName,
            staffId: teacher.staffId,
          }))
        : currentStaff
          ? [{ name: currentStaff.displayName, staffId: currentStaff.staffId }]
          : [],
    [canManage, currentStaff, teacherOptionsState.data],
  );
  const toolbarStaffId = canManage ? selectedStaffId : (currentStaff?.staffId ?? null);
  const queryConditionsChanged = Boolean(
    appliedQuery &&
    (appliedQuery.semesterId !== selectedSemesterId || appliedQuery.staffId !== toolbarStaffId),
  );
  const upstreamIdentityMismatchMessage =
    canManage &&
    upstreamIdentity?.personId.trim() &&
    toolbarStaffId &&
    upstreamIdentity.personId.trim() !== toolbarStaffId
      ? `当前校园网身份 ${upstreamIdentity.personId} ${upstreamIdentity.personName} 与所选教师 ${toolbarStaffId} 不同；本次操作仍会交由后端权限校验。`
      : null;
  const requestUpstreamSession = useCallback(
    (action: (session: StoredUpstreamSession) => void, fallbackUserId?: string | null) => {
      if (upstreamSession) {
        action(upstreamSession);
        return;
      }
      pendingUpstreamActionRef.current = action;
      openLoginModal({
        fallbackUserId,
        pendingAction: 'run-pending',
      });
    },
    [openLoginModal, upstreamSession],
  );
  const recoverExpiredUpstreamSession = useCallback(
    (session: StoredUpstreamSession, action: (nextSession: StoredUpstreamSession) => void) => {
      pendingUpstreamActionRef.current = action;
      openLoginModalForExpiredSession({
        loginError: '校园网会话已失效，请重新登录后继续。',
        pendingAction: 'run-pending',
        session,
      });
    },
    [openLoginModalForExpiredSession],
  );
  const draftStaffId = appliedQuery?.staffId ?? planState.data?.items[0]?.staffId ?? 'unknown';
  const draftTeacherName = appliedQuery?.staffName ?? planState.data?.items[0]?.staffName ?? '教师';
  const selectedCourse =
    projection.courses.find((course) => course.scheduleId === selectedScheduleId) ??
    projection.courses[0];
  const selectedCourseIndex = selectedCourse ? projection.courses.indexOf(selectedCourse) : -1;
  const showCourseNavigationControls = projection.courses.length > 1;

  return (
    <div ref={workspaceRef} className="flex flex-col gap-4">
      <Card size="small">
        <div className="flex flex-col items-end gap-2">
          <UpstreamIdentityBar
            connected={Boolean(upstreamSession)}
            error={upstreamIdentityError}
            identity={upstreamIdentity}
            loading={isLoadingUpstreamIdentity}
            mismatchMessage={upstreamIdentityMismatchMessage}
            upstreamLoginId={upstreamSession?.upstreamLoginId}
            onConnect={() => {
              pendingUpstreamActionRef.current = null;
              openLoginModal({ fallbackUserId: toolbarStaffId });
            }}
          />

          <CompactQueryBar>
            <CompactQueryBarField label="学期" variant="control" width={240}>
              <AcademicSemesterSelect
                allowClear={false}
                disabled={semestersState.loading}
                loading={semestersState.loading}
                records={semestersState.data}
                value={selectedSemesterId ?? undefined}
                variant="borderless"
                onChange={(semesterId) => {
                  setSelectedSemesterId(semesterId);
                  setSelectedStaffId(canManage ? (currentStaff?.staffId ?? null) : null);
                  setTeacherKeyword('');
                }}
              />
            </CompactQueryBarField>

            <CompactQueryBarSeparator />

            <CompactQueryBarField label="教师" variant="control" width={200}>
              <StaffDirectoryTeacherAutoComplete
                allowClear={canManage}
                directoryUnavailableContent={
                  teacherOptionsState.error ? '教师列表加载失败' : '没有匹配的教师'
                }
                disabled={!canManage}
                loading={teacherOptionsState.loading}
                placeholder="工号或姓名"
                popupMatchSelectWidth={240}
                teachers={toolbarTeachers}
                value={toolbarStaffId ?? ''}
                variant="borderless"
                onChange={(staffId) => setSelectedStaffId(staffId || null)}
                onSearch={setTeacherKeyword}
              />
            </CompactQueryBarField>

            <CompactQueryBarAction>
              <Button
                disabled={selectedSemesterId === null || (canManage && !selectedStaffId)}
                icon={<SearchOutlined />}
                loading={planState.loading}
                type="primary"
                onClick={() => {
                  if (selectedSemesterId === null || !toolbarStaffId) {
                    return;
                  }
                  const nextQuery = {
                    semesterId: selectedSemesterId,
                    staffId: toolbarStaffId,
                    staffName:
                      selectedTeacher?.staffName ?? currentStaff?.displayName ?? toolbarStaffId,
                  };
                  setSelectedScheduleId(null);
                  if (
                    appliedQuery?.semesterId === nextQuery.semesterId &&
                    appliedQuery.staffId === nextQuery.staffId
                  ) {
                    setReloadKey((current) => current + 1);
                  } else {
                    setAppliedQuery(nextQuery);
                  }
                }}
              >
                查询
              </Button>
            </CompactQueryBarAction>
          </CompactQueryBar>
          {queryConditionsChanged ? (
            <span className="compact-query-bar-dirty-hint">条件已变更，点击查询应用</span>
          ) : null}
        </div>

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

      {!appliedQuery ? (
        <Card>
          <Empty
            description={
              semestersState.loading
                ? '正在加载学期…'
                : semestersState.data.length
                  ? '选择学期和教师后点击查询'
                  : '没有可查看的学期'
            }
          />
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
          title="授课计划暂不可用"
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

          {projection.courses.length ? (
            <Card
              extra={
                <Space wrap size="small">
                  {draftTeacherName ? <Tag icon={<UserOutlined />}>{draftTeacherName}</Tag> : null}
                  <Tag color="blue">计划真源</Tag>
                </Space>
              }
              title="课程授课计划"
            >
              {selectedCourse ? (
                <TeachingPlanSheet
                  canManage={canManage}
                  course={selectedCourse}
                  courseNavigation={
                    <Tabs
                      activeKey={String(selectedCourse.scheduleId)}
                      items={projection.courses.map((course, index) => ({
                        key: String(course.scheduleId),
                        label: (
                          <CourseTabLabel
                            course={course}
                            isActive={course.scheduleId === selectedCourse.scheduleId}
                            showDivider={index < projection.courses.length - 1}
                          />
                        ),
                      }))}
                      tabBarGutter={0}
                      tabBarExtraContent={
                        showCourseNavigationControls ? (
                          <div className="flex items-center gap-1 px-2 text-xs text-text-secondary">
                            <Button
                              aria-label="上一门课程"
                              disabled={selectedCourseIndex <= 0}
                              icon={<LeftOutlined />}
                              size="small"
                              title="上一门课程"
                              type="text"
                              onClick={() => {
                                const previousCourse = projection.courses[selectedCourseIndex - 1];
                                if (previousCourse) {
                                  setSelectedScheduleId(previousCourse.scheduleId);
                                }
                              }}
                            />
                            <span className="min-w-12 text-center tabular-nums">
                              {selectedCourseIndex + 1} / {projection.courses.length}
                            </span>
                            <Button
                              aria-label="下一门课程"
                              disabled={selectedCourseIndex >= projection.courses.length - 1}
                              icon={<RightOutlined />}
                              size="small"
                              title="下一门课程"
                              type="text"
                              onClick={() => {
                                const nextCourse = projection.courses[selectedCourseIndex + 1];
                                if (nextCourse) {
                                  setSelectedScheduleId(nextCourse.scheduleId);
                                }
                              }}
                            />
                          </div>
                        ) : null
                      }
                      tabBarStyle={{ marginBottom: 0 }}
                      tabPlacement="top"
                      onChange={(key) => setSelectedScheduleId(Number(key))}
                    />
                  }
                  currentAccountId={currentAccount.accountId}
                  isCompact={isCompact}
                  key={`${appliedQuery.semesterId}:${draftStaffId}:${selectedCourse.scheduleId}`}
                  semesterId={appliedQuery.semesterId}
                  semesterName={appliedSemester?.name ?? `学期 ${appliedQuery.semesterId}`}
                  semesterNumber={appliedSemester?.termNumber ?? 1}
                  schoolYear={String(appliedSemester?.schoolYear ?? '')}
                  targetStaffId={draftStaffId}
                  teacherName={draftTeacherName}
                  persistUpstreamSessionFromResult={persistSessionFromResult}
                  recoverExpiredUpstreamSession={recoverExpiredUpstreamSession}
                  requestUpstreamSession={requestUpstreamSession}
                  onClassroomNameUpdated={updateClassroomNameInPlan}
                />
              ) : null}
            </Card>
          ) : (
            <Card>
              <Empty description="所选教师在该学期没有计划课次" />
            </Card>
          )}
        </>
      ) : null}
      <UpstreamLoginModal {...upstreamLoginModalProps} />
    </div>
  );
}

function CourseTabLabel({
  course,
  isActive,
  showDivider,
}: {
  course: TeachingPlanCourseProjection;
  isActive: boolean;
  showDivider: boolean;
}) {
  const category = resolveCourseCategoryPresentation(course.courseCategory);

  return (
    <div
      className={`flex min-w-52 flex-col gap-1 px-4 py-2 text-left transition-colors duration-150 hover:bg-fill-secondary ${
        showDivider ? 'border-r border-border' : ''
      } ${isActive ? 'bg-fill-secondary' : ''}`}
    >
      <span className="font-medium text-inherit">{course.courseName}</span>
      <Space size="small" wrap>
        <Typography.Text type="secondary">
          {course.teachingClassName} · {course.dateCount} 天
        </Typography.Text>
        <Tag style={CATEGORY_STYLES[category.kind]} variant="filled">
          {category.label}
        </Tag>
      </Space>
    </div>
  );
}

function mergeTeacherOptions(
  options: readonly TeachingPlanTeacherOption[],
  currentStaff: AcademicTeachingPlanPageLoaderData['currentStaff'],
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
  currentStaff: AcademicTeachingPlanPageLoaderData['currentStaff'];
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
