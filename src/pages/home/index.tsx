// src/pages/home/index.tsx

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightOutlined, BookOutlined, HomeOutlined, SwapOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Skeleton, Tag, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  type AcademicTimetableItem,
  requestAcademicWeeklyTimetableItems,
  requestMyAcademicSemesterTimetableItems,
  resolveCurrentTeachingWeekIndex,
  resolveTeachingWeekCount,
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

import { type AcademicViewerRole, hasAcademicTeachingLogAccess } from '@/shared/auth-access';
import { HexAvatar } from '@/shared/hex-avatar';
import {
  type HomeModuleAction,
  type HomeModuleSummaryTone,
  isVisibleHomeModule,
  type VisibleHomeModuleContract,
} from '@/shared/home-modules';
import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { ResponsiveGrid } from '@/shared/ui/responsive-layout';
import { requestOpenEntrySidecar } from '@/shared/workbench-events';

import { WorkbenchCustomItemDragProvider } from './workbench-custom-item-dnd';
import {
  resolveNicknameWorkbenchGreeting,
  resolveWorkbenchTimeGreeting,
} from './workbench-greeting';
import { WorkbenchOtherTodos } from './workbench-other-todos';
import { WorkbenchWeeklyTimetableGrid } from './workbench-weekly-timetable-grid';

import './index.css';

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

type WorkbenchNameMode = 'nickname' | 'staffName';

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
  let stateContent: ReactNode;

  if (module.state.kind === 'ready') {
    stateContent = (
      <Flex vertical gap={16}>
        <div className="flex flex-col gap-3">
          <Typography.Text strong>{module.state.summary.headline}</Typography.Text>
          {module.state.summary.items && module.state.summary.items.length > 0 ? (
            <ResponsiveGrid className="gap-3" columns={{ compact: 1, regular: 2 }}>
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
            </ResponsiveGrid>
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

function WorkbenchWeeklyTimetable({
  accountId,
  showTeachingLogQuickEntry,
  staffId,
  viewerRole,
}: {
  accountId: number | null;
  showTeachingLogQuickEntry: boolean;
  staffId: string | null;
  viewerRole: AcademicViewerRole;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<AcademicTimetableItem[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<AcademicSemesterRecord | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState<number | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [maxWeekIndex, setMaxWeekIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!staffId && viewerRole !== 'staff') {
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
    const resolvedStaffId = staffId ?? '';

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

        const resolvedMaxWeekIndex = resolveTeachingWeekCount(semester);
        const weekIndex = clampWorkbenchWeekIndex(
          resolveCurrentTeachingWeekIndex(semester) ?? 1,
          resolvedMaxWeekIndex,
        );
        const result =
          viewerRole === 'staff'
            ? (
                await requestMyAcademicSemesterTimetableItems({
                  semesterId: semester.id,
                })
              ).filter((item) => item.weekIndex === weekIndex)
            : await requestAcademicWeeklyTimetableItems({
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
  }, [staffId, viewerRole]);

  async function changeWeek(nextWeekIndex: number) {
    if ((!staffId && viewerRole !== 'staff') || !selectedSemester) {
      return;
    }

    const resolvedWeekIndex = clampWorkbenchWeekIndex(nextWeekIndex, maxWeekIndex);

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result =
        viewerRole === 'staff'
          ? (
              await requestMyAcademicSemesterTimetableItems({
                semesterId: selectedSemester.id,
              })
            ).filter((item) => item.weekIndex === resolvedWeekIndex)
          : await requestAcademicWeeklyTimetableItems({
              semesterId: selectedSemester.id,
              staffId: staffId ?? '',
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
    <WorkbenchCustomItemDragProvider>
      <div className="home-workbench-timetable-content">
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
        <div className="home-workbench-secondary-row">
          <section
            className="home-workbench-secondary-panel"
            aria-labelledby="home-workbench-other-representatives-title"
          >
            <WorkbenchOtherTodos
              key={accountId ?? 'anonymous'}
              accountId={accountId}
              headingId="home-workbench-other-representatives-title"
            />
          </section>
          <section
            className="home-workbench-secondary-panel"
            aria-labelledby="home-workbench-quick-entry-title"
          >
            <h2 id="home-workbench-quick-entry-title">快捷入口</h2>
            {showTeachingLogQuickEntry ? (
              <div className="home-workbench-quick-entry-list">
                <Link
                  className="home-workbench-quick-entry-card"
                  to="/academic-affairs/my-teaching-logs"
                >
                  <span className="home-workbench-quick-entry-icon">
                    <BookOutlined />
                  </span>
                  <span className="home-workbench-quick-entry-main">
                    <span className="home-workbench-quick-entry-group">教务助手</span>
                    <span className="home-workbench-quick-entry-title">My 教学日志</span>
                    <span className="home-workbench-quick-entry-desc">
                      对照教学计划，补齐待填日志
                    </span>
                  </span>
                  <span className="home-workbench-quick-entry-arrow">
                    <ArrowRightOutlined />
                  </span>
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </WorkbenchCustomItemDragProvider>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const { isPending, module: statusOverviewModule, retry } = useApiHealthStatusHomeModule();
  const [nameMode, setNameMode] = useState<WorkbenchNameMode>('staffName');
  const identity = authSession.snapshot?.identity;
  const staffId = useMemo(() => {
    return identity?.kind === 'STAFF' ? identity.id : null;
  }, [identity]);
  const staffName = useMemo(() => {
    return identity?.kind === 'STAFF' ? identity.name : null;
  }, [identity]);
  const nickname = authSession.snapshot?.userInfo.nickname?.trim() || null;
  const fallbackDisplayName = authSession.snapshot?.displayName?.trim() || '欢迎回来';
  const normalizedStaffName = staffName?.trim() || null;
  const normalizedNickname =
    nickname && nickname !== normalizedStaffName ? nickname : authSession.snapshot?.displayName;
  const switchableNickname =
    normalizedNickname?.trim() && normalizedNickname.trim() !== normalizedStaffName
      ? normalizedNickname.trim()
      : null;
  const displayedWorkbenchName =
    normalizedStaffName && nameMode === 'staffName'
      ? normalizedStaffName
      : switchableNickname || normalizedStaffName || fallbackDisplayName;
  const shouldShowNameSwitch = Boolean(normalizedStaffName && switchableNickname);
  const timeGreeting = resolveWorkbenchTimeGreeting();
  const nicknameGreeting = resolveNicknameWorkbenchGreeting();
  const profileTags = authSession.snapshot?.userInfo.tags ?? [];
  const profileTagsTooltip =
    profileTags.length > 0 ? (
      <div className="home-workbench-profile-tag-tooltip">
        {profileTags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    ) : undefined;
  const nameSwitchButton = shouldShowNameSwitch ? (
    <span className="home-workbench-name-switch">
      <Button
        aria-label={nameMode === 'staffName' ? '切换为昵称显示' : '切换为教师姓名显示'}
        icon={<SwapOutlined />}
        size="small"
        title={nameMode === 'staffName' ? '切换为昵称' : '切换为教师姓名'}
        type="text"
        onClick={() =>
          setNameMode((current) => (current === 'staffName' ? 'nickname' : 'staffName'))
        }
      />
    </span>
  ) : null;
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
  const canShowTeachingLogQuickEntry = hasAcademicTeachingLogAccess({
    accessGroup: authSession.snapshot?.userInfo.accessGroup,
  });
  const weeklyTimetableViewerRole = authSession.snapshot?.userInfo.accessGroup.includes('ADMIN')
    ? 'admin'
    : authSession.snapshot?.userInfo.accessGroup.includes('STAFF')
      ? 'staff'
      : 'authenticated';

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
      <DecoratedPageHeader
        badge={
          viewModel.contentKind === 'admin-modules' && viewModel.templateLabel ? (
            <Tag variant="filled">{viewModel.templateLabel}</Tag>
          ) : null
        }
        description={
          <>
            合理安排，把握节奏，简明高效。
            {viewModel.templateDescription ? (
              <>
                <br />
                {viewModel.templateDescription}
              </>
            ) : null}
          </>
        }
        eyebrow="我的工作台"
        eyebrowAsHeading
        icon={<HomeOutlined />}
        iconPlacement="eyebrow"
        title={
          normalizedStaffName ? (
            nameMode === 'staffName' ? (
              <>
                尊敬的 <span className="home-workbench-welcome-name">{displayedWorkbenchName}</span>{' '}
                老师，
                {timeGreeting.formalMessage ?? `${timeGreeting.label}好，您辛苦了`}
                {nameSwitchButton}
              </>
            ) : (
              <>
                <span className="home-workbench-welcome-name">{displayedWorkbenchName}</span>，
                {nicknameGreeting}
                {nameSwitchButton}
              </>
            )
          ) : (
            <>
              {displayedWorkbenchName}，{timeGreeting.label}好，您辛苦了
            </>
          )
        }
        titleHeadingLevel={3}
        titleLevel={3}
        aside={
          <div className="home-workbench-profile">
            <Tooltip placement="bottom" title={profileTagsTooltip}>
              <span className="home-workbench-profile-avatar">
                <HexAvatar
                  accountId={authSession.snapshot?.accountId}
                  avatarUrl={authSession.snapshot?.userInfo.avatarUrl}
                  size={88}
                  style={{
                    border: '3px solid var(--ant-color-bg-container)',
                    boxShadow: '0 0 0 1px var(--ant-color-border-secondary), var(--shadow-card)',
                  }}
                />
              </span>
            </Tooltip>
          </div>
        }
      />

      {viewModel.contentKind === 'weekly-timetable' ? (
        <WorkbenchWeeklyTimetable
          accountId={authSession.snapshot?.accountId ?? null}
          showTeachingLogQuickEntry={canShowTeachingLogQuickEntry}
          staffId={staffId}
          viewerRole={weeklyTimetableViewerRole}
        />
      ) : shouldShowModuleSkeleton ? (
        <ResponsiveGrid className="gap-4" columns={{ compact: 1, wide: 3 }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={`home-module-skeleton-${index}`}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </ResponsiveGrid>
      ) : (
        <ResponsiveGrid className="gap-4" columns={{ compact: 1, wide: 3 }}>
          {visibleModules.map((module) => (
            <HomeModuleCard key={module.id} module={module} onAction={handleAction} />
          ))}
        </ResponsiveGrid>
      )}
    </Flex>
  );
}
