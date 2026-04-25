import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      nickname: string | null;
    };
  };
};

type TeacherDirectoryResponse = {
  fetchTeacherDirectory: TeacherDirectoryResult;
};

type CurriculumPlanListResponse = {
  fetchCurriculumPlanList: CurriculumPlanListResult;
};

type DepartmentCurriculumPlanListResponse = {
  fetchDepartmentCurriculumPlanList: CurriculumPlanListResult;
};

type CurriculumPlanDetailResponse = {
  fetchCurriculumPlanDetail: CurriculumPlanDetailResult;
};

type VerifiedStaffIdentityResponse = {
  fetchVerifiedStaffIdentity: VerifiedStaffIdentityResult;
};

type LectureJournalListResponse = {
  fetchLectureJournalList: LectureJournalListResult;
};

type LectureJournalTeachingClassSamplesResponse = {
  listAcademicTeacherSemesterScheduleItems: {
    items: LectureJournalTeachingClassRecord[];
  };
};

export type CurrentUpstreamDemoAccount = {
  accountId: number;
  displayName: string;
};

export type TeacherDirectoryResult = {
  expiresAt: string;
  teachers: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  upstreamSessionToken: string;
};

export type DepartmentCurriculumPlanReviewStatus =
  | 'APPROVED'
  | 'PENDING_SUBMIT'
  | 'REJECTED'
  | 'UNDER_REVIEW'
  | 'UNRECORDED';

export type CurriculumPlanListResult = {
  count: number;
  expiresAt: string;
  plans: unknown;
  upstreamSessionToken: string;
};

export type CurriculumPlanDetailResult = {
  count: number;
  details: unknown;
  expiresAt: string;
  upstreamSessionToken: string;
};

export type VerifiedStaffIdentityResult = {
  departmentName: string | null;
  expiresAt: string;
  identityKind: string;
  orgId: string | null;
  personId: string;
  personName: string;
  upstreamLoginId: string;
  upstreamSessionToken: string;
};

export type LectureJournalListResult = {
  count: number;
  expiresAt: string;
  journals: unknown;
  upstreamSessionToken: string;
};

export type LectureJournalTeachingClassRecord = {
  courseName: string | null;
  scheduleId: number;
  staffId: string;
  staffName: string;
  sstsTeachingClassId: string | null;
  teachingClassName: string;
};

const FETCH_TEACHER_DIRECTORY_QUERY = `
  query FetchTeacherDirectory($sessionToken: String!) {
    fetchTeacherDirectory(sessionToken: $sessionToken) {
      expiresAt
      teachers {
        code
        image
        name
        text
        value
      }
      upstreamSessionToken
    }
  }
`;

const FETCH_CURRICULUM_PLAN_LIST_QUERY = `
  query FetchCurriculumPlanList(
    $departmentId: String
    $schoolYear: String!
    $semester: String!
    $sessionToken: String!
  ) {
    fetchCurriculumPlanList(
      departmentId: $departmentId
      schoolYear: $schoolYear
      semester: $semester
      sessionToken: $sessionToken
    ) {
      count
      expiresAt
      plans
      upstreamSessionToken
    }
  }
`;

const FETCH_DEPARTMENT_CURRICULUM_PLAN_LIST_QUERY = `
  query FetchDepartmentCurriculumPlanList(
    $departmentId: String!
    $reviewStatus: DepartmentCurriculumPlanReviewStatus
    $schoolYear: String!
    $semester: String!
    $sessionToken: String!
    $teacherId: String
  ) {
    fetchDepartmentCurriculumPlanList(
      departmentId: $departmentId
      reviewStatus: $reviewStatus
      schoolYear: $schoolYear
      semester: $semester
      sessionToken: $sessionToken
      teacherId: $teacherId
    ) {
      count
      expiresAt
      plans
      upstreamSessionToken
    }
  }
`;

const FETCH_CURRICULUM_PLAN_DETAIL_QUERY = `
  query FetchCurriculumPlanDetail($planId: String!, $sessionToken: String!) {
    fetchCurriculumPlanDetail(planId: $planId, sessionToken: $sessionToken) {
      count
      details
      expiresAt
      upstreamSessionToken
    }
  }
`;

const FETCH_VERIFIED_STAFF_IDENTITY_QUERY = `
  query FetchVerifiedStaffIdentity($sessionToken: String!) {
    fetchVerifiedStaffIdentity(sessionToken: $sessionToken) {
      departmentName
      expiresAt
      identityKind
      orgId
      personId
      personName
      upstreamLoginId
      upstreamSessionToken
    }
  }
`;

const FETCH_LECTURE_JOURNAL_LIST_QUERY = `
  query FetchLectureJournalList($sessionToken: String!, $teachingClassId: String!) {
    fetchLectureJournalList(sessionToken: $sessionToken, teachingClassId: $teachingClassId) {
      count
      expiresAt
      journals
      upstreamSessionToken
    }
  }
`;

const LIST_LECTURE_JOURNAL_TEACHING_CLASS_SAMPLES_QUERY = `
  query ListLectureJournalTeachingClassSamples($semesterId: Int!, $staffId: String!) {
    listAcademicTeacherSemesterScheduleItems(semesterId: $semesterId, staffId: $staffId) {
      items {
        courseName
        scheduleId
        staffId
        staffName
        sstsTeachingClassId
        teachingClassName
      }
    }
  }
`;

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
      userInfo {
        nickname
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

export async function fetchCurrentUpstreamDemoAccount(): Promise<CurrentUpstreamDemoAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname?.trim() || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchTeacherDirectory(input: { sessionToken: string }) {
  const response = await requestGraphQL<
    TeacherDirectoryResponse,
    {
      sessionToken: string;
    }
  >(FETCH_TEACHER_DIRECTORY_QUERY, {
    sessionToken: input.sessionToken,
  });

  return response.fetchTeacherDirectory;
}

export async function fetchCurriculumPlanList(input: {
  departmentId?: string;
  schoolYear: string;
  semester: string;
  sessionToken: string;
}) {
  const response = await requestGraphQL<
    CurriculumPlanListResponse,
    {
      departmentId?: string;
      schoolYear: string;
      semester: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_LIST_QUERY, {
    departmentId: input.departmentId?.trim() || undefined,
    schoolYear: String(input.schoolYear || '').trim(),
    semester: String(input.semester || '').trim(),
    sessionToken: input.sessionToken,
  });

  return response.fetchCurriculumPlanList;
}

export async function fetchDepartmentCurriculumPlanList(input: {
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  sessionToken: string;
  teacherId?: string;
}) {
  const response = await requestGraphQL<
    DepartmentCurriculumPlanListResponse,
    {
      departmentId: string;
      reviewStatus?: DepartmentCurriculumPlanReviewStatus;
      schoolYear: string;
      semester: string;
      sessionToken: string;
      teacherId?: string;
    }
  >(FETCH_DEPARTMENT_CURRICULUM_PLAN_LIST_QUERY, {
    departmentId: input.departmentId.trim(),
    reviewStatus: input.reviewStatus,
    schoolYear: String(input.schoolYear || '').trim(),
    semester: String(input.semester || '').trim(),
    sessionToken: input.sessionToken,
    teacherId: input.teacherId?.trim() || undefined,
  });

  return response.fetchDepartmentCurriculumPlanList;
}

export async function fetchCurriculumPlanDetail(input: { planId: string; sessionToken: string }) {
  const response = await requestGraphQL<
    CurriculumPlanDetailResponse,
    {
      planId: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_DETAIL_QUERY, {
    planId: input.planId,
    sessionToken: input.sessionToken,
  });

  return response.fetchCurriculumPlanDetail;
}

export async function fetchVerifiedStaffIdentity(input: { sessionToken: string }) {
  const response = await requestGraphQL<
    VerifiedStaffIdentityResponse,
    {
      sessionToken: string;
    }
  >(FETCH_VERIFIED_STAFF_IDENTITY_QUERY, {
    sessionToken: input.sessionToken,
  });

  return response.fetchVerifiedStaffIdentity;
}

export async function fetchLectureJournalList(input: {
  sessionToken: string;
  teachingClassId: string;
}) {
  const response = await requestGraphQL<
    LectureJournalListResponse,
    {
      sessionToken: string;
      teachingClassId: string;
    }
  >(FETCH_LECTURE_JOURNAL_LIST_QUERY, {
    sessionToken: input.sessionToken,
    teachingClassId: input.teachingClassId.trim(),
  });

  return response.fetchLectureJournalList;
}

export async function fetchLectureJournalTeachingClassSamples(input: {
  semesterId: number;
  staffId: string;
}) {
  const response = await requestGraphQL<
    LectureJournalTeachingClassSamplesResponse,
    {
      semesterId: number;
      staffId: string;
    }
  >(LIST_LECTURE_JOURNAL_TEACHING_CLASS_SAMPLES_QUERY, {
    semesterId: input.semesterId,
    staffId: input.staffId.trim(),
  });

  return response.listAcademicTeacherSemesterScheduleItems.items.map((item) => ({
    ...item,
    courseName: item.courseName?.trim() || '未命名课程',
  }));
}
