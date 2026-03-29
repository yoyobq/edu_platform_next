import { type CSSProperties, useEffect, useRef } from 'react';
import { Button, ConfigProvider, Flex, Layout, Menu, Typography } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation } from 'react-router';

import { AiSidecar } from './ai-sidecar';
import { SidecarSessionProvider } from './sidecar-session-provider';
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
  const { close, isOpen, open } = useSidecarState();
  const mainRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);
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

  const search = location.search;
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
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>
                  aigc-friendly-frontend
                </Typography.Title>
                <Typography.Text type="secondary">
                  环境：{currentAppEnv} | 角色：
                  {new URLSearchParams(search).get('role') || 'guest'}
                </Typography.Text>
              </div>

              <div className="min-w-0 flex-1">
                <Menu
                  mode="horizontal"
                  selectedKeys={[getBaseURL(location.pathname, search)]}
                  items={menuItems}
                  style={{ justifyContent: 'flex-end', borderBottom: 'none' }}
                />
              </div>
            </div>
          </Layout.Header>

          <Layout.Content style={{ padding: '0 24px 32px' }}>
            <div
              ref={mainRef}
              data-main-width-band={mainWidthBand}
              style={{ '--layout-main-width': `${Math.round(mainWidth)}px` } as CSSProperties}
            >
              <Flex
                vertical
                gap={mainWidthBand === 'compact' ? 16 : 24}
                className="mx-auto max-w-7xl pt-6"
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

        <AiSidecar />

        <div className="fixed bottom-8 right-8 z-top-control-bar shadow-lg rounded-full">
          <Button
            ref={triggerRef}
            type={isOpen ? 'default' : 'primary'}
            size="large"
            shape="round"
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
            </div>
          </Button>
        </div>
      </div>
    </ConfigProvider>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <SidecarStateProvider>
      <SidecarSessionProvider>
        <AppLayoutFrame {...props} />
      </SidecarSessionProvider>
    </SidecarStateProvider>
  );
}
