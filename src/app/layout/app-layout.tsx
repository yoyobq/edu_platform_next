// src/app/layout/app-layout.tsx

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  ConfigProvider,
  Flex,
  Layout,
  Menu,
  Popconfirm,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation, useNavigate, useRevalidator } from 'react-router';

import {
  AuthRefreshFeedbackBridge,
  CollaborationSessionProvider,
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
} from '@/app/providers';

import { logout, useAuthSessionState } from '@/features/auth';

import { withWorkbenchSearch } from '@/shared/third-workspace-demo';
import { BrandLockup } from '@/shared/ui/brand';
import { ENTRY_SIDECAR_OPEN_EVENT } from '@/shared/workbench-events';

import { EntrySidecar } from './entry-sidecar';
import { NavSidebar } from './nav-sidebar';
import {
  getNavigationItems,
  hasAdminNavigationAccess,
  hasPayloadCryptoNavigationAccess,
  resolveNavMode,
} from './navigation-meta';
import { ThirdWorkspaceDemoHost } from './third-workspace-demo-host';
import { useMediaQuery } from './use-media-query';
import { useWidthBand } from './use-width-band';

type AppLayoutProps = {
  currentAppEnv: 'dev' | 'test' | 'prod';
};

type MainFrameStyle = CSSProperties & {
  '--layout-main-width': string;
};

function getBaseURL(pathname: string, search: string): string {
  return withWorkbenchSearch(pathname, search);
}

function AppLayoutFrame({ currentAppEnv }: AppLayoutProps) {
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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLabsRoute = location.pathname.startsWith('/labs/');
  const isHydrating = authSession.status === 'hydrating';
  const isSessionResolving = authSession.status === 'restoring' || isHydrating;
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

  // Activate nav mode based on effective admin access when session becomes authenticated.
  useEffect(() => {
    if (authSession.status === 'authenticated' && activeSnapshot) {
      const baseMode = resolveNavMode({
        accessGroup: activeSnapshot.userInfo.accessGroup,
      });
      const targetMode =
        baseMode === 'rail' && prefersPinnedFull && mainWidth >= NAV_MAIN_MIN_WIDTH_TO_RESTORE_FULL
          ? 'full'
          : baseMode;
      if (navMode === 'none' && targetMode !== 'none') {
        setNavMode(targetMode, {
          preservePinnedPreference: targetMode === 'rail' && prefersPinnedFull,
        });
      }
    }

    if (authSession.status === 'unauthenticated' && navMode !== 'none') {
      setNavMode('none');
    }
  }, [activeSnapshot, authSession.status, mainWidth, navMode, prefersPinnedFull, setNavMode]);

  const navItems = useMemo(
    () =>
      activeSnapshot
        ? getNavigationItems({
            accountId: activeSnapshot.accountId,
            primaryAccessGroup: activeSnapshot.primaryAccessGroup,
            accessGroup: activeSnapshot.userInfo.accessGroup,
            slotGroup: activeSnapshot.slotGroup,
            appEnv: currentAppEnv,
          })
        : [],
    [activeSnapshot, currentAppEnv],
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
  const hasAdminAccess = hasAdminNavigationAccess({
    accessGroup: activeSnapshot?.userInfo.accessGroup,
  });
  const hasSidebar =
    authSession.status === 'authenticated' &&
    hasAdminAccess &&
    navMode !== 'none' &&
    navItems.length > 0;

  // Top bar menu items — only built when sidebar is not active.
  const menuItems: ItemType[] = hasSidebar
    ? []
    : [
        {
          key: getBaseURL('/', search),
          label: <Link to={getBaseURL('/', search)}>首页</Link>,
        },
        ...(hasPayloadCryptoNavigationAccess({
          accountId: activeSnapshot?.accountId,
          accessGroup: activeSnapshot?.userInfo.accessGroup,
        })
          ? [
              {
                key: getBaseURL('/labs/payload-crypto', search),
                label: <Link to={getBaseURL('/labs/payload-crypto', search)}>载荷加解密</Link>,
              },
            ]
          : []),
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

  return (
    <ConfigProvider
      theme={{
        cssVar: {},
        token: {
          colorPrimary: '#1255CC',
          colorError: '#D93025',
          colorLink: '#1255CC',
          colorBgLayout: '#F4F6FA',
          colorBgContainer: '#FFFFFF',
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 4,
        },
      }}
    >
      <AuthRefreshFeedbackBridge />
      <div className="min-h-screen bg-bg-layout text-text">
        <Layout style={{ minHeight: '100%', background: 'transparent' }}>
          <Layout.Header
            style={{
              background: 'var(--color-bg-container)',
              borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
              paddingInline: 0,
              height: 'auto',
              lineHeight: 'normal',
            }}
          >
            <div className="flex items-center justify-between gap-4 py-3" style={frameShiftStyle}>
              <div
                className="flex min-w-0 shrink-0 items-center"
                style={{
                  width: hasSidebar
                    ? navMode === 'full'
                      ? NAV_FULL_WIDTH
                      : NAV_RAIL_WIDTH
                    : undefined,
                  paddingLeft: hasSidebar ? 20 : 24,
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
                <div className="rounded-full bg-bg-layout px-3 py-1 text-xs text-text-secondary">
                  {currentIdentity}
                </div>
                {authSession.status === 'authenticated' && activeSnapshot ? (
                  <>
                    <div className="rounded-full bg-bg-layout px-3 py-1 text-xs text-text-secondary">
                      {activeSnapshot.displayName}
                    </div>
                    <Popconfirm
                      cancelText="不累"
                      description="且将公事付清风，他日相逢再续行"
                      okText="江湖再见"
                      placement="bottomRight"
                      title="结束会话"
                      onConfirm={() => {
                        logout();
                        navigate('/login', { replace: true });
                      }}
                    >
                      <Button type="text" size="small">
                        退出
                      </Button>
                    </Popconfirm>
                  </>
                ) : isSessionResolving ? (
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
                ) : (
                  <Button type="primary" size="small" onClick={() => navigate('/login')}>
                    登录
                  </Button>
                )}
              </div>
            </div>
          </Layout.Header>

          <Layout style={{ background: 'transparent' }}>
            {hasSidebar && (
              <Layout.Sider
                width={navMode === 'full' ? NAV_FULL_WIDTH : NAV_RAIL_WIDTH}
                style={{
                  background: 'var(--color-bg-container)',
                  borderRight: '1px solid rgba(15, 23, 42, 0.08)',
                  overflow: 'visible',
                  position: 'relative',
                }}
              >
                <NavSidebar items={navItems} />
              </Layout.Sider>
            )}
            <Layout.Content style={{ padding: '0 24px 32px' }}>
              <div ref={mainRef} data-main-width-band={mainWidthBand} style={mainFrameStyle}>
                <Flex
                  vertical
                  gap={mainWidthBand === 'compact' ? 16 : 24}
                  className="mx-auto max-w-7xl pt-6 transition-[gap]"
                >
                  {isLabsRoute ? (
                    <div className="rounded-badge border border-warning-border bg-warning-bg px-4 py-2">
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        `labs` 路由需要通过当前登录会话的访问控制规则。
                      </Typography.Paragraph>
                    </div>
                  ) : null}
                  {isHydrating ? (
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
                    <Outlet />
                  )}
                </Flex>
              </div>
            </Layout.Content>
          </Layout>
        </Layout>

        <div data-layout-layer="third-workspace-root" aria-hidden="true">
          <div data-workspace-mount="artifacts-canvas" />
        </div>

        <ThirdWorkspaceDemoHost />

        <EntrySidecar />

        <div data-layout-layer="global-overlay-root" aria-hidden="true">
          <div data-overlay-mount="cross-region-visual" />
        </div>

        <div className="fixed bottom-8 right-8 z-top-control-bar rounded-full shadow-surface">
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
              <span className="text-lg">✨</span>
              <span>开始</span>
              {showShortcutHint ? (
                <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs text-current/75">
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

export function AppLayout({ currentAppEnv }: AppLayoutProps) {
  return (
    <KeyboardShortcutStackProvider>
      <NavCapabilityProvider>
        <SidecarStateProvider>
          <CollaborationSessionProvider currentAppEnv={currentAppEnv}>
            <AppLayoutFrame currentAppEnv={currentAppEnv} />
          </CollaborationSessionProvider>
        </SidecarStateProvider>
      </NavCapabilityProvider>
    </KeyboardShortcutStackProvider>
  );
}
