// src/app/router/index.tsx

import { type ReactNode, useEffect } from 'react';
import { Spin, Typography } from 'antd';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  type LoaderFunctionArgs,
  redirect,
  RouterProvider,
  useRouteError,
} from 'react-router';

import { AppLayout, PublicEntryLayout } from '@/app/layout';

import { ForgotPasswordPage } from '@/pages/forgot-password';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import {
  InviteIntentPage,
  MagicLinkIntentPage,
  ResetPasswordIntentPage,
  VerifyEmailIntentPage,
} from '@/pages/verification-intent';
import { getAuthSessionSnapshot, restoreSession, useAuthSessionState } from '@/features/auth';

import { resolveLoginRedirectTarget, sanitizeRedirectTarget } from '@/shared/navigation';

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

function getCurrentSessionRole(): AppRole {
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    return 'guest';
  }

  return snapshot.role === 'ADMIN' || snapshot.accessGroup.includes('ADMIN') ? 'admin' : 'guest';
}

function hasLabAccess(access: LabAccess): boolean {
  const role = getCurrentSessionRole();
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;

  return (
    access.env.includes(effectiveLabEnv) && access.roles.some((allowedRole) => allowedRole === role)
  );
}

function hasLabEnvExposure(access: LabAccess): boolean {
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;

  return access.env.includes(effectiveLabEnv);
}

function hasGuestLabAccess(access: LabAccess): boolean {
  return access.roles.includes('guest');
}

function getRequestTarget(request: Request) {
  const url = new URL(request.url);

  return {
    origin: url.origin,
    redirectTarget: sanitizeRedirectTarget(`${url.pathname}${url.search}${url.hash}`, url.origin),
    url,
  };
}

function buildLoginRedirectURL(request: Request) {
  const { redirectTarget } = getRequestTarget(request);

  return `/login?redirect=${encodeURIComponent(redirectTarget)}`;
}

async function loginRouteLoader({ request }: LoaderFunctionArgs) {
  await restoreSession();

  if (getAuthSessionSnapshot()) {
    const { url } = getRequestTarget(request);

    throw redirect(resolveLoginRedirectTarget(url.searchParams.get('redirect'), url.origin));
  }

  return null;
}

async function ensureAuthenticatedSession(request: Request) {
  await restoreSession();

  if (!getAuthSessionSnapshot()) {
    throw redirect(buildLoginRedirectURL(request));
  }
}

async function protectedWorkbenchLoader({ request }: LoaderFunctionArgs) {
  await ensureAuthenticatedSession(request);

  return null;
}

async function demoLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(demoLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  await restoreSession();

  if (!getAuthSessionSnapshot()) {
    if (hasGuestLabAccess(demoLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (!hasLabAccess(demoLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function sandboxLoader({ request }: LoaderFunctionArgs) {
  if (currentAppEnv !== 'dev' && currentAppEnv !== 'test') {
    throw new Response('Not Found', { status: 404 });
  }

  await ensureAuthenticatedSession(request);

  return null;
}

function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return (
        <div className="rounded-block border border-warning-border bg-warning-bg p-6">
          <Typography.Title level={3}>访问被拒绝</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            当前路由已被访问控制规则拦截。
          </Typography.Paragraph>
        </div>
      );
    }

    if (error.status === 404) {
      return (
        <div className="rounded-block border border-border bg-bg-layout p-6">
          <Typography.Title level={3}>路由不存在</Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            当前环境下未暴露此路由。
          </Typography.Paragraph>
        </div>
      );
    }
  }

  return (
    <div className="rounded-block border border-error-border bg-error-bg p-6">
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

function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const authSession = useAuthSessionState();

  useEffect(() => {
    void restoreSession();
  }, []);

  if (authSession.status === 'restoring') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-layout">
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    Component: PublicEntryLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: RouteHydrateFallback,
    children: [
      {
        path: '/login',
        loader: loginRouteLoader,
        Component: LoginPage,
      },
      {
        path: '/forgot-password',
        Component: ForgotPasswordPage,
      },
      {
        path: '/invite/:inviteType/:verificationCode',
        Component: InviteIntentPage,
      },
      {
        path: '/verify/email/:verificationCode',
        Component: VerifyEmailIntentPage,
      },
      {
        path: '/reset-password/:verificationCode',
        Component: ResetPasswordIntentPage,
      },
      {
        path: '/magic-link/:verificationCode',
        Component: MagicLinkIntentPage,
      },
    ],
  },
  {
    Component: () => <AppLayout currentAppEnv={currentAppEnv} />,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: RouteHydrateFallback,
    children: [
      {
        path: '/',
        loader: protectedWorkbenchLoader,
        children: [
          {
            index: true,
            Component: HomePage,
          },
        ],
      },
      {
        path: '/labs',
        children: [
          {
            path: 'demo',
            loader: demoLabLoader,
            lazy: loadDemoLabRouteModule,
          },
        ],
      },
      {
        path: '/sandbox',
        children: [
          {
            path: 'playground',
            loader: sandboxLoader,
            lazy: loadSandboxPlaygroundRouteModule,
          },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <AuthBootstrapGate>
      <RouterProvider router={router} />
    </AuthBootstrapGate>
  );
}
