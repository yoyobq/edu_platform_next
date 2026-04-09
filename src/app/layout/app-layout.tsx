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
import { getNavigationItems, resolveNavMode } from './navigation-meta';
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

function hasPayloadCryptoMenuAccess(input: {
  accountId?: number;
  accessGroup?: readonly string[];
}) {
  const isSpecificAdmin = input.accountId === 1 || input.accountId === 2;
  const hasAdminAccess = input.accessGroup?.includes('ADMIN') ?? false;

  return isSpecificAdmin && hasAdminAccess;
}

function AppLayoutFrame({ currentAppEnv }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const authSession = useAuthSessionState();
  const authenticatedSnapshot = authSession.snapshot;
  const { close, isOpen, measuredWidth, open } = useSidecarState();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);
  const [showShortcutHint, setShowShortcutHint] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : false,
  );
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLabsRoute = location.pathname.startsWith('/labs/');
  const isHydrating = authSession.status === 'hydrating';
  const revalidator = useRevalidator();
  const { band: mainWidthBand, width: mainWidth } = useWidthBand(
    mainRef,
    [
      { max: 720, value: 'compact' },
      { max: 1100, value: 'comfortable' },
    ],
    'wide',
  );
  const { mode: navMode, setMode: setNavMode } = useNavCapability();

  // Activate nav mode based on primaryAccessGroup when session becomes authenticated.
  useEffect(() => {
    if (authSession.status === 'authenticated' && authenticatedSnapshot) {
      const targetMode = resolveNavMode(authenticatedSnapshot.primaryAccessGroup);
      if (navMode === 'none' && targetMode !== 'none') {
        setNavMode(targetMode);
      }
    }

    if (authSession.status === 'unauthenticated' && navMode !== 'none') {
      setNavMode('none');
    }
  }, [authSession.status, authenticatedSnapshot, navMode, setNavMode]);

  const navItems = useMemo(
    () =>
      authenticatedSnapshot
        ? getNavigationItems({
            primaryAccessGroup: authenticatedSnapshot.primaryAccessGroup,
            accessGroup: authenticatedSnapshot.userInfo.accessGroup,
            slotGroup: authenticatedSnapshot.slotGroup,
            appEnv: currentAppEnv,
          })
        : [],
    [authenticatedSnapshot, currentAppEnv],
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

  const previousAuthStatusRef = useRef(authSession.status);

  useEffect(() => {
    const previousStatus = previousAuthStatusRef.current;
    previousAuthStatusRef.current = authSession.status;

    if (previousStatus === 'hydrating' && authSession.status === 'authenticated') {
      revalidator.revalidate();
    }
  }, [authSession.status, revalidator]);

  useEffect(() => {
    if (navMode === 'full' && mainWidth > 0 && mainWidth < NAV_MAIN_MIN_WIDTH_WITH_FULL) {
      setNavMode('rail');
    }
  }, [mainWidth, navMode, setNavMode]);

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
  const currentIdentity = isHydrating
    ? '同步中'
    : authSession.snapshot?.primaryAccessGroup.toLowerCase() || 'guest';
  const menuItems: ItemType[] = [
    {
      key: getBaseURL('/', search),
      label: <Link to={getBaseURL('/', search)}>首页</Link>,
    },
  ];

  if (
    hasPayloadCryptoMenuAccess({
      accountId: authenticatedSnapshot?.accountId,
      accessGroup: authenticatedSnapshot?.userInfo.accessGroup,
    })
  ) {
    menuItems.push({
      key: getBaseURL('/labs/payload-crypto', search),
      label: <Link to={getBaseURL('/labs/payload-crypto', search)}>载荷加解密</Link>,
    });
  }

  if (currentAppEnv === 'dev' || currentAppEnv === 'test') {
    menuItems.push({
      key: getBaseURL('/sandbox/playground', search),
      label: <Link to={getBaseURL('/sandbox/playground', search)}>沙盒演练场</Link>,
    });
  }

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
              background: 'transparent',
              paddingInline: 24,
              height: 'auto',
              lineHeight: 'normal',
            }}
          >
            <div className="mx-auto max-w-7xl py-4" style={frameShiftStyle}>
              <div className="rounded-surface border border-border bg-bg-container px-6 py-4 shadow-card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <BrandLockup variant="header" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <Menu
                      mode="horizontal"
                      selectedKeys={[getBaseURL(location.pathname, search)]}
                      items={menuItems}
                      style={{ justifyContent: 'center', borderBottom: 'none' }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Tooltip title="全局搜索与命令 (预留)">
                      <Button
                        type="text"
                        shape="circle"
                        icon={<SearchOutlined />}
                        data-layout-slot="omni-bar-trigger"
                        aria-label="全局搜索与命令"
                      />
                    </Tooltip>
                    <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                      环境：{currentAppEnv}
                    </div>
                    <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                      身份：{currentIdentity}
                    </div>
                    {authSession.status === 'authenticated' && authenticatedSnapshot ? (
                      <>
                        <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                          {authenticatedSnapshot.displayName}
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
                          <Button type="default">退出</Button>
                        </Popconfirm>
                      </>
                    ) : isHydrating ? (
                      <>
                        <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                          正在同步账户信息
                        </div>
                        <Button
                          type="default"
                          onClick={() => {
                            logout();
                            navigate('/login', { replace: true });
                          }}
                        >
                          取消登录
                        </Button>
                      </>
                    ) : (
                      <Button type="primary" onClick={() => navigate('/login')}>
                        登录
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Layout.Header>

          <Layout style={{ background: 'transparent' }}>
            {navMode !== 'none' && navItems.length > 0 && (
              <Layout.Sider
                width={navMode === 'full' ? NAV_FULL_WIDTH : NAV_RAIL_WIDTH}
                style={{ background: 'var(--color-bg-container)' }}
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
