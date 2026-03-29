import { useEffect, useRef } from 'react';
import { Button, ConfigProvider, Flex, Layout, Menu, Typography } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation } from 'react-router';

import { AiSidecar } from './ai-sidecar';
import { useSidecarState } from './sidecar-state';
import { SidecarStateProvider } from './sidecar-state-provider';

type AppLayoutProps = {
  currentAppEnv: 'dev' | 'test' | 'prod';
};

function getBaseURL(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

function AppLayoutFrame({ currentAppEnv }: AppLayoutProps) {
  const location = useLocation();
  const { close, isOpen, open } = useSidecarState();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(isOpen);
  const isLabsRoute = location.pathname.startsWith('/labs/');

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
      label: <Link to={getBaseURL('/', search)}>Home</Link>,
    },
  ];

  if (currentAppEnv === 'dev' || currentAppEnv === 'test') {
    menuItems.push({
      key: getBaseURL('/sandbox/playground', search),
      label: <Link to={getBaseURL('/sandbox/playground', search)}>Sandbox Playground</Link>,
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
                  env: {currentAppEnv} | role: {new URLSearchParams(search).get('role') || 'guest'}
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
            <Flex vertical gap={24} className="mx-auto max-w-7xl pt-6">
              {isLabsRoute ? (
                <div className="rounded-lg border border-warning-border bg-warning-bg px-4 py-2">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    `labs` routes require access checks. Use `?role=admin` to simulate the current
                    allowed role.
                  </Typography.Paragraph>
                </div>
              ) : null}
              <Outlet />
            </Flex>
          </Layout.Content>
        </Layout>

        <AiSidecar />

        {/* Global Assistant Trigger (FAB) */}
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
              <span className="font-medium">Assistant</span>
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
      <AppLayoutFrame {...props} />
    </SidecarStateProvider>
  );
}
