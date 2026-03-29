import { Typography } from 'antd';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  RouterProvider,
  useRouteError,
} from 'react-router';

import { HomePage } from '@/pages/home';

import { demoLabAccess, DemoLabPage } from '@/labs/demo';
import { SandboxPlaygroundPage } from '@/sandbox/playground';

import { AppLayout } from './app-layout';

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
