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
import { AcademicWorkloadPage } from '@/pages/academic-workload';
import { AcademicWorkloadDeductionSummaryPage } from '@/pages/academic-workload-deduction-summary';
import { AcademicWorkloadReportPage } from '@/pages/academic-workload-report';
import { AdminUserDetailPage } from '@/pages/admin-user-detail';
import { AdminUsersPage } from '@/pages/admin-users';
import { ErrorPreviewPage } from '@/pages/error-preview';
import { ExternalTeacherCompensationPage } from '@/pages/external-teacher-compensation';
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
import { StaffSemesterProfilesPage } from '@/pages/staff-semester-profiles';
import {
  InviteIntentPage,
  MagicLinkIntentPage,
  ResetPasswordIntentPage,
  VerifyEmailIntentPage,
  WelcomeBackResetPasswordIntentPage,
} from '@/pages/verification-intent';
import { VerificationIssuancePage } from '@/pages/verification-issuance';
import { WeeklyTimetablePage } from '@/pages/weekly-timetable';
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
  type AuthAccessGroup,
  canAccessPayloadCrypto,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicIntegratedPlanCorrectionsManagerAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasAcademicWorkloadAccess,
  hasAcademicWorkloadManagerAccess,
  hasAdminOrAcademicOfficerAccess,
  hasClassSyncAccess,
  hasMajorSyncAccess,
  hasStaffSemesterProfilesAccess,
} from '@/shared/auth-access';
import { sanitizeRedirectTarget } from '@/shared/navigation';

import { classSyncLabAccess, loadClassSyncLabRouteModule } from '@/labs/class-sync';
import { demoLabAccess, loadDemoLabRouteModule } from '@/labs/demo';
import { inviteIssuerLabAccess, loadInviteIssuerLabRouteModule } from '@/labs/invite-issuer';
import { loadMajorSyncLabRouteModule, majorSyncLabAccess } from '@/labs/major-sync';
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

function resolveSemesterTimetableViewerRole(input: {
  accessGroup: readonly AuthAccessGroup[];
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
  return navigationPageLoader(args, '/upstream-data-sync/semester-course-schedule-sync');
}

function legacySemesterCourseScheduleSyncRedirect({ request }: LoaderFunctionArgs) {
  const { url } = getRequestTarget(request);

  return redirect(`/upstream-data-sync/semester-course-schedule-sync${url.search}`);
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

async function weeklyTimetablePageLoader({ request }: LoaderFunctionArgs) {
  const snapshot = await ensureAuthenticatedSession(request);

  if (!snapshot) {
    return null;
  }

  if (
    !hasAcademicTimetableManagerAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    isForbidden: false,
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
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

async function majorSyncLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(majorSyncLabAccess)) {
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

    if (hasGuestLabAccess(majorSyncLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasMajorSyncAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  return null;
}

async function classSyncLabLoader({ request }: LoaderFunctionArgs) {
  if (!hasLabEnvExposure(classSyncLabAccess)) {
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

    if (hasGuestLabAccess(classSyncLabAccess)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasClassSyncAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
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

async function academicWorkloadPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  const accessGroup = snapshot.userInfo.accessGroup;
  const slotGroup = snapshot.slotGroup;

  if (
    !hasAcademicWorkloadAccess({
      accessGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const canManageWorkload = hasAcademicWorkloadManagerAccess({
    accessGroup,
    slotGroup,
  });

  return {
    canManageWorkload,
    defaultStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
  };
}

async function resolveAcademicWorkloadManagerScope(request: Request) {
  await restoreSession({ waitForPending: true });

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  const accessGroup = snapshot.userInfo.accessGroup;
  const slotGroup = snapshot.slotGroup;

  if (
    !hasAdminOrAcademicOfficerAccess({
      accessGroup,
      slotGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const canSelectWorkloadDepartment = accessGroup.includes('ADMIN');
  const defaultWorkloadDepartmentId =
    snapshot.identity?.kind === 'STAFF' ? snapshot.identity.departmentId : null;

  if (!canSelectWorkloadDepartment && !defaultWorkloadDepartmentId?.trim()) {
    throw new Response('Forbidden', { status: 403 });
  }

  return {
    canSelectWorkloadDepartment,
    defaultWorkloadDepartmentId,
  };
}

async function academicWorkloadReportPageLoader({ request }: LoaderFunctionArgs) {
  return resolveAcademicWorkloadManagerScope(request);
}

async function academicWorkloadDeductionSummaryPageLoader({ request }: LoaderFunctionArgs) {
  return resolveAcademicWorkloadManagerScope(request);
}

async function externalTeacherCompensationPageLoader({ request }: LoaderFunctionArgs) {
  return resolveAcademicWorkloadManagerScope(request);
}

async function staffSemesterProfilesPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasStaffSemesterProfilesAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  const accessGroup = snapshot.userInfo.accessGroup;
  const viewerRole = accessGroup.includes('ADMIN') ? 'admin' : 'academicOfficer';
  const defaultDepartmentId =
    snapshot.identity?.kind === 'STAFF' ? snapshot.identity.departmentId : null;

  if (viewerRole === 'academicOfficer' && !defaultDepartmentId?.trim()) {
    throw new Response('Forbidden', { status: 403 });
  }

  return {
    defaultDepartmentId,
    viewerRole,
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
        path: '/calendar-schedule/weekly-timetable',
        loader: weeklyTimetablePageLoader,
        Component: WeeklyTimetablePage,
      },
      {
        path: '/calendar-schedule/semester-timetable',
        loader: semesterTimetablePageLoader,
        Component: SemesterTimetablePage,
      },
      {
        path: '/academic-affairs/semester-course-schedule-sync',
        loader: legacySemesterCourseScheduleSyncRedirect,
      },
      {
        path: '/upstream-data-sync/semester-course-schedule-sync',
        loader: semesterCourseScheduleSyncPageLoader,
        Component: SemesterCourseScheduleSyncPage,
      },
      {
        path: '/academic-affairs/staff-semester-profiles',
        loader: staffSemesterProfilesPageLoader,
        Component: StaffSemesterProfilesPage,
      },
      {
        path: '/academic-affairs/academic-workload-report',
        loader: academicWorkloadReportPageLoader,
        Component: AcademicWorkloadReportPage,
      },
      {
        path: '/academic-affairs/academic-workload-deduction-summary',
        loader: academicWorkloadDeductionSummaryPageLoader,
        Component: AcademicWorkloadDeductionSummaryPage,
      },
      {
        path: '/academic-affairs/external-teacher-compensation',
        loader: externalTeacherCompensationPageLoader,
        Component: ExternalTeacherCompensationPage,
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
        path: '/academic-assistant/academic-workload',
        loader: academicWorkloadPageLoader,
        Component: AcademicWorkloadPage,
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
            path: 'academic-adjusted-workload-report',
            loader: () => redirect('/academic-affairs/external-teacher-compensation'),
          },
          {
            path: 'academic-workload-deduction-summary',
            loader: () => redirect('/academic-affairs/academic-workload-deduction-summary'),
          },
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
            path: 'major-sync',
            loader: majorSyncLabLoader,
            lazy: loadMajorSyncLabRouteModule,
          },
          {
            path: 'class-sync',
            loader: classSyncLabLoader,
            lazy: loadClassSyncLabRouteModule,
          },
          {
            path: 'upstream-session-demo',
            loader: upstreamSessionDemoLabLoader,
            lazy: loadUpstreamSessionDemoLabRouteModule,
          },
          {
            path: 'course-schedule-sync',
            loader: () => redirect('/upstream-data-sync/semester-course-schedule-sync'),
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
