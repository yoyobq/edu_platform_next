import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL, type GraphQLAuthMode } from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

type CurrentAccountResponse = {
  me: {
    accountId: number;
    account: {
      id: number;
      identityHint: string | null;
    };
    identity:
      | {
          __typename: 'StaffType';
          departmentId: string | null;
          id: string;
          slotGroup: readonly string[] | null;
        }
      | {
          __typename: 'StudentType';
          currentClassCode: string | null;
          currentClassId: string | null;
          id: string;
          slotGroup: readonly string[] | null;
          upstreamId: string | null;
        }
      | null;
    userInfo: {
      accessGroup: string[];
    };
  };
};

type TeacherDirectoryResponse = {
  fetchTeacherDirectory: TeacherDirectoryResult;
};

type MajorDirectoryResponse = {
  fetchMajorDirectory: MajorDirectoryResult;
};

type ClassDirectoryResponse = {
  fetchClassDirectory: ClassDirectoryResult;
};

type PreviousClassAdviserClassesResponse = {
  fetchPreviousClassAdviserClasses: PreviousClassAdviserClassesResult;
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

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterRecord[];
};

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  isVisible?: boolean;
  limit?: number;
};

export type CurrentUpstreamDemoAccount = {
  accessGroup: string[];
  accountId: number;
  displayName: string;
  staffId: string | null;
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

export type MajorDirectoryResult = {
  expiresAt: string;
  majors: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  upstreamSessionToken: string;
};

export type ClassDirectoryResult = {
  classes: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  expiresAt: string;
  upstreamSessionToken: string;
};

export type PreviousClassAdviserClassesResult = {
  classes: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  count: number;
  expiresAt: string;
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

const FETCH_MAJOR_DIRECTORY_QUERY = `
  query FetchMajorDirectory($sessionToken: String!, $departmentId: String!) {
    fetchMajorDirectory(sessionToken: $sessionToken, departmentId: $departmentId) {
      upstreamSessionToken
      expiresAt
      majors {
        code
        name
        text
        value
        image
      }
    }
  }
`;

const FETCH_CLASS_DIRECTORY_QUERY = `
  query FetchClassDirectory(
    $sessionToken: String!
    $schoolYear: String
    $semester: String
    $departmentId: String!
    $annualMajorId: String
  ) {
    fetchClassDirectory(
      sessionToken: $sessionToken
      schoolYear: $schoolYear
      semester: $semester
      departmentId: $departmentId
      annualMajorId: $annualMajorId
    ) {
      upstreamSessionToken
      expiresAt
      classes {
        code
        name
        text
        value
        image
      }
    }
  }
`;

const FETCH_PREVIOUS_CLASS_ADVISER_CLASSES_QUERY = `
  query FetchPreviousClassAdviserClasses($sessionToken: String!) {
    fetchPreviousClassAdviserClasses(sessionToken: $sessionToken) {
      upstreamSessionToken
      expiresAt
      count
      classes {
        code
        name
        text
        value
        image
      }
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

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters($isCurrent: Boolean, $isVisible: Boolean, $limit: Int) {
    academicSemesters(isCurrent: $isCurrent, isVisible: $isVisible, limit: $limit) {
      id
      schoolYear
      termNumber
      name
      startDate
      firstTeachingDate
      examStartDate
      endDate
      isCurrent
      isVisible
      sortOrder
      createdAt
      updatedAt
    }
  }
`;

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
      account {
        id
        identityHint
      }
      userInfo {
        accessGroup
      }
      identity {
        __typename
        ... on StaffType {
          departmentId
          id
          slotGroup
        }
        ... on StudentType {
          currentClassCode
          currentClassId
          id
          slotGroup
          upstreamId
        }
      }
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    authMode?: GraphQLAuthMode;
  },
): Promise<TData> {
  return options ? executeGraphQL(query, variables, options) : executeGraphQL(query, variables);
}

export async function fetchCurrentUpstreamDemoAccount(): Promise<CurrentUpstreamDemoAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accessGroup: response.me.userInfo.accessGroup,
      accountId: response.me.accountId,
      displayName: `account-${response.me.accountId}`,
      staffId: response.me.identity?.__typename === 'StaffType' ? response.me.identity.id : null,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function requestAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await requestGraphQL<AcademicSemestersResponse, ListAcademicSemestersInput>(
      LIST_ACADEMIC_SEMESTERS_QUERY,
      input,
    );

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载学期列表。'));
  }
}

export async function fetchTeacherDirectory(input: { upstreamSessionToken: string }) {
  const response = await executeUpstreamSessionGraphQL<
    TeacherDirectoryResponse,
    {
      sessionToken: string;
    }
  >(FETCH_TEACHER_DIRECTORY_QUERY, {
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchTeacherDirectory;
}

export async function fetchMajorDirectory(input: {
  departmentId: string;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
    MajorDirectoryResponse,
    {
      departmentId: string;
      sessionToken: string;
    }
  >(FETCH_MAJOR_DIRECTORY_QUERY, {
    departmentId: input.departmentId.trim(),
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchMajorDirectory;
}

export async function fetchClassDirectory(input: {
  annualMajorId?: string | null;
  departmentId: string;
  schoolYear?: string | null;
  semester?: string | null;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
    ClassDirectoryResponse,
    {
      annualMajorId: string | null;
      departmentId: string;
      schoolYear: string | null;
      semester: string | null;
      sessionToken: string;
    }
  >(FETCH_CLASS_DIRECTORY_QUERY, {
    annualMajorId: input.annualMajorId?.trim() || null,
    departmentId: input.departmentId.trim(),
    schoolYear: input.schoolYear?.trim() || null,
    semester: input.semester?.trim() || null,
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchClassDirectory;
}

export async function fetchPreviousClassAdviserClasses(input: { upstreamSessionToken: string }) {
  const response = await executeUpstreamSessionGraphQL<
    PreviousClassAdviserClassesResponse,
    {
      sessionToken: string;
    }
  >(FETCH_PREVIOUS_CLASS_ADVISER_CLASSES_QUERY, {
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchPreviousClassAdviserClasses;
}

export async function fetchCurriculumPlanList(input: {
  departmentId?: string;
  schoolYear: string;
  semester: string;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
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
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchCurriculumPlanList;
}

export async function fetchDepartmentCurriculumPlanList(input: {
  departmentId: string;
  reviewStatus?: DepartmentCurriculumPlanReviewStatus;
  schoolYear: string;
  semester: string;
  teacherId?: string;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
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
    teacherId: input.teacherId?.trim() || undefined,
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchDepartmentCurriculumPlanList;
}

export async function fetchCurriculumPlanDetail(input: {
  planId: string;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
    CurriculumPlanDetailResponse,
    {
      planId: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_DETAIL_QUERY, {
    planId: input.planId,
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchCurriculumPlanDetail;
}

export async function fetchVerifiedStaffIdentity(input: { upstreamSessionToken: string }) {
  const response = await executeUpstreamSessionGraphQL<
    VerifiedStaffIdentityResponse,
    {
      sessionToken: string;
    }
  >(FETCH_VERIFIED_STAFF_IDENTITY_QUERY, {
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchVerifiedStaffIdentity;
}

export async function fetchLectureJournalList(input: {
  teachingClassId: string;
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
    LectureJournalListResponse,
    {
      sessionToken: string;
      teachingClassId: string;
    }
  >(FETCH_LECTURE_JOURNAL_LIST_QUERY, {
    teachingClassId: input.teachingClassId.trim(),
    sessionToken: input.upstreamSessionToken,
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
