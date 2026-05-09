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
import { IntegratedPlanCorrectionsPage } from '@/pages/integrated-plan-corrections';
import { LoginPage } from '@/pages/login';
import { MyTeachingLogsPage } from '@/pages/my-teaching-logs';
import { loadPayloadCryptoRouteModule } from '@/pages/payload-crypto';
import { ProfilePage } from '@/pages/profile';
import { SemesterCalendarPage } from '@/pages/semester-calendar';
import { SemesterCourseScheduleSyncPage } from '@/pages/semester-course-schedule-sync';
import { SemesterTimetablePage } from '@/pages/semester-timetable';
import {
  InviteIntentPage,
  MagicLinkIntentPage,
  ResetPasswordIntentPage,
  VerifyEmailIntentPage,
  WelcomeBackResetPasswordIntentPage,
} from '@/pages/verification-intent';
import { VerificationIssuancePage } from '@/pages/verification-issuance';
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

import {
  type AcademicInternalViewerRole,
  type AcademicViewerRole,
  canAccessPayloadCrypto,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicIntegratedPlanCorrectionsManagerAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasStaffSemesterProfilesAccess,
} from '@/shared/auth-access';
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
import {
  loadStaffSemesterProfilesLabRouteModule,
  staffSemesterProfilesLabAccess,
} from '@/labs/staff-semester-profiles';
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
  '/welcome-back/reset-password',
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

function resolveAcademicInternalViewerRole(
  accessGroup: readonly string[],
): AcademicInternalViewerRole {
  return accessGroup.includes('ADMIN') ? 'admin' : 'staff';
}

function resolveSemesterTimetableViewerRole(input: {
  accessGroup: readonly string[];
  slotGroup: readonly string[];
}): AcademicInternalViewerRole {
  return hasAcademicTimetableManagerAccess(input) ? 'admin' : 'staff';
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
  return navigationPageLoader(args, '/calendar-schedule/semester-calendar');
}

async function semesterCourseScheduleSyncPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/academic-affairs/semester-course-schedule-sync');
}

async function semesterTimetablePageLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request);

  if (!snapshot) {
    return null;
  }

  if (
    !hasAcademicTimetableAccess({
      accessGroup: snapshot.userInfo.accessGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    isForbidden: false,
    viewerRole: resolveSemesterTimetableViewerRole({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    }),
  };
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

async function payloadCryptoPageLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request);

  if (!snapshot) {
    return null;
  }

  if (
    !canAccessPayloadCrypto({
      accountId: snapshot.accountId,
      accessGroup: snapshot.userInfo.accessGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    accountId: snapshot.accountId,
    isForbidden: false,
  };
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

async function integratedPlanCorrectionsPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  const accessGroup = snapshot.userInfo.accessGroup;

  if (
    !hasAcademicIntegratedPlanCorrectionsAccess({
      accessGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const hasManagerAccess = hasAcademicIntegratedPlanCorrectionsManagerAccess({
    accessGroup,
    slotGroup: snapshot.slotGroup,
  });
  const isStaff = accessGroup.includes('STAFF');
  const viewerRole: AcademicViewerRole = hasManagerAccess
    ? 'admin'
    : isStaff
      ? 'staff'
      : 'authenticated';

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    viewerRole,
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
    viewerRole: resolveAcademicInternalViewerRole(accessGroup),
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
    defaultDepartmentId:
      snapshot.identity?.kind === 'STAFF' ? snapshot.identity.departmentId : null,
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    viewerRole: resolveAcademicInternalViewerRole(accessGroup),
    viewerKind:
      accessGroup.includes('ADMIN') || accessGroup.includes('STAFF') ? 'internal' : 'authenticated',
  };
}

async function staffSemesterProfilesLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(staffSemesterProfilesLabAccess)) {
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

    if (hasGuestLabAccess(staffSemesterProfilesLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasLabAccess(staffSemesterProfilesLabAccess) ||
    !hasStaffSemesterProfilesAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;
  const slotGroup = snapshot.slotGroup;

  return {
    defaultDepartmentId:
      snapshot.identity?.kind === 'STAFF' ? snapshot.identity.departmentId : null,
    viewerRole: accessGroup.includes('ADMIN')
      ? 'admin'
      : slotGroup.includes('ACADEMIC_OFFICER')
        ? 'academicOfficer'
        : 'teachingGroupLeader',
  };
}

async function myTeachingLogsPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasAcademicTeachingLogAccess({
      accessGroup: snapshot.userInfo.accessGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;
  const hasManagerAccess = hasAcademicTeachingLogManagerAccess({
    accessGroup,
    slotGroup: snapshot.slotGroup,
  });
  const viewerRole: AcademicViewerRole = hasManagerAccess
    ? 'admin'
    : snapshot.identity?.kind === 'STAFF'
      ? 'staff'
      : 'authenticated';

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    viewerRole,
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
        path: '/welcome-back/reset-password',
        Component: WelcomeBackResetPasswordIntentPage,
      },
      {
        path: '/welcome-back/reset-password/:verificationCode',
        Component: WelcomeBackResetPasswordIntentPage,
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
        path: '/admin/verification-issuance',
        loader: adminUsersLoader,
        Component: VerificationIssuancePage,
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
        loader: () => redirect('/calendar-schedule/semester-calendar'),
      },
      {
        path: '/calendar-schedule/semester-calendar',
        loader: semesterCalendarPageLoader,
        Component: SemesterCalendarPage,
      },
      {
        path: '/calendar-schedule/semester-timetable',
        loader: semesterTimetablePageLoader,
        Component: SemesterTimetablePage,
      },
      {
        path: '/academic-affairs/semester-course-schedule-sync',
        loader: semesterCourseScheduleSyncPageLoader,
        Component: SemesterCourseScheduleSyncPage,
      },
      {
        path: '/academic-affairs/my-teaching-logs',
        loader: myTeachingLogsPageLoader,
        Component: MyTeachingLogsPage,
      },
      {
        path: '/academic-affairs/integrated-plan-corrections',
        loader: integratedPlanCorrectionsPageLoader,
        Component: IntegratedPlanCorrectionsPage,
      },
      {
        path: '/admin/error-preview',
        loader: () => redirect('/errors/preview'),
      },
      {
        path: '/system/payload-crypto',
        loader: payloadCryptoPageLoader,
        lazy: loadPayloadCryptoRouteModule,
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
            path: 'staff-semester-profiles',
            loader: staffSemesterProfilesLabLoader,
            lazy: loadStaffSemesterProfilesLabRouteModule,
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
