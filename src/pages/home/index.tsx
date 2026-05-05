// src/pages/home/index.tsx

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Flex, Skeleton, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import {
  type AcademicTimetableItem,
  requestAcademicWeeklyTimetableItems,
  resolveCurrentTeachingWeekIndex,
} from '@/features/academic-timetable';
import {
  API_HEALTH_STATUS_HOME_RETRY_ACTION_ID,
  useApiHealthStatusHomeModule,
} from '@/features/api-health-status';
import { useAuthSessionState } from '@/features/auth';
import { buildHomePageViewModel, OPEN_ENTRY_SIDECAR_ACTION_ID } from '@/features/workbench-home';

import {
  type AcademicSemesterRecord,
  requestAcademicSemesters,
} from '@/entities/academic-semester';

import {
  type HomeModuleAction,
  type HomeModuleSummaryTone,
  isVisibleHomeModule,
  type VisibleHomeModuleContract,
} from '@/shared/home-modules';
import { requestOpenEntrySidecar } from '@/shared/workbench-events';

import { WorkbenchWeeklyTimetableGrid } from './workbench-weekly-timetable-grid';

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return '刚刚';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function toTagColor(tone: HomeModuleSummaryTone | undefined) {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    default:
      return 'default';
  }
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

function pickWorkbenchSemester(records: AcademicSemesterRecord[]) {
  const sortedRecords = sortSemesters(records);

  return sortedRecords.find((record) => record.isCurrent) ?? sortedRecords[0] ?? null;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function parseUtcDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function startOfUtcTeachingWeek(date: Date) {
  const weekday = (date.getUTCDay() + 6) % 7;

  return addUtcDays(date, -weekday);
}

function resolveWorkbenchTeachingWeekCount(semester: AcademicSemesterRecord) {
  const firstTeachingDate = parseUtcDateOnly(semester.firstTeachingDate);
  const examStartDate = parseUtcDateOnly(semester.examStartDate);

  if (!firstTeachingDate || !examStartDate) {
    return null;
  }

  const firstTeachingWeekStart = startOfUtcTeachingWeek(firstTeachingDate);
  const examWeekStart = startOfUtcTeachingWeek(examStartDate);
  const lastTeachingWeekStart =
    examWeekStart.getTime() > firstTeachingWeekStart.getTime()
      ? addUtcDays(examWeekStart, -7)
      : firstTeachingWeekStart;

  return (
    Math.floor((lastTeachingWeekStart.getTime() - firstTeachingWeekStart.getTime()) / 604_800_000) +
    1
  );
}

function clampWorkbenchWeekIndex(value: number, maxWeekIndex: number | null) {
  const minValue = Math.max(1, value);

  return maxWeekIndex ? Math.min(minValue, maxWeekIndex) : minValue;
}

function HomeModuleCard({
  module,
  onAction,
}: {
  module: VisibleHomeModuleContract;
  onAction: (action: HomeModuleAction) => void;
}) {
  const secondaryActions = module.entry.secondaryActions ?? [];
  let stateContent: ReactNode = null;

  if (module.state.kind === 'ready') {
    stateContent = (
      <Flex vertical gap={16}>
        <div className="flex flex-col gap-3">
          <Typography.Text strong>{module.state.summary.headline}</Typography.Text>
          {module.state.summary.items && module.state.summary.items.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {module.state.summary.items.map((item) => (
                <div
                  key={item.label}
                  className="rounded-block border border-border bg-bg-layout px-4 py-3"
                >
                  <Typography.Text type="secondary">{item.label}</Typography.Text>
                  <Typography.Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
                    {item.value}
                  </Typography.Paragraph>
                </div>
              ))}
            </div>
          ) : null}
          {module.state.summary.badges && module.state.summary.badges.length > 0 ? (
            <Flex gap={8} wrap>
              {module.state.summary.badges.map((badge) => (
                <Tag key={badge.text} color={toTagColor(badge.tone)}>
                  {badge.text}
                </Tag>
              ))}
            </Flex>
          ) : null}
        </div>
        <Typography.Text type="secondary">
          最近更新：{formatUpdatedAt(module.state.summary.updatedAt)}
        </Typography.Text>
      </Flex>
    );
  } else if (module.state.kind === 'empty') {
    const emptyAction = module.state.empty.action;

    stateContent = (
      <Alert
        type="info"
        showIcon
        title={module.state.empty.title}
        description={module.state.empty.description}
        action={
          emptyAction ? (
            <Button size="small" type="link" onClick={() => onAction(emptyAction)}>
              {emptyAction.label}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    const errorAction = module.state.error.action;

    stateContent = (
      <Alert
        type={module.state.error.severity === 'error' ? 'error' : 'warning'}
        showIcon
        title={module.state.error.title}
        description={module.state.error.description}
        action={
          errorAction ? (
            <Button size="small" type="link" onClick={() => onAction(errorAction)}>
              {errorAction.label}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card
      hoverable
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%' } }}
    >
      <div className="flex flex-col gap-3">
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            {module.title}
          </Typography.Title>
          <Tag color="processing">允许显示</Tag>
        </Flex>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {module.intent}
        </Typography.Paragraph>
      </div>

      {stateContent}

      <Flex gap={12} wrap>
        <Button
          type="primary"
          loading={module.entry.primaryAction.loading}
          disabled={module.entry.primaryAction.disabled}
          onClick={() => onAction(module.entry.primaryAction)}
        >
          {module.entry.primaryAction.label}
        </Button>
        {secondaryActions.map((action) => (
          <Button
            key={action.id}
            loading={action.loading}
            disabled={action.disabled}
            onClick={() => onAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </Flex>
    </Card>
  );
}

function WorkbenchWeeklyTimetable({ staffId }: { staffId: string | null }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<AcademicTimetableItem[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<AcademicSemesterRecord | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState<number | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [maxWeekIndex, setMaxWeekIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!staffId) {
      setErrorMessage(null);
      setIsLoading(false);
      setItems([]);
      setSelectedSemester(null);
      setCurrentWeekIndex(null);
      setSelectedWeekIndex(null);
      setMaxWeekIndex(null);
      return;
    }

    let isActive = true;
    const resolvedStaffId = staffId;

    async function loadWeeklyTimetable() {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const semester = pickWorkbenchSemester(await requestAcademicSemesters({ limit: 500 }));

        if (!semester) {
          if (isActive) {
            setItems([]);
            setSelectedSemester(null);
            setCurrentWeekIndex(null);
            setSelectedWeekIndex(null);
            setMaxWeekIndex(null);
          }
          return;
        }

        const resolvedMaxWeekIndex = resolveWorkbenchTeachingWeekCount(semester);
        const weekIndex = clampWorkbenchWeekIndex(
          resolveCurrentTeachingWeekIndex(semester) ?? 1,
          resolvedMaxWeekIndex,
        );
        const result = await requestAcademicWeeklyTimetableItems({
          semesterId: semester.id,
          staffId: resolvedStaffId,
          weekIndex,
        });

        if (isActive) {
          setItems(result);
          setSelectedSemester(semester);
          setCurrentWeekIndex(weekIndex);
          setSelectedWeekIndex(weekIndex);
          setMaxWeekIndex(resolvedMaxWeekIndex);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : '暂时无法加载周课表。');
          setItems([]);
          setSelectedSemester(null);
          setCurrentWeekIndex(null);
          setSelectedWeekIndex(null);
          setMaxWeekIndex(null);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadWeeklyTimetable();

    return () => {
      isActive = false;
    };
  }, [staffId]);

  async function changeWeek(nextWeekIndex: number) {
    if (!staffId || !selectedSemester) {
      return;
    }

    const resolvedWeekIndex = clampWorkbenchWeekIndex(nextWeekIndex, maxWeekIndex);

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await requestAcademicWeeklyTimetableItems({
        semesterId: selectedSemester.id,
        staffId,
        weekIndex: resolvedWeekIndex,
      });

      setItems(result);
      setSelectedWeekIndex(resolvedWeekIndex);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '暂时无法加载周课表。');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  if (errorMessage) {
    return <Alert showIcon title={errorMessage} type="error" />;
  }

  if (isLoading && selectedWeekIndex === null) {
    return <Skeleton active paragraph={{ rows: 10 }} title={false} />;
  }

  return (
    <WorkbenchWeeklyTimetableGrid
      currentWeekIndex={currentWeekIndex}
      emptyDescription={staffId ? '当前教学周没有命中的课表项' : '当前账号暂无可展示周课表'}
      isWeekNavigationLoading={isLoading}
      items={items}
      maxWeekIndex={maxWeekIndex}
      selectedWeekIndex={selectedWeekIndex}
      showCurrentTimeIndicator
      onWeekChange={(weekIndex) => void changeWeek(weekIndex)}
    />
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const { isPending, module: statusOverviewModule, retry } = useApiHealthStatusHomeModule();
  const staffId = useMemo(() => {
    const identity = authSession.snapshot?.identity;

    return identity?.kind === 'STAFF' ? identity.id : null;
  }, [authSession.snapshot?.identity]);
  const viewModel = buildHomePageViewModel({
    session: {
      accessGroup: authSession.snapshot?.userInfo.accessGroup,
      displayName: authSession.snapshot?.displayName,
      primaryAccessGroup: authSession.snapshot?.primaryAccessGroup,
    },
    statusOverviewModule,
  });
  const visibleModules = viewModel.modules.filter(isVisibleHomeModule);
  const shouldShowModuleSkeleton = viewModel.contentKind === 'admin-modules' && isPending;

  const handleAction = (action: HomeModuleAction) => {
    if (action.disabled) {
      return;
    }

    if (action.kind === 'navigate' && action.to) {
      navigate(action.to);
      return;
    }

    if (action.id === OPEN_ENTRY_SIDECAR_ACTION_ID) {
      requestOpenEntrySidecar();
      return;
    }

    if (action.id === API_HEALTH_STATUS_HOME_RETRY_ACTION_ID) {
      retry();
    }
  };

  return (
    <Flex vertical gap={24}>
      <Card>
        <Flex vertical gap={12}>
          <Flex align="center" gap={12} wrap>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              我的工作台
            </Typography.Title>
            {viewModel.contentKind === 'admin-modules' ? (
              <Tag color="blue">登录后默认入口</Tag>
            ) : null}
            {viewModel.templateLabel ? <Tag color="purple">{viewModel.templateLabel}</Tag> : null}
          </Flex>
          {viewModel.templateDescription ? (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
              {viewModel.templateDescription}
            </Typography.Paragraph>
          ) : null}
        </Flex>
      </Card>

      {viewModel.contentKind === 'weekly-timetable' ? (
        <WorkbenchWeeklyTimetable staffId={staffId} />
      ) : shouldShowModuleSkeleton ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={`home-module-skeleton-${index}`}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <HomeModuleCard key={module.id} module={module} onAction={handleAction} />
          ))}
        </div>
      )}
    </Flex>
  );
}
