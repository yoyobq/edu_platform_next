// src/app/router/index.tsx

import { type ComponentType, type ReactNode, useEffect, useRef } from 'react';
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

import { AppLayout, ExamStandaloneLayout, PublicEntryLayout } from '@/app/layout';
import { canAccessNavigationPath } from '@/app/navigation';

import { HomePage } from '@/pages/home';
import { loadPayloadCryptoRouteModule } from '@/pages/payload-crypto';
import {
  type AuthSessionSnapshot,
  buildWelcomeRedirectTarget,
  getAuthSessionSnapshot,
  getAuthSessionState,
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
  ACADEMIC_OFFICER_SLOT_GROUP,
  type AcademicInternalViewerRole,
  type AcademicViewerRole,
  type AuthAccessGroup,
  canAccessPayloadCrypto,
  CLASS_ADVISER_SLOT_GROUP,
  COUNSELOR_SLOT_GROUP,
  hasAcademicCalendarManagementAccess,
  hasAcademicCurriculumPlanHomepageAccess,
  hasAcademicIntegratedPlanCorrectionsAccess,
  hasAcademicIntegratedPlanCorrectionsManagerAccess,
  hasAcademicTeachingLogAccess,
  hasAcademicTeachingLogManagerAccess,
  hasAcademicTimetableAccess,
  hasAcademicTimetableManagerAccess,
  hasAcademicWorkloadAccess,
  hasAcademicWorkloadManagerAccess,
  hasAdminAccess,
  hasClassAdviserGovernanceAccess,
  hasClassAffairsCourseResultsAccess,
  hasStaffSemesterProfilesAccess,
  hasStudentConductAlignmentAccess,
  hasStudentProfileFilingAccess,
  hasStudentRosterMembershipReconciliationAccess,
  resolveClassAdviserGovernanceDepartmentScope,
  resolveUpstreamLoginLockedUserId,
} from '@/entities/auth-access';

import { sanitizeRedirectTarget } from '@/shared/navigation';

import { demoLabAccess, loadDemoLabRouteModule } from '@/labs/demo';
import { inviteIssuerLabAccess, loadInviteIssuerLabRouteModule } from '@/labs/invite-issuer';
import {
  loadMyTeachingPlanLabRouteModule,
  myTeachingPlanLabAccess,
  type MyTeachingPlanLabLoaderData,
} from '@/labs/my-teaching-plan';
import {
  loadStudentEvaluationCommentLabRouteModule,
  studentEvaluationCommentLabAccess,
  type StudentEvaluationCommentLabLoaderData,
} from '@/labs/student-evaluation-comment';
import {
  loadStudentEvaluationCommentWorkbenchLabRouteModule,
  studentEvaluationCommentWorkbenchLabAccess,
  type StudentEvaluationCommentWorkbenchLoaderData,
} from '@/labs/student-evaluation-comment-workbench';
import {
  loadStudentPrivateProfileLabRouteModule,
  studentPrivateProfileLabAccess,
} from '@/labs/student-private-profile';
import {
  loadUpstreamSessionDemoLabRouteModule,
  upstreamSessionDemoLabAccess,
} from '@/labs/upstream-session-demo';
import {
  loadUpstreamSessionReferenceLabRouteModule,
  upstreamSessionReferenceLabAccess,
} from '@/labs/upstream-session-reference';
import {
  loadZquizActivityBuilderLabRouteModule,
  zquizActivityBuilderLabAccess,
} from '@/labs/zquiz-activity-builder';
import {
  loadZquizExamActivitiesLabRouteModule,
  loadZquizExamPaperLabRouteModule,
  zquizExamActivitiesLabAccess,
} from '@/labs/zquiz-exam-activities';
import {
  loadZquizExamTeacherGradebookLabRouteModule,
  zquizExamTeacherGradebookLabAccess,
} from '@/labs/zquiz-exam-teacher-gradebook';
import {
  loadZquizPracticeActivitiesLabRouteModule,
  zquizPracticeActivitiesLabAccess,
} from '@/labs/zquiz-practice-activities';
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
type AppAccessLevel = 'guest' | 'admin' | 'staff' | 'student';
type LabAccess = {
  allowedAccessLevels: readonly AppAccessLevel[];
  env: readonly ('dev' | 'prod')[];
};

type PageRouteModule<ComponentName extends string> = Record<ComponentName, ComponentType>;

function loadPageRouteModule<ComponentName extends string>(
  importPage: () => Promise<PageRouteModule<ComponentName>>,
  componentName: ComponentName,
) {
  return async () => {
    const pageRouteModule = await importPage();

    return {
      Component: pageRouteModule[componentName],
    };
  };
}

function getCurrentAppEnv(): AppEnv {
  const configuredAppEnv = import.meta.env.VITE_APP_ENV;

  if (configuredAppEnv === 'dev' || configuredAppEnv === 'test' || configuredAppEnv === 'prod') {
    return configuredAppEnv;
  }

  return import.meta.env.DEV ? 'dev' : 'prod';
}

const currentAppEnv = getCurrentAppEnv();

const loadLoginRouteModule = loadPageRouteModule(() => import('@/pages/login'), 'LoginPage');
const loadForgotPasswordRouteModule = loadPageRouteModule(
  () => import('@/pages/forgot-password'),
  'ForgotPasswordPage',
);
const loadResetPasswordIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'ResetPasswordIntentPage',
);
const loadStudentRegistrationRouteModule = loadPageRouteModule(
  () => import('@/pages/student-registration'),
  'StudentRegistrationPage',
);
const loadInviteIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'InviteIntentPage',
);
const loadVerifyAccountEmailIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'VerifyAccountEmailIntentPage',
);
const loadVerifyEmailIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'VerifyEmailIntentPage',
);
const loadWelcomeBackResetPasswordIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'WelcomeBackResetPasswordIntentPage',
);
const loadMagicLinkIntentRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-intent'),
  'MagicLinkIntentPage',
);
const loadWelcomeRouteModule = loadPageRouteModule(() => import('@/pages/welcome'), 'WelcomePage');
const loadProfileRouteModule = loadPageRouteModule(() => import('@/pages/profile'), 'ProfilePage');
const loadAdminUsersRouteModule = loadPageRouteModule(
  () => import('@/pages/admin-users'),
  'AdminUsersPage',
);
const loadAdminUserDetailRouteModule = loadPageRouteModule(
  () => import('@/pages/admin-user-detail'),
  'AdminUserDetailPage',
);
const loadVerificationIssuanceRouteModule = loadPageRouteModule(
  () => import('@/pages/verification-issuance'),
  'VerificationIssuancePage',
);
const loadErrorPreviewRouteModule = loadPageRouteModule(
  () => import('@/pages/error-preview'),
  'ErrorPreviewPage',
);
const loadAcademicCalendarRouteModule = loadPageRouteModule(
  () => import('@/pages/academic-calendar'),
  'AcademicCalendarPage',
);
const loadSemesterCalendarRouteModule = loadPageRouteModule(
  () => import('@/pages/semester-calendar'),
  'SemesterCalendarPage',
);
const loadWeeklyTimetableRouteModule = loadPageRouteModule(
  () => import('@/pages/weekly-timetable'),
  'WeeklyTimetablePage',
);
const loadSemesterTimetableRouteModule = loadPageRouteModule(
  () => import('@/pages/semester-timetable'),
  'SemesterTimetablePage',
);
const loadMajorSyncRouteModule = loadPageRouteModule(
  () => import('@/pages/major-sync'),
  'MajorSyncPage',
);
const loadClassSyncRouteModule = loadPageRouteModule(
  () => import('@/pages/class-sync'),
  'ClassSyncPage',
);
const loadSemesterCourseScheduleSyncRouteModule = loadPageRouteModule(
  () => import('@/pages/semester-course-schedule-sync'),
  'SemesterCourseScheduleSyncPage',
);
const loadStaffSemesterProfilesRouteModule = loadPageRouteModule(
  () => import('@/pages/staff-semester-profiles'),
  'StaffSemesterProfilesPage',
);
const loadAcademicWorkloadReportRouteModule = loadPageRouteModule(
  () => import('@/pages/academic-workload-report'),
  'AcademicWorkloadReportPage',
);
const loadAcademicWorkloadDeductionSummaryRouteModule = loadPageRouteModule(
  () => import('@/pages/academic-workload-deduction-summary'),
  'AcademicWorkloadDeductionSummaryPage',
);
const loadExternalTeacherCompensationRouteModule = loadPageRouteModule(
  () => import('@/pages/external-teacher-compensation'),
  'ExternalTeacherCompensationPage',
);
const loadMyTeachingLogsRouteModule = loadPageRouteModule(
  () => import('@/pages/my-teaching-logs'),
  'MyTeachingLogsPage',
);
const loadMyCurriculumPlanHomepageRouteModule = loadPageRouteModule(
  () => import('@/pages/my-curriculum-plan-homepage'),
  'MyCurriculumPlanHomepagePage',
);
const loadIntegratedPlanCorrectionsRouteModule = loadPageRouteModule(
  () => import('@/pages/integrated-plan-corrections'),
  'IntegratedPlanCorrectionsPage',
);
const loadClassAdviserGovernanceRouteModule = loadPageRouteModule(
  () => import('@/pages/class-adviser-governance'),
  'ClassAdviserGovernancePage',
);
const loadStudentRosterMembershipReconciliationRouteModule = loadPageRouteModule(
  () => import('@/pages/student-roster-membership-reconciliation'),
  'StudentRosterMembershipReconciliationPage',
);
const loadStudentProfileFilingRouteModule = loadPageRouteModule(
  () => import('@/pages/student-profile-filing'),
  'StudentProfileFilingPage',
);
const loadStudentConductAlignmentRouteModule = loadPageRouteModule(
  () => import('@/pages/student-conduct-alignment'),
  'StudentConductAlignmentPage',
);
const loadClassAffairsCourseResultsRouteModule = loadPageRouteModule(
  () => import('@/pages/class-affairs-course-results'),
  'ClassAffairsCourseResultsPage',
);
const loadAcademicWorkloadRouteModule = loadPageRouteModule(
  () => import('@/pages/academic-workload'),
  'AcademicWorkloadPage',
);

// Lab access.ts uses coarse levels; router projects current auth groups into those levels.
function getCurrentSessionLabAccessLevels(): AppAccessLevel[] {
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

  if (snapshot.userInfo.accessGroup.includes('STUDENT')) {
    accessLevels.push('student');
  }

  if (accessLevels.length === 0) {
    accessLevels.push('guest');
  }

  return accessLevels;
}

function hasLabAccess(access: LabAccess): boolean {
  const accessLevels = getCurrentSessionLabAccessLevels();
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

type LabRouteLoaderOptions<TData> = {
  access: LabAccess;
  canAccess?: (snapshot: AuthSessionSnapshot) => boolean;
  getData?: (snapshot: AuthSessionSnapshot) => TData;
  request: Request;
};

async function loadLabRoute<TData = null>({
  access,
  canAccess,
  getData,
  request,
}: LabRouteLoaderOptions<TData>) {
  if (!hasLabEnvExposure(access)) {
    throw new Response('Not Found', { status: 404 });
  }

  if (hasHydratingSession() && !hasGuestLabAccess(access)) {
    await restoreSession({ waitForPending: true });
  } else if (hasHydratingSession()) {
    void restoreSession({ background: true });
  } else {
    await restoreSession();
  }

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    if (hasHydratingSession() && hasGuestLabAccess(access)) {
      return null;
    }

    if (hasGuestLabAccess(access)) {
      return null;
    }

    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (!hasLabAccess(access) || (canAccess && !canAccess(snapshot))) {
    throw new Response('Forbidden', { status: 403 });
  }

  return getData?.(snapshot) ?? null;
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

  if (authState.status !== 'restoring') {
    return false;
  }

  return isAuthPendingSession(readStoredAuthSession());
}

function hasSessionRestoreFailure() {
  const authState = getAuthSessionState();

  return authState.status === 'unauthenticated' && Boolean(authState.lastError);
}

async function loginRouteLoader({ request }: LoaderFunctionArgs) {
  const { url } = getRequestTarget(request);

  if (url.searchParams.get('skipRestore') !== '1' && !hasSessionRestoreFailure()) {
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

  if (
    !hasAdminAccess({
      accessGroup: snapshot.userInfo.accessGroup,
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

async function majorSyncPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/upstream-data-sync/major-sync');
}

async function classSyncPageLoader(args: LoaderFunctionArgs) {
  return navigationPageLoader(args, '/upstream-data-sync/class-sync');
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
    lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    }),
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

async function inviteIntentLoader({ params }: LoaderFunctionArgs) {
  if (params.inviteType?.trim().toLowerCase() === 'student') {
    throw new Response('Not Found', { status: 404 });
  }

  return null;
}

async function demoLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: demoLabAccess,
    request,
  });
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
  return loadLabRoute({
    access: inviteIssuerLabAccess,
    request,
  });
}

function resolveMyTeachingPlanLabData(snapshot: AuthSessionSnapshot): MyTeachingPlanLabLoaderData {
  const staffIdentity = snapshot.identity?.kind === 'STAFF' ? snapshot.identity : null;

  return {
    canManage: hasAcademicTimetableManagerAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    }),
    currentAccountId: snapshot.accountId,
    currentStaff: staffIdentity
      ? {
          displayName: snapshot.displayName,
          staffId: staffIdentity.id,
        }
      : null,
  };
}

async function myTeachingPlanLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: myTeachingPlanLabAccess,
    getData: resolveMyTeachingPlanLabData,
    request,
  });
}

async function upstreamSessionDemoLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: upstreamSessionDemoLabAccess,
    request,
  });
}

async function upstreamSessionReferenceLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: upstreamSessionReferenceLabAccess,
    getData: (snapshot) => ({
      currentAccount: {
        accountId: snapshot.accountId,
        displayName: snapshot.displayName,
      },
    }),
    request,
  });
}

function resolveStudentEvaluationCommentLabData(
  snapshot: AuthSessionSnapshot,
): StudentEvaluationCommentLabLoaderData {
  const isAdmin = snapshot.userInfo.accessGroup.includes('ADMIN');
  const isStaff = snapshot.userInfo.accessGroup.includes('STAFF');
  const isClassAdviser = isStaff && snapshot.slotGroup.includes(CLASS_ADVISER_SLOT_GROUP);
  const isCounselor = isStaff && snapshot.slotGroup.includes(COUNSELOR_SLOT_GROUP);
  const canEditClassScope = isAdmin || isClassAdviser || isCounselor;

  return {
    canEditClassScope,
    currentAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
      lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
        accessGroup: snapshot.userInfo.accessGroup,
        slotGroup: snapshot.slotGroup,
        staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
      }),
    },
    defaultView: canEditClassScope ? 'class-scope' : 'mine',
  };
}

async function studentEvaluationCommentLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: studentEvaluationCommentLabAccess,
    getData: resolveStudentEvaluationCommentLabData,
    request,
  });
}

function resolveStudentEvaluationCommentWorkbenchLabData(
  snapshot: AuthSessionSnapshot,
): StudentEvaluationCommentWorkbenchLoaderData {
  return {
    currentAccount: resolveStudentEvaluationCommentLabData(snapshot).currentAccount,
  };
}

async function studentEvaluationCommentWorkbenchLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: studentEvaluationCommentWorkbenchLabAccess,
    getData: resolveStudentEvaluationCommentWorkbenchLabData,
    request,
  });
}

function resolveStudentPrivateProfileLockedUpstreamLoginUserId(snapshot: AuthSessionSnapshot) {
  if (snapshot.userInfo.accessGroup.includes('ADMIN')) {
    return null;
  }

  if (
    snapshot.userInfo.accessGroup.includes('STAFF') &&
    snapshot.slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP)
  ) {
    return null;
  }

  return snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null;
}

function resolveStudentPrivateProfileManualPatchAccess(snapshot: AuthSessionSnapshot) {
  const accessGroup = snapshot.userInfo.accessGroup;
  const slotGroup = snapshot.slotGroup;
  const isAdmin = accessGroup.includes('ADMIN');
  const isAcademicOfficer =
    accessGroup.includes('STAFF') && slotGroup.includes(ACADEMIC_OFFICER_SLOT_GROUP);
  const isClassCareStaff =
    accessGroup.includes('STAFF') &&
    (slotGroup.includes(CLASS_ADVISER_SLOT_GROUP) || slotGroup.includes(COUNSELOR_SLOT_GROUP));
  const hasLocalStudentPatchAccess = isAdmin || isAcademicOfficer || isClassCareStaff;

  return {
    contactAndAddress: hasLocalStudentPatchAccess,
    family: hasLocalStudentPatchAccess,
    sensitiveIdentifiers: isAdmin || isAcademicOfficer,
  };
}

async function studentPrivateProfileLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: studentPrivateProfileLabAccess,
    getData: (snapshot) => ({
      currentAccount: {
        accountId: snapshot.accountId,
        displayName: snapshot.displayName,
      },
      lockedUpstreamLoginUserId: resolveStudentPrivateProfileLockedUpstreamLoginUserId(snapshot),
      manualPatchAccess: resolveStudentPrivateProfileManualPatchAccess(snapshot),
    }),
    request,
  });
}

async function zquizPracticeActivitiesLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: zquizPracticeActivitiesLabAccess,
    request,
  });
}

async function zquizExamActivitiesLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: zquizExamActivitiesLabAccess,
    request,
  });
}

async function zquizExamTeacherGradebookLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: zquizExamTeacherGradebookLabAccess,
    request,
  });
}

async function zquizActivityBuilderLabLoader({ request }: LoaderFunctionArgs) {
  return loadLabRoute({
    access: zquizActivityBuilderLabAccess,
    request,
  });
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
    lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
      accessGroup,
      context: 'academicStaffManager',
      slotGroup: snapshot.slotGroup,
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    }),
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    viewerRole,
  };
}

async function studentRosterMembershipReconciliationPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasStudentRosterMembershipReconciliationAccess({
      accessGroup: snapshot.userInfo.accessGroup,
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

async function classAdviserGovernancePageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasClassAdviserGovernanceAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  const departmentScope = resolveClassAdviserGovernanceDepartmentScope({
    accessGroup: snapshot.userInfo.accessGroup,
    staffDepartmentId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.departmentId : null,
  });

  if (departmentScope.isForbidden) {
    return {
      isForbidden: true,
    };
  }

  return {
    canSelectDepartment: departmentScope.canSelectDepartment,
    currentAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    defaultDepartmentId: departmentScope.defaultDepartmentId,
    identityStaffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    isForbidden: false,
    slotGroup: snapshot.slotGroup,
    userAccessGroup: snapshot.userInfo.accessGroup,
  };
}

async function classAffairsCourseResultsPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasClassAffairsCourseResultsAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    return { isForbidden: true };
  }

  return {
    currentAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
      lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
        accessGroup: snapshot.userInfo.accessGroup,
        slotGroup: snapshot.slotGroup,
        staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
      }),
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    },
    isForbidden: false,
  };
}

async function studentProfileFilingPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasStudentProfileFilingAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    currentAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
      lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
        accessGroup: snapshot.userInfo.accessGroup,
        slotGroup: snapshot.slotGroup,
        staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
      }),
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    },
    isForbidden: false,
  };
}

async function studentConductAlignmentPageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });
  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasStudentConductAlignmentAccess({
      accessGroup: snapshot.userInfo.accessGroup,
      slotGroup: snapshot.slotGroup,
    })
  ) {
    return {
      isForbidden: true,
    };
  }

  return {
    currentAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
      lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
        accessGroup: snapshot.userInfo.accessGroup,
        slotGroup: snapshot.slotGroup,
        staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
      }),
    },
    isForbidden: false,
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
    lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
      accessGroup,
      context: 'academicStaffManager',
      slotGroup,
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    }),
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
    !hasAcademicCalendarManagementAccess({
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
    lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
      accessGroup,
      context: 'academicStaffManager',
      slotGroup: snapshot.slotGroup,
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    }),
    upstreamAccount: {
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
    },
    viewerRole,
  };
}

async function myCurriculumPlanHomepagePageLoader({ request }: LoaderFunctionArgs) {
  await restoreSession({ waitForPending: true });

  const snapshot = getAuthSessionSnapshot();

  if (!snapshot) {
    throw redirect(buildLoginRedirectURL(request));
  }

  if (snapshot.needsProfileCompletion) {
    throw redirect(buildWelcomeRedirectURL(request));
  }

  if (
    !hasAcademicCurriculumPlanHomepageAccess({
      accessGroup: snapshot.userInfo.accessGroup,
    })
  ) {
    throw new Response('Forbidden', { status: 403 });
  }

  return {
    currentAccount: {
      accessGroup: [...snapshot.userInfo.accessGroup],
      accountId: snapshot.accountId,
      displayName: snapshot.displayName,
      lockedUpstreamLoginUserId: resolveUpstreamLoginLockedUserId({
        accessGroup: snapshot.userInfo.accessGroup,
        context: 'academicStaffManager',
        slotGroup: snapshot.slotGroup,
        staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
      }),
      slotGroup: [...snapshot.slotGroup],
      staffId: snapshot.identity?.kind === 'STAFF' ? snapshot.identity.id : null,
    },
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
    void logout().finally(() => navigate('/login', { replace: true }));
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

function ExamStandaloneRouteErrorPage() {
  return (
    <ExamStandaloneLayout>
      <RouteErrorPage />
    </ExamStandaloneLayout>
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
        lazy: loadLoginRouteModule,
      },
      {
        path: '/forgot-password',
        lazy: loadForgotPasswordRouteModule,
      },
      {
        path: '/reset-password',
        lazy: loadResetPasswordIntentRouteModule,
      },
      {
        path: '/invite/student-registration/:token',
        lazy: loadStudentRegistrationRouteModule,
      },
      {
        path: '/invite/:inviteType/:verificationCode',
        loader: inviteIntentLoader,
        lazy: loadInviteIntentRouteModule,
      },
      {
        path: '/verify/account-email/:token',
        lazy: loadVerifyAccountEmailIntentRouteModule,
      },
      {
        path: '/verify/email/:verificationCode',
        lazy: loadVerifyEmailIntentRouteModule,
      },
      {
        path: '/reset-password/:verificationCode',
        lazy: loadResetPasswordIntentRouteModule,
      },
      {
        path: '/welcome-back/reset-password',
        lazy: loadWelcomeBackResetPasswordIntentRouteModule,
      },
      {
        path: '/welcome-back/reset-password/:verificationCode',
        lazy: loadWelcomeBackResetPasswordIntentRouteModule,
      },
      {
        path: '/magic-link/:verificationCode',
        lazy: loadMagicLinkIntentRouteModule,
      },
    ],
  },
  {
    Component: ExamStandaloneLayout,
    ErrorBoundary: ExamStandaloneRouteErrorPage,
    HydrateFallback: RouteHydrateFallback,
    children: [
      {
        path: '/labs/zquiz-exam-activities/:activityId',
        loader: zquizExamActivitiesLabLoader,
        lazy: loadZquizExamPaperLabRouteModule,
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
        lazy: loadWelcomeRouteModule,
      },
      {
        path: '/profile',
        loader: protectedWorkbenchLoader,
        lazy: loadProfileRouteModule,
      },
      {
        path: '/admin/users',
        loader: adminUsersLoader,
        lazy: loadAdminUsersRouteModule,
      },
      {
        path: '/admin/users/:id',
        loader: adminUsersLoader,
        lazy: loadAdminUserDetailRouteModule,
      },
      {
        path: '/admin/verification-issuance',
        loader: adminUsersLoader,
        lazy: loadVerificationIssuanceRouteModule,
      },
      {
        path: '/errors/preview',
        loader: errorPreviewLoader,
        lazy: loadErrorPreviewRouteModule,
      },
      {
        path: '/academic-affairs/academic-calendar',
        loader: academicCalendarPageLoader,
        lazy: loadAcademicCalendarRouteModule,
      },
      {
        path: '/academic-affairs/semester-calendar',
        loader: () => redirect('/calendar-schedule/semester-calendar'),
      },
      {
        path: '/calendar-schedule/semester-calendar',
        loader: semesterCalendarPageLoader,
        lazy: loadSemesterCalendarRouteModule,
      },
      {
        path: '/calendar-schedule/weekly-timetable',
        loader: weeklyTimetablePageLoader,
        lazy: loadWeeklyTimetableRouteModule,
      },
      {
        path: '/calendar-schedule/semester-timetable',
        loader: semesterTimetablePageLoader,
        lazy: loadSemesterTimetableRouteModule,
      },
      {
        path: '/upstream-data-sync/major-sync',
        loader: majorSyncPageLoader,
        lazy: loadMajorSyncRouteModule,
      },
      {
        path: '/upstream-data-sync/class-sync',
        loader: classSyncPageLoader,
        lazy: loadClassSyncRouteModule,
      },
      {
        path: '/upstream-data-sync/semester-course-schedule-sync',
        loader: semesterCourseScheduleSyncPageLoader,
        lazy: loadSemesterCourseScheduleSyncRouteModule,
      },
      {
        path: '/academic-affairs/staff-semester-profiles',
        loader: staffSemesterProfilesPageLoader,
        lazy: loadStaffSemesterProfilesRouteModule,
      },
      {
        path: '/academic-affairs/academic-workload-report',
        loader: academicWorkloadReportPageLoader,
        lazy: loadAcademicWorkloadReportRouteModule,
      },
      {
        path: '/academic-affairs/academic-workload-deduction-summary',
        loader: academicWorkloadDeductionSummaryPageLoader,
        lazy: loadAcademicWorkloadDeductionSummaryRouteModule,
      },
      {
        path: '/academic-affairs/external-teacher-compensation',
        loader: externalTeacherCompensationPageLoader,
        lazy: loadExternalTeacherCompensationRouteModule,
      },
      {
        path: '/academic-affairs/my-teaching-logs',
        loader: myTeachingLogsPageLoader,
        lazy: loadMyTeachingLogsRouteModule,
      },
      {
        path: '/academic-affairs/my-curriculum-plan-homepage',
        loader: myCurriculumPlanHomepagePageLoader,
        lazy: loadMyCurriculumPlanHomepageRouteModule,
      },
      {
        path: '/academic-affairs/integrated-plan-corrections',
        loader: integratedPlanCorrectionsPageLoader,
        lazy: loadIntegratedPlanCorrectionsRouteModule,
      },
      {
        path: '/student-affairs/class-adviser-governance',
        loader: classAdviserGovernancePageLoader,
        lazy: loadClassAdviserGovernanceRouteModule,
      },
      {
        path: '/academic-affairs/student-roster-membership-reconciliation',
        loader: studentRosterMembershipReconciliationPageLoader,
        lazy: loadStudentRosterMembershipReconciliationRouteModule,
      },
      {
        path: '/class-affairs/student-profile-filing',
        loader: studentProfileFilingPageLoader,
        lazy: loadStudentProfileFilingRouteModule,
      },
      {
        path: '/class-affairs/student-conduct-alignment',
        loader: studentConductAlignmentPageLoader,
        lazy: loadStudentConductAlignmentRouteModule,
      },
      {
        path: '/class-affairs/course-results-summary',
        loader: classAffairsCourseResultsPageLoader,
        lazy: loadClassAffairsCourseResultsRouteModule,
      },
      {
        path: '/academic-assistant/academic-workload',
        loader: academicWorkloadPageLoader,
        lazy: loadAcademicWorkloadRouteModule,
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
            path: 'my-teaching-plan',
            loader: myTeachingPlanLabLoader,
            lazy: loadMyTeachingPlanLabRouteModule,
          },
          {
            path: 'upstream-session-demo',
            loader: upstreamSessionDemoLabLoader,
            lazy: loadUpstreamSessionDemoLabRouteModule,
          },
          {
            path: 'upstream-session-reference',
            loader: upstreamSessionReferenceLabLoader,
            lazy: loadUpstreamSessionReferenceLabRouteModule,
          },
          {
            path: 'student-evaluation-comment',
            loader: studentEvaluationCommentLabLoader,
            lazy: loadStudentEvaluationCommentLabRouteModule,
          },
          {
            path: 'student-evaluation-comment-workbench',
            loader: studentEvaluationCommentWorkbenchLabLoader,
            lazy: loadStudentEvaluationCommentWorkbenchLabRouteModule,
          },
          {
            path: 'student-private-profile',
            loader: studentPrivateProfileLabLoader,
            lazy: loadStudentPrivateProfileLabRouteModule,
          },
          {
            path: 'zquiz-activity-builder',
            loader: zquizActivityBuilderLabLoader,
            lazy: loadZquizActivityBuilderLabRouteModule,
          },
          {
            path: 'zquiz-exam-activities',
            loader: zquizExamActivitiesLabLoader,
            lazy: loadZquizExamActivitiesLabRouteModule,
          },
          {
            path: 'zquiz-exam-teacher-gradebook',
            loader: zquizExamTeacherGradebookLabLoader,
            lazy: loadZquizExamTeacherGradebookLabRouteModule,
          },
          {
            path: 'zquiz-practice-activities',
            loader: zquizPracticeActivitiesLabLoader,
            lazy: loadZquizPracticeActivitiesLabRouteModule,
          },
          {
            path: 'student-roster-membership-reconciliation',
            loader: () => redirect('/academic-affairs/student-roster-membership-reconciliation'),
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
