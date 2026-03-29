import { ConfigProvider, Flex, Layout, Menu, Typography } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Link,
  Outlet,
  RouterProvider,
  useLocation,
  useRouteError,
} from 'react-router';

import { HomePage } from '@/pages/home';

import { demoLabAccess, DemoLabPage } from '@/labs/demo';
import { SandboxPlaygroundPage } from '@/sandbox/playground';

type AppEnv = 'dev' | 'test' | 'prod';
type AppRole = 'guest' | 'admin';

function getCurrentAppEnv(): AppEnv {
  const configuredAppEnv = import.meta.env.VITE_APP_ENV;

  if (configuredAppEnv === 'dev' || configuredAppEnv === 'test' || configuredAppEnv === 'prod') {
    return configuredAppEnv;
  }

  return import.meta.env.DEV ? 'dev' : 'prod';
}

const currentAppEnv = getCurrentAppEnv();

function getBaseURL(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

function getRequestRole(request: Request): AppRole {
  const requestURL = new URL(request.url);
  return requestURL.searchParams.get('role') === 'admin' ? 'admin' : 'guest';
}

function hasLabAccess(request: Request, access: typeof demoLabAccess): boolean {
  const role = getRequestRole(request);
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;
  return (
    access.env.includes(effectiveLabEnv) && access.roles.some((allowedRole) => allowedRole === role)
  );
}

async function demoLabLoader({ request }: { request: Request }) {
  if (!hasLabAccess(request, demoLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function sandboxLoader() {
  if (currentAppEnv !== 'dev' && currentAppEnv !== 'test') {
    throw new Response('Not Found', { status: 404 });
  }

  return null;
}

function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return (
        <div className="rounded-2xl border border-warning-border bg-warning-bg p-6">
          <Typography.Title level={3}>Access denied</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            This route is currently blocked by access rules.
          </Typography.Paragraph>
        </div>
      );
    }

    if (error.status === 404) {
      return (
        <div className="rounded-2xl border border-border bg-bg-layout p-6">
          <Typography.Title level={3}>Route not found</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            This route is not currently exposed in the active environment.
          </Typography.Paragraph>
        </div>
      );
    }
  }

  return (
    <div className="rounded-2xl border border-error-border bg-error-bg p-6">
      <Typography.Title level={3}>Unexpected route error</Typography.Title>
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        The route failed before rendering.
      </Typography.Paragraph>
    </div>
  );
}

function RouteHydrateFallback() {
  return null;
}

function AppShell() {
  const location = useLocation();

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

          <Layout.Content style={{ padding: '32px' }}>
            <Flex vertical gap={16}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                `labs` routes require access checks. Use `?role=admin` to simulate the current
                allowed role.
              </Typography.Paragraph>
              <Outlet />
            </Flex>
          </Layout.Content>
        </Layout>
      </div>
    </ConfigProvider>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: RouteHydrateFallback,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: 'labs/demo',
        loader: demoLabLoader,
        Component: DemoLabPage,
      },
      {
        path: 'sandbox/playground',
        loader: sandboxLoader,
        Component: SandboxPlaygroundPage,
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
