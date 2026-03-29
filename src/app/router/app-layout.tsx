import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Button, ConfigProvider, Flex, Layout, Menu, Typography } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation } from 'react-router';

import { CollaborationSessionProvider } from './collaboration-session-provider';
import { EntrySidecar } from './entry-sidecar';
import { useRegisterKeyboardShortcut } from './keyboard-shortcut-stack';
import { KeyboardShortcutStackProvider } from './keyboard-shortcut-stack-provider';
import { useSidecarState } from './sidecar-state';
import { SidecarStateProvider } from './sidecar-state-provider';
import { useWidthBand } from './use-width-band';

type AppLayoutProps = {
  currentAppEnv: 'dev' | 'test' | 'prod';
};

function getBaseURL(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

function AppLayoutFrame({ currentAppEnv }: AppLayoutProps) {
  const location = useLocation();
  const { close, isOpen, measuredWidth, open } = useSidecarState();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);
  const [showShortcutHint, setShowShortcutHint] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : false,
  );
  const isLabsRoute = location.pathname.startsWith('/labs/');
  const { band: mainWidthBand, width: mainWidth } = useWidthBand(
    mainRef,
    [
      { max: 720, value: 'compact' },
      { max: 1100, value: 'comfortable' },
    ],
    'wide',
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

  const openEntrySidecar = useCallback(() => {
    if (!isOpen) {
      open();
    }
  }, [isOpen, open]);

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
  const currentRole = new URLSearchParams(search).get('role') || 'guest';
  const menuItems: ItemType[] = [
    {
      key: getBaseURL('/', search),
      label: <Link to={getBaseURL('/', search)}>首页</Link>,
    },
  ];

  if (currentAppEnv === 'dev' || currentAppEnv === 'test') {
    menuItems.push({
      key: getBaseURL('/sandbox/playground', search),
      label: <Link to={getBaseURL('/sandbox/playground', search)}>沙盒演练场</Link>,
    });
  }

  const reservedSidecarWidth =
    isOpen && mainWidthBand !== 'compact' ? Math.max(measuredWidth + 24, 480) : 0;
  const frameShiftStyle = reservedSidecarWidth
    ? ({
        paddingRight: reservedSidecarWidth,
        transition: 'padding-right 180ms ease',
      } as const)
    : ({
        paddingRight: 0,
        transition: 'padding-right 180ms ease',
      } as const);

  return (
    <ConfigProvider theme={{ cssVar: {} }}>
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
              <div className="rounded-3xl border border-border bg-bg-container px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <Typography.Title level={4} style={{ marginBottom: 0 }}>
                      aigc-friendly-frontend
                    </Typography.Title>
                    <Typography.Text type="secondary">主内容优先，入口协作增强。</Typography.Text>
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
                    <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                      环境：{currentAppEnv}
                    </div>
                    <div className="rounded-full border border-border bg-bg-layout px-3 py-1 text-sm text-text-secondary">
                      角色：{currentRole}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Layout.Header>

          <Layout.Content style={{ padding: '0 24px 32px' }}>
            <div
              ref={mainRef}
              data-main-width-band={mainWidthBand}
              style={
                {
                  '--layout-main-width': `${Math.round(mainWidth)}px`,
                  ...frameShiftStyle,
                } as CSSProperties
              }
            >
              <Flex
                vertical
                gap={mainWidthBand === 'compact' ? 16 : 24}
                className="mx-auto max-w-7xl pt-6 transition-[gap]"
              >
                {isLabsRoute ? (
                  <div className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2">
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      `labs` 路由需要通过访问控制。可使用 `?role=admin` 模拟当前允许角色。
                    </Typography.Paragraph>
                  </div>
                ) : null}
                <Outlet />
              </Flex>
            </div>
          </Layout.Content>
        </Layout>

        <EntrySidecar />

        <div className="fixed bottom-8 right-8 z-top-control-bar rounded-full shadow-lg">
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
              <span className="font-medium">开始</span>
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

export function AppLayout(props: AppLayoutProps) {
  return (
    <KeyboardShortcutStackProvider>
      <SidecarStateProvider>
        <CollaborationSessionProvider currentAppEnv={props.currentAppEnv}>
          <AppLayoutFrame {...props} />
        </CollaborationSessionProvider>
      </SidecarStateProvider>
    </KeyboardShortcutStackProvider>
  );
}
