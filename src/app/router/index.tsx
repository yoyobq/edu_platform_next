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
import { WelcomePage } from '@/pages/welcome';
import {
  getAuthSessionSnapshot,
  hasAdminAccess,
  restoreSession,
  useAuthSessionState,
} from '@/features/auth';

import {
  buildWelcomeRedirectTarget,
  resolveAuthenticatedRedirectTarget,
  resolveWelcomeRedirectTarget,
  sanitizeRedirectTarget,
} from '@/shared/navigation';

import { demoLabAccess, loadDemoLabRouteModule } from '@/labs/demo';
import { loadPayloadCryptoLabRouteModule, payloadCryptoLabAccess } from '@/labs/payload-crypto';
import { loadSandboxPlaygroundRouteModule } from '@/sandbox/playground';

type AppEnv = 'dev' | 'test' | 'prod';
type AppAccessLevel = 'guest' | 'admin';
type LabAccess = {
  allowedAccessLevels: readonly AppAccessLevel[];
  env: readonly ('dev' | 'prod')[];
};

function getCurrentAppEnv(): AppEnv {
  const configuredAppEnv = import.meta.env.VITE_APP_ENV;

  if (configuredAppEnv === 'dev' || configuredAppEnv === 'test' || configuredAppEnv === 'prod') {
    return configuredAppEnv;
  }

  return import.meta.env.DEV ? 'dev' : 'prod';
}

const currentAppEnv = getCurrentAppEnv();

function getCurrentSessionAccessLevel(): AppAccessLevel {
  const snapshot = getAuthSessionSnapshot();

  return hasAdminAccess(snapshot) ? 'admin' : 'guest';
}

function hasLabAccess(access: LabAccess): boolean {
  const accessLevel = getCurrentSessionAccessLevel();
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;

  return (
    access.env.includes(effectiveLabEnv) &&
    access.allowedAccessLevels.some((allowedAccessLevel) => allowedAccessLevel === accessLevel)
  );
}

function hasLabEnvExposure(access: LabAccess): boolean {
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;

  return access.env.includes(effectiveLabEnv);
}

function hasGuestLabAccess(access: LabAccess): boolean {
  return access.allowedAccessLevels.includes('guest');
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

function buildWelcomeRedirectURL(request: Request) {
  const { redirectTarget, url } = getRequestTarget(request);

  return buildWelcomeRedirectTarget(redirectTarget, url.origin);
}

async function loginRouteLoader({ request }: LoaderFunctionArgs) {
  await restoreSession();

  const snapshot = getAuthSessionSnapshot();

  if (snapshot) {
    const { url } = getRequestTarget(request);

    throw redirect(
      resolveAuthenticatedRedirectTarget(
        url.searchParams.get('redirect'),
        {
          needsProfileCompletion: snapshot.needsProfileCompletion,
        },
        url.origin,
      ),
    );
  }

  return null;
}

async function ensureAuthenticatedSession(
  request: Request,
  options: {
    allowIncomplete?: boolean;
  } = {},
) {
  await restoreSession();

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion && !options.allowIncomplete) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  return snapshot;
}

async function protectedWorkbenchLoader({ request }: LoaderFunctionArgs) {
  await ensureAuthenticatedSession(request);

  return null;
}

async function welcomeLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request, {
    allowIncomplete: true,
  });
  const { url } = getRequestTarget(request);

  if (!snapshot.needsProfileCompletion) {
    throw redirect(resolveWelcomeRedirectTarget(url.searchParams.get('redirect'), url.origin));
  }

  return null;
}

async function demoLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(demoLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  await restoreSession();
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasGuestLabAccess(demoLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(demoLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function payloadCryptoLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(payloadCryptoLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  await restoreSession();

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasGuestLabAccess(payloadCryptoLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  // 硬编码验证：只有 (accountId 是 1 或者 2) 且 (accessGroup 里有 ADMIN 项) 的用户才可以进入
  const hasSpecificAccess =
    (snapshot.accountId === 1 || snapshot.accountId === 2) && hasAdminAccess(snapshot);

  if (!hasSpecificAccess) {
    throw new Response('Not Found', { status: 404 });
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
        path: '/reset-password',
        Component: ResetPasswordIntentPage,
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
        path: '/welcome',
        loader: welcomeLoader,
        Component: WelcomePage,
      },
      {
        path: '/labs',
        children: [
          {
            path: 'demo',
            loader: demoLabLoader,
            lazy: loadDemoLabRouteModule,
          },
          {
            path: 'payload-crypto',
            loader: payloadCryptoLabLoader,
            lazy: loadPayloadCryptoLabRouteModule,
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
