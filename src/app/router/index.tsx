// src/app/router/index.tsx

import { Typography } from 'antd';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  RouterProvider,
  useRouteError,
} from 'react-router';

import { AppLayout } from '@/app/layout';

import { HomePage } from '@/pages/home';

import { demoLabAccess, loadDemoLabRouteModule } from '@/labs/demo';
import { loadSandboxPlaygroundRouteModule } from '@/sandbox/playground';

type AppEnv = 'dev' | 'test' | 'prod';
type AppRole = 'guest' | 'admin';
type LabAccess = {
  env: readonly ('dev' | 'prod')[];
  roles: readonly AppRole[];
};

function getCurrentAppEnv(): AppEnv {
  const configuredAppEnv = import.meta.env.VITE_APP_ENV;

  if (configuredAppEnv === 'dev' || configuredAppEnv === 'test' || configuredAppEnv === 'prod') {
    return configuredAppEnv;
  }

  return import.meta.env.DEV ? 'dev' : 'prod';
}

const currentAppEnv = getCurrentAppEnv();

function getRequestRole(request: Request): AppRole {
  const requestURL = new URL(request.url);
  return requestURL.searchParams.get('role') === 'admin' ? 'admin' : 'guest';
}

function hasLabAccess(request: Request, access: LabAccess): boolean {
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
          <Typography.Title level={3}>访问被拒绝</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            当前路由已被访问控制规则拦截。
          </Typography.Paragraph>
        </div>
      );
    }

    if (error.status === 404) {
      return (
        <div className="rounded-2xl border border-border bg-bg-layout p-6">
          <Typography.Title level={3}>路由不存在</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            当前环境下未暴露此路由。
          </Typography.Paragraph>
        </div>
      );
    }
  }

  return (
    <div className="rounded-2xl border border-error-border bg-error-bg p-6">
      <Typography.Title level={3}>路由出现异常</Typography.Title>
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        路由在渲染前发生错误。
      </Typography.Paragraph>
    </div>
  );
}

function RouteHydrateFallback() {
  return null;
}

const router = createBrowserRouter([
  {
    path: '/',
    Component: () => <AppLayout currentAppEnv={currentAppEnv} />,
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
        lazy: loadDemoLabRouteModule,
      },
      {
        path: 'sandbox/playground',
        loader: sandboxLoader,
        lazy: loadSandboxPlaygroundRouteModule,
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
