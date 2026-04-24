// src/app/router/index.tsx

import { type ReactNode, useEffect, useRef } from 'react';
import { Spin } from 'antd';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  type LoaderFunctionArgs,
  redirect,
  RouterProvider,
  useNavigate,
  useRouteError,
} from 'react-router';

import { AppLayout, PublicEntryLayout } from '@/app/layout';
import { canAccessNavigationPath } from '@/app/navigation';

import { AcademicCalendarPage } from '@/pages/academic-calendar';
import { AdminUserDetailPage } from '@/pages/admin-user-detail';
import { AdminUsersPage } from '@/pages/admin-users';
import { ErrorPreviewPage } from '@/pages/error-preview';
import { ForgotPasswordPage } from '@/pages/forgot-password';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { ProfilePage } from '@/pages/profile';
import { SemesterCalendarPage } from '@/pages/semester-calendar';
import { SemesterCourseScheduleSyncPage } from '@/pages/semester-course-schedule-sync';
import {
  InviteIntentPage,
  MagicLinkIntentPage,
  ResetPasswordIntentPage,
  VerifyEmailIntentPage,
} from '@/pages/verification-intent';
import { WelcomePage } from '@/pages/welcome';
import {
  buildWelcomeRedirectTarget,
  getAuthSessionSnapshot,
  getAuthSessionState,
  hasAdminAccess,
  isAuthPendingSession,
  logout,
  readStoredAuthSession,
  resolveAuthenticatedRedirectTarget,
  resolveLoginRedirectTarget,
  resolveWelcomeRedirectTarget,
  restoreSession,
  useAuthSessionState,
} from '@/features/auth';
import { Error403, Error404, ErrorRouteCrash } from '@/features/error-feedback';

import { sanitizeRedirectTarget } from '@/shared/navigation';

import {
  academicTimetableLabAccess,
  loadAcademicTimetableLabRouteModule,
} from '@/labs/academic-timetable';
import {
  academicWorkloadLabAccess,
  loadAcademicWorkloadLabRouteModule,
} from '@/labs/academic-workload';
import {
  changeLoginEmailLabAccess,
  loadChangeLoginEmailLabRouteModule,
} from '@/labs/change-login-email';
import { demoLabAccess, loadDemoLabRouteModule } from '@/labs/demo';
import { inviteIssuerLabAccess, loadInviteIssuerLabRouteModule } from '@/labs/invite-issuer';
import { loadPayloadCryptoLabRouteModule, payloadCryptoLabAccess } from '@/labs/payload-crypto';
import {
  loadSemesterCalendarLabRouteModule,
  semesterCalendarLabAccess,
} from '@/labs/semester-calendar';
import {
  loadUpstreamSessionDemoLabRouteModule,
  upstreamSessionDemoLabAccess,
} from '@/labs/upstream-session-demo';
import { loadSandboxPlaygroundRouteModule } from '@/sandbox/playground';

const PUBLIC_PATH_PREFIXES = [
  '/forgot-password',
  '/invite/',
  '/login',
  '/magic-link/',
  '/reset-password',
  '/verify/',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

type AppEnv = 'dev' | 'test' | 'prod';
type AppAccessLevel = 'guest' | 'admin' | 'staff';
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

function getCurrentSessionAccessLevels(): AppAccessLevel[] {
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    return ['guest'];
  }

  const accessLevels: AppAccessLevel[] = [];

  if (snapshot.userInfo.accessGroup.includes('ADMIN')) {
    accessLevels.push('admin');
  }

  if (snapshot.userInfo.accessGroup.includes('STAFF')) {
    accessLevels.push('staff');
  }

  if (accessLevels.length === 0) {
    accessLevels.push('guest');
  }

  return accessLevels;
}

function hasLabAccess(access: LabAccess): boolean {
  const accessLevels = getCurrentSessionAccessLevels();
  const effectiveLabEnv = currentAppEnv === 'test' ? 'dev' : currentAppEnv;

  return (
    access.env.includes(effectiveLabEnv) &&
    access.allowedAccessLevels.some((allowedAccessLevel) =>
      accessLevels.includes(allowedAccessLevel),
    )
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

function hasHydratingSession() {
  const authState = getAuthSessionState();

  if (authState.status === 'hydrating') {
    return true;
  }

  return isAuthPendingSession(readStoredAuthSession());
}

async function loginRouteLoader({ request }: LoaderFunctionArgs) {
  const { url } = getRequestTarget(request);

  if (url.searchParams.get('skipRestore') !== '1') {
    if (hasHydratingSession()) {
      void restoreSession({ background: true });
    } else {
      await restoreSession();
    }
  }

  const snapshot = getAuthSessionSnapshot();

  if (snapshot) {
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

  if (hasHydratingSession()) {
    throw redirect(resolveLoginRedirectTarget(url.searchParams.get('redirect'), url.origin));
  }

  return null;
}

async function ensureAuthenticatedSession(
  request: Request,
  options: {
    allowIncomplete?: boolean;
  } = {},
) {
  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

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

async function adminUsersLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request);

  if (!snapshot) {
    return null;
  }

  if (!hasAdminAccess(snapshot)) {
    return {
      isForbidden: true,
    };
  }

  return {
    isForbidden: false,
  };
}

async function navigationPageLoader({ request }: LoaderFunctionArgs, path: string) {
  const snapshot = await ensureAuthenticatedSession(request);

  if (!snapshot) {
    return null;
  }

  if (
    !canAccessNavigationPath(path, {
      accountId: snapshot.accountId,
      primaryAccessGroup: snapshot.primaryAccessGroup,
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
      appEnv: currentAppEnv,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    isForbidden: false,
  };
}

async function errorPreviewLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/errors/preview');
}

async function academicCalendarPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/academic-affairs/academic-calendar');
}

async function semesterCalendarPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/academic-affairs/semester-calendar');
}

async function semesterCourseScheduleSyncPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/academic-affairs/semester-course-schedule-sync');
}

async function welcomeLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request, {
    allowIncomplete: true,
  });
  const { url } = getRequestTarget(request);

  if (!snapshot) {
    return null;
  }

  if (!snapshot.needsProfileCompletion) {
    throw redirect(resolveWelcomeRedirectTarget(url.searchParams.get('redirect'), url.origin));
  }

  return null;
}

async function demoLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(demoLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

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

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

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
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function inviteIssuerLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(inviteIssuerLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(inviteIssuerLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(inviteIssuerLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function changeLoginEmailLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(changeLoginEmailLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(changeLoginEmailLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(changeLoginEmailLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function upstreamSessionDemoLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(upstreamSessionDemoLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(upstreamSessionDemoLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(upstreamSessionDemoLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function semesterCalendarLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(semesterCalendarLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(semesterCalendarLabAccess)) {
      return { viewerKind: 'guest' };
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(semesterCalendarLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;

  return {
    viewerKind:
      accessGroup.includes('ADMIN') || accessGroup.includes('STAFF')
        ? 'internal'
        : accessGroup.includes('GUEST')
          ? 'guest'
          : 'authenticated',
  };
}

async function academicTimetableLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(academicTimetableLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(academicTimetableLabAccess)) {
      return { viewerKind: 'authenticated' };
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(academicTimetableLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    viewerKind:
      accessGroup.includes('ADMIN') || accessGroup.includes('STAFF') ? 'internal' : 'authenticated',
  };
}

async function academicWorkloadLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(academicWorkloadLabAccess)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession()) {
      return null;
    }

    if (hasGuestLabAccess(academicWorkloadLabAccess)) {
      return { viewerKind: 'authenticated' };
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(academicWorkloadLabAccess)) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    viewerKind:
      accessGroup.includes('ADMIN') || accessGroup.includes('STAFF') ? 'internal' : 'authenticated',
  };
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
  const navigate = useNavigate();

  const handleRelogin = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (isRouteErrorResponse(error)) {
    if (error.status === 403) {
      return <Error403 onRelogin={handleRelogin} />;
    }

    if (error.status === 404) {
      return <Error404 />;
    }
  }

  return <ErrorRouteCrash />;
}

function PublicRouteErrorPage() {
  return (
    <PublicEntryLayout>
      <RouteErrorPage />
    </PublicEntryLayout>
  );
}

function AppRouteErrorPage() {
  return (
    <AppLayout currentAppEnv={currentAppEnv}>
      <RouteErrorPage />
    </AppLayout>
  );
}

function RouteHydrateFallback() {
  return null;
}

function AuthBootstrapGate({ children }: { children: ReactNode }) {
  const authSession = useAuthSessionState();
  const prevStatusRef = useRef(authSession.status);
  const isCurrentPathPublic =
    typeof window !== 'undefined' ? isPublicPath(window.location.pathname) : false;

  useEffect(() => {
    if (authSession.status === 'restoring' && !isCurrentPathPublic) {
      void restoreSession({ background: true });
    }
  }, [authSession.status, isCurrentPathPublic]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = authSession.status;

    if (prevStatus !== 'unauthenticated' && authSession.status === 'unauthenticated') {
      if (!isPublicPath(window.location.pathname)) {
        const currentPath = sanitizeRedirectTarget(
          `${window.location.pathname}${window.location.search}${window.location.hash}`,
        );

        window.location.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
      }
    }
  }, [authSession.status]);

  if (authSession.status === 'restoring' && !isCurrentPathPublic) {
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
    ErrorBoundary: PublicRouteErrorPage,
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
    ErrorBoundary: AppRouteErrorPage,
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
        path: '/profile',
        loader: protectedWorkbenchLoader,
        Component: ProfilePage,
      },
      {
        path: '/admin/users',
        loader: adminUsersLoader,
        Component: AdminUsersPage,
      },
      {
        path: '/admin/users/:id',
        loader: adminUsersLoader,
        Component: AdminUserDetailPage,
      },
      {
        path: '/errors/preview',
        loader: errorPreviewLoader,
        Component: ErrorPreviewPage,
      },
      {
        path: '/academic-affairs/academic-calendar',
        loader: academicCalendarPageLoader,
        Component: AcademicCalendarPage,
      },
      {
        path: '/academic-affairs/semester-calendar',
        loader: semesterCalendarPageLoader,
        Component: SemesterCalendarPage,
      },
      {
        path: '/academic-affairs/semester-course-schedule-sync',
        loader: semesterCourseScheduleSyncPageLoader,
        Component: SemesterCourseScheduleSyncPage,
      },
      {
        path: '/admin/error-preview',
        loader: () => redirect('/errors/preview'),
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
          {
            path: 'invite-issuer',
            loader: inviteIssuerLabLoader,
            lazy: loadInviteIssuerLabRouteModule,
          },
          {
            path: 'change-login-email',
            loader: changeLoginEmailLabLoader,
            lazy: loadChangeLoginEmailLabRouteModule,
          },
          {
            path: 'upstream-session-demo',
            loader: upstreamSessionDemoLabLoader,
            lazy: loadUpstreamSessionDemoLabRouteModule,
          },
          {
            path: 'semester-calendar',
            loader: semesterCalendarLabLoader,
            lazy: loadSemesterCalendarLabRouteModule,
          },
          {
            path: 'academic-timetable',
            loader: academicTimetableLabLoader,
            lazy: loadAcademicTimetableLabRouteModule,
          },
          {
            path: 'academic-workload',
            loader: academicWorkloadLabLoader,
            lazy: loadAcademicWorkloadLabRouteModule,
          },
          {
            path: 'course-schedule-sync',
            loader: () => redirect('/academic-affairs/semester-course-schedule-sync'),
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
      {
        path: '*',
        Component: Error404,
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
