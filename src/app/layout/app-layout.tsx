// src/app/layout/app-layout.tsx

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutOutlined,
  LogoutOutlined,
  MoonOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Dropdown,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Popover,
  Segmented,
  Skeleton,
  theme as antdTheme,
  Tooltip,
  Typography,
} from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation, useNavigate, useRevalidator } from 'react-router';

import { getNavigationItems, resolveNavMode } from '@/app/navigation';
import {
  AuthRefreshFeedbackBridge,
  CollaborationSessionProvider,
  FONT_SCALE_CONFIG,
  FONT_SCALE_OPTIONS,
  type FontScale,
  KeyboardShortcutStackProvider,
  NAV_FULL_WIDTH,
  NAV_MAIN_MIN_WIDTH_TO_RESTORE_FULL,
  NAV_MAIN_MIN_WIDTH_WITH_FULL,
  NAV_RAIL_WIDTH,
  NavCapabilityProvider,
  SidecarStateProvider,
  useNavCapability,
  useRegisterKeyboardShortcut,
  useSidecarState,
  useTheme,
} from '@/app/providers';

import { logout, useAuthSessionState } from '@/features/auth';

import {
  type AccountSwitchLabSession,
  createAccountSwitchLabSession,
} from '@/shared/account-switch/api';
import {
  type AccountSwitchLabRecord,
  readAccountSwitchLabRecords,
  upsertAccountSwitchLabRecord,
  writeAccountSwitchLabRecords,
  writeCurrentAuthSession,
} from '@/shared/account-switch/storage';
import { getGraphQLClient } from '@/shared/graphql';
import { HexAvatar } from '@/shared/hex-avatar';
import { withWorkbenchSearch } from '@/shared/third-workspace-demo';
import { BrandLockup } from '@/shared/ui/brand';
import { ENTRY_SIDECAR_OPEN_EVENT } from '@/shared/workbench-events';

import { EntryAccentGlyph } from './entry-accent-glyph';
import { EntrySidecar } from './entry-sidecar';
import { NavSidebar } from './nav-sidebar';
import { ThirdWorkspaceDemoHost } from './third-workspace-demo-host';
import { useMediaQuery } from './use-media-query';
import { useWidthBand } from './use-width-band';

type AppLayoutProps = {
  currentAppEnv: 'dev' | 'test' | 'prod';
  children?: ReactNode;
};

type MainFrameStyle = CSSProperties & {
  '--layout-main-width': string;
};

const NAV_RAIL_CONTROL_SIZE = 40;

function getBaseURL(pathname: string, search: string): string {
  return withWorkbenchSearch(pathname, search);
}

function AppLayoutFrame({ currentAppEnv, children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const { close, isOpen, measuredWidth, open } = useSidecarState();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);
  const [showShortcutHint, setShowShortcutHint] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : false,
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [addAccountForm] = Form.useForm<{ loginName: string; loginPassword: string }>();
  const [accountRecords, setAccountRecords] = useState<AccountSwitchLabRecord[]>(() =>
    readAccountSwitchLabRecords(),
  );
  const [addAccountSubmitting, setAddAccountSubmitting] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<number | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { isDark, setIsDark, fontScale, setFontScale } = useTheme();

  const isLabsRoute = location.pathname.startsWith('/labs/');
  const isHydrating = authSession.status === 'hydrating';
  const isSessionResolving = authSession.status === 'restoring' || isHydrating;
  const hasExplicitChildren = typeof children !== 'undefined';
  const activeSnapshot = authSession.status === 'authenticated' ? authSession.snapshot : null;
  const revalidator = useRevalidator();
  const { band: mainWidthBand, width: mainWidth } = useWidthBand(
    mainRef,
    [
      { max: 720, value: 'compact' },
      { max: 1100, value: 'comfortable' },
    ],
    'wide',
  );
  const {
    autoFoldToRail,
    clearManualFullOverride,
    manualFullOverride,
    mode: navMode,
    prefersPinnedFull,
    setMode: setNavMode,
  } = useNavCapability();
  const navigationFilter = useMemo(
    () =>
      activeSnapshot
        ? {
            accountId: activeSnapshot.accountId,
            primaryAccessGroup: activeSnapshot.primaryAccessGroup,
            accessGroup: activeSnapshot.userInfo.accessGroup,
            slotGroup: activeSnapshot.slotGroup,
            appEnv: currentAppEnv,
          }
        : null,
    [activeSnapshot, currentAppEnv],
  );

  // Activate nav mode based on effective navigation access when session becomes authenticated.
  useEffect(() => {
    if (authSession.status === 'authenticated' && navigationFilter) {
      const baseMode = resolveNavMode(navigationFilter);
      const targetMode = baseMode === 'rail' && prefersPinnedFull ? 'full' : baseMode;
      if (navMode === 'none' && targetMode !== 'none') {
        setNavMode(targetMode);
      }
    }

    if (authSession.status === 'unauthenticated' && navMode !== 'none') {
      setNavMode('none');
    }
  }, [authSession.status, mainWidth, navMode, navigationFilter, prefersPinnedFull, setNavMode]);

  const navItems = useMemo(
    () => (navigationFilter ? getNavigationItems(navigationFilter) : []),
    [navigationFilter],
  );

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    function syncPageFocus() {
      setShowShortcutHint(document.hasFocus() && document.visibilityState === 'visible');
    }

    syncPageFocus();
    window.addEventListener('focus', syncPageFocus);
    window.addEventListener('blur', syncPageFocus);
    document.addEventListener('visibilitychange', syncPageFocus);

    return () => {
      window.removeEventListener('focus', syncPageFocus);
      window.removeEventListener('blur', syncPageFocus);
      document.removeEventListener('visibilitychange', syncPageFocus);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const previousAuthStatusRef = useRef(authSession.status);
  const previousMainWidthRef = useRef<number | null>(null);
  const previousNavModeRef = useRef(navMode);
  const previousViewportWidthRef = useRef(viewportWidth);
  const previousSidecarOpenRef = useRef(isOpen);
  const previousSidecarWidthRef = useRef(measuredWidth);

  useEffect(() => {
    const previousStatus = previousAuthStatusRef.current;
    previousAuthStatusRef.current = authSession.status;

    if (previousStatus === 'hydrating' && authSession.status === 'authenticated') {
      revalidator.revalidate();
    }
  }, [authSession.status, revalidator]);

  useEffect(() => {
    const previousMainWidth = previousMainWidthRef.current;
    const previousNavMode = previousNavModeRef.current;
    const externalConstraintChanged =
      previousViewportWidthRef.current !== viewportWidth ||
      previousSidecarOpenRef.current !== isOpen ||
      previousSidecarWidthRef.current !== measuredWidth;
    const shouldAllowAutoFold = !manualFullOverride || externalConstraintChanged;

    if (manualFullOverride && externalConstraintChanged) {
      clearManualFullOverride();
    }

    if (navMode === 'full' && mainWidth > 0) {
      const crossedBelowFullThreshold =
        previousNavMode === 'full' &&
        previousMainWidth !== null &&
        previousMainWidth >= NAV_MAIN_MIN_WIDTH_WITH_FULL &&
        mainWidth < NAV_MAIN_MIN_WIDTH_WITH_FULL;

      if (shouldAllowAutoFold && crossedBelowFullThreshold) {
        previousMainWidthRef.current = mainWidth;
        previousViewportWidthRef.current = viewportWidth;
        previousSidecarOpenRef.current = isOpen;
        previousSidecarWidthRef.current = measuredWidth;
        autoFoldToRail();
        previousNavModeRef.current = 'rail';
        return;
      }
    }

    if (
      navMode === 'rail' &&
      prefersPinnedFull &&
      mainWidth >= NAV_MAIN_MIN_WIDTH_TO_RESTORE_FULL
    ) {
      previousMainWidthRef.current = mainWidth;
      previousViewportWidthRef.current = viewportWidth;
      previousSidecarOpenRef.current = isOpen;
      previousSidecarWidthRef.current = measuredWidth;
      setNavMode('full');
      previousNavModeRef.current = 'full';
      return;
    }

    previousMainWidthRef.current = mainWidth;
    previousNavModeRef.current = navMode;
    previousViewportWidthRef.current = viewportWidth;
    previousSidecarOpenRef.current = isOpen;
    previousSidecarWidthRef.current = measuredWidth;
  }, [
    autoFoldToRail,
    clearManualFullOverride,
    isOpen,
    mainWidth,
    manualFullOverride,
    measuredWidth,
    navMode,
    prefersPinnedFull,
    setNavMode,
    viewportWidth,
  ]);

  const openEntrySidecar = useCallback(() => {
    if (!isOpen) {
      open();
    }
  }, [isOpen, open]);

  useEffect(() => {
    const handleOpenRequest = () => {
      open();
    };

    window.addEventListener(ENTRY_SIDECAR_OPEN_EVENT, handleOpenRequest);

    return () => {
      window.removeEventListener(ENTRY_SIDECAR_OPEN_EVENT, handleOpenRequest);
    };
  }, [open]);

  useRegisterKeyboardShortcut(
    {
      key: 'k',
      altKey: true,
      priority: 'page',
      handler: openEntrySidecar,
    },
    true,
  );

  const search = location.search;
  const currentIdentity = isSessionResolving
    ? '同步中'
    : activeSnapshot?.primaryAccessGroup.toLowerCase() || 'guest';
  const hasSidebar =
    authSession.status === 'authenticated' && navMode !== 'none' && navItems.length > 0;

  // Top bar menu items — only built when sidebar is not active.
  const menuItems: ItemType[] = hasSidebar
    ? []
    : [
        {
          key: getBaseURL('/', search),
          label: <Link to={getBaseURL('/', search)}>首页</Link>,
        },
        ...(currentAppEnv === 'dev' || currentAppEnv === 'test'
          ? [
              {
                key: getBaseURL('/sandbox/playground', search),
                label: <Link to={getBaseURL('/sandbox/playground', search)}>沙盒演练场</Link>,
              },
            ]
          : []),
      ];

  const shouldReserveSidecarSpace = isOpen && isDesktop;
  const frameShiftStyle = shouldReserveSidecarSpace
    ? ({
        width: `calc(100% - max(${measuredWidth}px, clamp(360px, 36vw, 560px)) - 24px)`,
      } satisfies CSSProperties)
    : ({
        width: '100%',
      } satisfies CSSProperties);
  const mainFrameStyle: MainFrameStyle = {
    '--layout-main-width': `${Math.round(mainWidth)}px`,
    ...frameShiftStyle,
  };
  const accountSessions = useMemo(() => {
    const sessions: AccountSwitchLabSession[] = [];
    const seenAccountIds = new Set<number>();

    if (activeSnapshot) {
      sessions.push(activeSnapshot);
      seenAccountIds.add(activeSnapshot.accountId);
    }

    for (const record of accountRecords) {
      if (seenAccountIds.has(record.session.accountId)) {
        continue;
      }

      sessions.push(record.session);
      seenAccountIds.add(record.session.accountId);
    }

    return sessions;
  }, [accountRecords, activeSnapshot]);

  function commitAccountRecords(nextRecords: AccountSwitchLabRecord[]) {
    writeAccountSwitchLabRecords(nextRecords);
    setAccountRecords(nextRecords);
  }

  function getAccountLoginName(session: AccountSwitchLabSession) {
    return session.account.loginName || session.displayName || `#${session.accountId}`;
  }

  function getAccountLoginEmail(session: AccountSwitchLabSession) {
    return session.account.loginEmail || session.userInfo.email || '未设置邮箱';
  }

  async function switchToSession(session: AccountSwitchLabSession) {
    if (activeSnapshot?.accountId === session.accountId) {
      return;
    }

    setSwitchingAccountId(session.accountId);

    try {
      await getGraphQLClient().clearStore();
      writeCurrentAuthSession(session);
      window.location.reload();
    } finally {
      setSwitchingAccountId(null);
    }
  }

  async function handleAddAccount() {
    const values = await addAccountForm.validateFields();

    setAddAccountSubmitting(true);
    setAddAccountError(null);

    try {
      const session = await createAccountSwitchLabSession({
        loginName: values.loginName,
        loginPassword: values.loginPassword,
      });
      const baseRecords = activeSnapshot
        ? upsertAccountSwitchLabRecord(accountRecords, activeSnapshot)
        : accountRecords;
      const nextRecords = upsertAccountSwitchLabRecord(baseRecords, session);

      commitAccountRecords(nextRecords);
      setAddAccountModalOpen(false);
      addAccountForm.resetFields();
    } catch (error) {
      setAddAccountError(error instanceof Error ? error.message : '添加账号失败。');
    } finally {
      setAddAccountSubmitting(false);
    }
  }

  async function logoutAccount(session: AccountSwitchLabSession) {
    const nextRecords = accountRecords.filter(
      (record) => record.session.accountId !== session.accountId,
    );

    commitAccountRecords(nextRecords);

    if (activeSnapshot?.accountId === session.accountId) {
      await getGraphQLClient().clearStore();
      logout();
      navigate('/login', { replace: true });
    }
  }

  const renderAccountMenuContent = () => {
    const surfaceStyle: CSSProperties = {
      background: 'var(--ant-color-bg-elevated)',
      borderRadius: 'var(--ant-border-radius-lg)',
      boxShadow: 'var(--ant-box-shadow-secondary)',
      minWidth: 280,
      overflow: 'hidden',
      padding: 8,
    };
    const accountListMenu = (
      <div style={surfaceStyle}>
        <div className="px-1 pb-2">
          <div className="flex flex-col gap-1">
            {accountSessions.map((session) => {
              const isActiveAccount = activeSnapshot?.accountId === session.accountId;

              return (
                <button
                  key={session.accountId}
                  type="button"
                  className={
                    isActiveAccount
                      ? 'flex w-full items-center gap-3 rounded-lg bg-fill-hover px-3 py-2.5 text-left'
                      : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout'
                  }
                  disabled={isActiveAccount || switchingAccountId === session.accountId}
                  onClick={() => void switchToSession(session)}
                >
                  <HexAvatar
                    accountId={session.accountId}
                    avatarUrl={session.userInfo.avatarUrl}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {getAccountLoginName(session)}
                    </div>
                    <div className="truncate text-xs text-text-secondary">
                      {getAccountLoginEmail(session)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-1 pt-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
            onClick={() => setAddAccountModalOpen(true)}
          >
            <PlusOutlined />
            <span className="min-w-0 flex-1 text-left">增加另一个账号</span>
          </button>
        </div>
      </div>
    );
    const logoutAccountMenu = (
      <div style={surfaceStyle}>
        <div className="px-1 pb-2">
          <div className="flex flex-col gap-1">
            {accountSessions.map((session) => (
              <button
                key={session.accountId}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout"
                onClick={() => void logoutAccount(session)}
              >
                <HexAvatar
                  accountId={session.accountId}
                  avatarUrl={session.userInfo.avatarUrl}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{getAccountLoginName(session)}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {getAccountLoginEmail(session)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    return (
      <div style={surfaceStyle}>
        {activeSnapshot ? (
          <div className="px-1 pb-3 pt-1">
            <Popover
              placement="rightTop"
              trigger="click"
              content={accountListMenu}
              overlayInnerStyle={{ padding: 0 }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-layout"
              >
                <HexAvatar
                  accountId={activeSnapshot.accountId}
                  avatarUrl={activeSnapshot.userInfo.avatarUrl}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{activeSnapshot.displayName}</div>
                  <div className="truncate text-xs text-text-secondary">{currentIdentity}</div>
                </div>
                <RightOutlined className="text-text-tertiary" style={{ fontSize: 10 }} />
              </button>
            </Popover>
          </div>
        ) : null}

        <div className="px-1 py-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          {activeSnapshot ? (
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
              onClick={() => navigate('/profile')}
            >
              <UserOutlined />
              <span className="min-w-0 flex-1 text-left">个人资料</span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
            onClick={() => setIsDark((v) => !v)}
          >
            {isDark ? <SunOutlined /> : <MoonOutlined />}
            <span className="min-w-0 flex-1 text-left">
              {isDark ? '切换浅色模式' : '切换深色模式'}
            </span>
          </button>
          <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-text-secondary">字号</span>
            <Segmented
              size="small"
              value={fontScale}
              options={FONT_SCALE_OPTIONS}
              onChange={(v) => setFontScale(v as FontScale)}
            />
          </div>
        </div>

        <div className="px-1 pt-2" style={{ borderTop: '1px solid var(--ant-color-split)' }}>
          {activeSnapshot ? (
            <Popover
              placement="rightBottom"
              trigger="click"
              content={logoutAccountMenu}
              overlayInnerStyle={{ padding: 0 }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-bg-layout"
              >
                <LogoutOutlined />
                <span className="min-w-0 flex-1 text-left">退出账户</span>
                <RightOutlined className="text-text-tertiary" style={{ fontSize: 10 }} />
              </button>
            </Popover>
          ) : null}
        </div>
      </div>
    );
  };
  const sidebarFooter = hasSidebar ? (
    <div className="flex flex-col gap-2">
      {activeSnapshot ? (
        <Dropdown placement="topLeft" trigger={['click']} popupRender={renderAccountMenuContent}>
          <Tooltip title="账户菜单" placement="right">
            <button
              type="button"
              className={
                navMode === 'full'
                  ? 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-bg-layout'
                  : 'mx-auto flex items-center justify-center rounded-lg transition-colors hover:bg-bg-layout'
              }
              style={
                navMode === 'full'
                  ? undefined
                  : {
                      height: NAV_RAIL_CONTROL_SIZE,
                      width: NAV_RAIL_CONTROL_SIZE,
                    }
              }
              aria-label="用户菜单"
            >
              <HexAvatar
                accountId={activeSnapshot.accountId}
                avatarUrl={activeSnapshot.userInfo.avatarUrl}
                size={navMode === 'full' ? 28 : 24}
              />
              {navMode === 'full' ? (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{activeSnapshot.displayName}</div>
                  <div className="truncate text-xs text-text-secondary">{currentIdentity}</div>
                </div>
              ) : null}
            </button>
          </Tooltip>
        </Dropdown>
      ) : null}
    </div>
  ) : null;
  const navToggleButton = hasSidebar ? (
    <Tooltip title={navMode === 'full' ? '收起菜单' : '展开菜单'} placement="right">
      <button
        type="button"
        className={
          navMode === 'full'
            ? 'flex shrink-0 items-center justify-center rounded-lg text-text-quaternary transition-colors duration-150 hover:bg-bg-layout hover:text-text-tertiary'
            : 'flex shrink-0 items-center justify-center rounded-lg text-text transition-colors duration-150 hover:bg-fill-hover'
        }
        style={{
          height: NAV_RAIL_CONTROL_SIZE,
          width: NAV_RAIL_CONTROL_SIZE,
        }}
        aria-label={navMode === 'full' ? '收起导航菜单' : '展开导航菜单'}
        onClick={navMode === 'full' ? () => setNavMode('rail') : () => setNavMode('full')}
      >
        <LayoutOutlined />
      </button>
    </Tooltip>
  ) : null;
  const sidebarHeader = hasSidebar ? (
    navMode === 'full' ? (
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-3 pb-2">
        <div className="flex min-w-0 items-center">
          <BrandLockup
            compact
            logoSize={28}
            logoSlotSize={NAV_RAIL_CONTROL_SIZE}
            variant="header"
          />
        </div>
        {navToggleButton}
      </div>
    ) : (
      <div className="grid h-full w-full min-w-0 grid-rows-[40px_40px]">
        <div className="flex items-center justify-center">
          <div
            className="flex items-center justify-center"
            style={{
              height: NAV_RAIL_CONTROL_SIZE,
              width: NAV_RAIL_CONTROL_SIZE,
            }}
          >
            <BrandLockup
              compact
              logoSize={24}
              logoSlotSize={NAV_RAIL_CONTROL_SIZE}
              variant="header"
            />
          </div>
        </div>
        <div className="flex items-center justify-center">{navToggleButton}</div>
      </div>
    )
  ) : null;
  const mainToolbar = (
    <div className="flex items-center justify-end gap-3 px-6 py-3">
      <Tooltip title="全局搜索与命令 (预留)">
        <Button
          type="text"
          shape="circle"
          icon={<SearchOutlined />}
          data-layout-slot="omni-bar-trigger"
          aria-label="全局搜索与命令"
        />
      </Tooltip>
      <div className="rounded-full bg-bg-layout px-3 py-1 text-xs text-text-secondary">
        {currentAppEnv}
      </div>
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        cssVar: {},
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1255CC',
          colorError: '#D93025',
          colorLink: '#1255CC',
          fontSize: FONT_SCALE_CONFIG[fontScale].antdFontSize,
          ...(isDark
            ? {}
            : {
                colorBgLayout: '#F4F6FA',
                colorBgContainer: '#FFFFFF',
              }),
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 4,
        },
      }}
    >
      <AuthRefreshFeedbackBridge />
      <div className="h-screen overflow-hidden bg-bg-layout text-text">
        {hasSidebar ? (
          <Layout style={{ height: '100%', background: 'transparent' }}>
            <Layout style={{ background: 'transparent', minHeight: 0, overflow: 'hidden' }}>
              <Layout.Sider
                width={navMode === 'full' ? NAV_FULL_WIDTH : NAV_RAIL_WIDTH}
                style={{
                  background: 'var(--color-bg-container)',
                  borderRight: '1px solid var(--ant-color-border-secondary)',
                  overflow: 'visible',
                  position: 'relative',
                }}
              >
                <NavSidebar footer={sidebarFooter} header={sidebarHeader} items={navItems} />
              </Layout.Sider>
              <Layout style={{ background: 'transparent', minWidth: 0 }}>
                {mainToolbar}
                <Layout.Content
                  data-layout-scroll-container="main"
                  style={{ padding: '0 24px 32px', overflowY: 'auto' }}
                >
                  <div ref={mainRef} data-main-width-band={mainWidthBand} style={mainFrameStyle}>
                    <Flex
                      vertical
                      gap={mainWidthBand === 'compact' ? 16 : 24}
                      data-layout-slot="main-content-column"
                      className="mx-auto max-w-7xl transition-[gap]"
                    >
                      {isLabsRoute ? (
                        <div className="rounded-badge border border-warning-border bg-warning-bg px-4 py-2">
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            `labs` 路由需要通过当前登录会话的访问控制规则。
                          </Typography.Paragraph>
                        </div>
                      ) : null}
                      {isHydrating && !hasExplicitChildren ? (
                        <Card>
                          <Flex vertical gap={20}>
                            <div className="flex flex-col gap-2">
                              <Typography.Title level={4} style={{ marginBottom: 0 }}>
                                正在同步账户信息
                              </Typography.Title>
                              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                                已建立登录会话，正在补齐当前账号的身份与权限信息。
                              </Typography.Paragraph>
                            </div>
                            <Skeleton active paragraph={{ rows: 6 }} />
                          </Flex>
                        </Card>
                      ) : (
                        (children ?? <Outlet />)
                      )}
                    </Flex>
                  </div>
                </Layout.Content>
              </Layout>
            </Layout>
          </Layout>
        ) : (
          <Layout style={{ height: '100%', background: 'transparent' }}>
            <Layout.Header
              style={{
                background: 'var(--color-bg-container)',
                borderBottom: '1px solid var(--ant-color-border-secondary)',
                paddingInline: 0,
                height: 'auto',
                lineHeight: 'normal',
                flexShrink: 0,
              }}
            >
              <div className="flex items-center justify-between gap-4 py-3" style={frameShiftStyle}>
                <div
                  className="flex min-w-0 shrink-0 items-center"
                  style={{
                    paddingLeft: 24,
                  }}
                >
                  <BrandLockup variant="header" />
                </div>

                {menuItems.length > 0 && (
                  <div className="hidden min-w-0 flex-1 lg:block">
                    <Menu
                      mode="horizontal"
                      selectedKeys={[getBaseURL(location.pathname, search)]}
                      items={menuItems}
                      style={{
                        justifyContent: 'center',
                        borderBottom: 'none',
                        background: 'transparent',
                      }}
                    />
                  </div>
                )}

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 pr-6">
                  {mainToolbar}
                  <Segmented
                    size="small"
                    value={fontScale}
                    options={FONT_SCALE_OPTIONS}
                    onChange={(v) => setFontScale(v as FontScale)}
                  />
                  <Tooltip title={isDark ? '切换浅色模式' : '切换深色模式'}>
                    <Button
                      type="text"
                      shape="circle"
                      icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                      aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
                      onClick={() => setIsDark((v) => !v)}
                    />
                  </Tooltip>

                  {authSession.status === 'authenticated' && activeSnapshot ? (
                    <Dropdown
                      placement="bottomRight"
                      trigger={['click']}
                      popupRender={renderAccountMenuContent}
                    >
                      <button
                        type="button"
                        className="flex cursor-pointer items-center rounded-full border-2 border-transparent p-0.5 transition-all hover:border-border-secondary"
                        aria-label="用户菜单"
                      >
                        <HexAvatar
                          accountId={activeSnapshot.accountId}
                          avatarUrl={activeSnapshot.userInfo.avatarUrl}
                          size={32}
                        />
                      </button>
                    </Dropdown>
                  ) : null}

                  {isSessionResolving ? (
                    <>
                      <div className="rounded-full bg-bg-layout px-3 py-1 text-xs text-text-secondary">
                        正在同步账户信息
                      </div>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => {
                          logout();
                          navigate('/login', { replace: true });
                        }}
                      >
                        取消登录
                      </Button>
                    </>
                  ) : null}

                  {authSession.status !== 'authenticated' && !isSessionResolving ? (
                    <Button type="primary" size="small" onClick={() => navigate('/login')}>
                      登录
                    </Button>
                  ) : null}
                </div>
              </div>
            </Layout.Header>

            <Layout
              style={{ background: 'transparent', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <Layout.Content
                data-layout-scroll-container="main"
                style={{ padding: '16px 24px 32px', overflowY: 'auto' }}
              >
                <div ref={mainRef} data-main-width-band={mainWidthBand} style={mainFrameStyle}>
                  <Flex
                    vertical
                    gap={mainWidthBand === 'compact' ? 16 : 24}
                    data-layout-slot="main-content-column"
                    className="mx-auto max-w-7xl transition-[gap]"
                  >
                    {isLabsRoute ? (
                      <div className="rounded-badge border border-warning-border bg-warning-bg px-4 py-2">
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          `labs` 路由需要通过当前登录会话的访问控制规则。
                        </Typography.Paragraph>
                      </div>
                    ) : null}
                    {isHydrating && !hasExplicitChildren ? (
                      <Card>
                        <Flex vertical gap={20}>
                          <div className="flex flex-col gap-2">
                            <Typography.Title level={4} style={{ marginBottom: 0 }}>
                              正在同步账户信息
                            </Typography.Title>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                              已建立登录会话，正在补齐当前账号的身份与权限信息。
                            </Typography.Paragraph>
                          </div>
                          <Skeleton active paragraph={{ rows: 6 }} />
                        </Flex>
                      </Card>
                    ) : (
                      (children ?? <Outlet />)
                    )}
                  </Flex>
                </div>
              </Layout.Content>
            </Layout>
          </Layout>
        )}

        <div data-layout-layer="third-workspace-root" aria-hidden="true">
          <div data-workspace-mount="artifacts-canvas" />
        </div>

        <ThirdWorkspaceDemoHost />

        <EntrySidecar />

        <Modal
          title="增加另一个账号"
          open={addAccountModalOpen}
          okText="添加账号"
          cancelText="取消"
          confirmLoading={addAccountSubmitting}
          onCancel={() => {
            setAddAccountModalOpen(false);
            setAddAccountError(null);
            addAccountForm.resetFields();
          }}
          onOk={() => void handleAddAccount()}
        >
          {addAccountError ? (
            <Alert
              type="error"
              showIcon
              message={addAccountError}
              style={{ marginBottom: 16, marginTop: 8 }}
            />
          ) : null}
          <Form
            form={addAccountForm}
            layout="vertical"
            requiredMark={false}
            autoComplete="on"
            style={{ paddingTop: 8 }}
          >
            <Form.Item
              label="登录名或邮箱"
              name="loginName"
              rules={[{ required: true, message: '请输入登录名或邮箱。' }]}
            >
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="loginPassword"
              rules={[{ required: true, message: '请输入密码。' }]}
              style={{ marginBottom: 0 }}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Form>
        </Modal>

        <div data-layout-layer="global-overlay-root" aria-hidden="true">
          <div data-overlay-mount="cross-region-visual" />
        </div>

        <div
          className="entry-trigger-shell fixed bottom-8 right-8 z-top-control-bar rounded-full shadow-surface"
          data-entry-open={isOpen ? 'true' : 'false'}
        >
          <Button
            ref={triggerRef}
            type={isOpen ? 'default' : 'primary'}
            size="large"
            shape="round"
            aria-keyshortcuts="Alt+K"
            onClick={() => {
              if (isOpen) {
                close();
                return;
              }
              open();
            }}
          >
            <div className="flex items-center gap-2">
              <EntryAccentGlyph inverse={!isOpen} />
              <span>开始</span>
              {showShortcutHint ? (
                <span className="entry-trigger-shortcut rounded-full px-2 py-0.5 text-xs">
                  Alt+K
                </span>
              ) : null}
            </div>
          </Button>
        </div>
      </div>
    </ConfigProvider>
  );
}

export function AppLayout({ currentAppEnv, children }: AppLayoutProps) {
  return (
    <KeyboardShortcutStackProvider>
      <NavCapabilityProvider>
        <SidecarStateProvider>
          <CollaborationSessionProvider currentAppEnv={currentAppEnv}>
            <AppLayoutFrame currentAppEnv={currentAppEnv}>{children}</AppLayoutFrame>
          </CollaborationSessionProvider>
        </SidecarStateProvider>
      </NavCapabilityProvider>
    </KeyboardShortcutStackProvider>
  );
}
