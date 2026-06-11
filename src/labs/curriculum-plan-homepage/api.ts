// src/labs/curriculum-plan-homepage/api.ts

import type { OperationVariables } from '@apollo/client';

import {
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
          name: string | null;
          slotGroup: readonly string[] | null;
        }
      | {
          __typename: 'StudentType';
          currentClassCode: string | null;
          currentClassId: string | null;
          id: string;
          name: string | null;
          slotGroup: readonly string[] | null;
          upstreamId: string | null;
        }
      | null;
    userInfo: {
      accessGroup: string[];
      nickname: string | null;
    };
  };
};

type CurriculumPlanHomepageListResponse = {
  fetchCurriculumPlanHomepageList: CurriculumPlanHomepageListResult;
};

type CurriculumPlanHomepageDetailResponse = {
  fetchCurriculumPlanHomepageDetail: CurriculumPlanHomepageDetailResult;
};

type DepartmentDTO = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

type DepartmentsResponse = {
  departments: DepartmentDTO[];
};

export type CurrentCurriculumPlanHomepageAccount = {
  accessGroup: string[];
  accountId: number;
  displayName: string;
  staffId: string | null;
};

export type CurriculumPlanHomepageListItem = {
  className: string | null;
  courseCategory: string | null;
  courseName: string | null;
  planId: string;
  rawPlan: Record<string, unknown> | null;
  reviewStatus: string | null;
  schoolYear: string | null;
  semester: string | null;
  teachingClassId: string | null;
  weekCount: number | null;
  weekNumberText: string | null;
  weeklyHours: number | null;
};

export type CurriculumPlanHomepageListResult = {
  count: number;
  expiresAt: string | null;
  items: CurriculumPlanHomepageListItem[];
  upstreamSessionToken: string;
};

export type CurriculumPlanHomepageDetailResult = {
  expiresAt: string | null;
  homepage: Record<string, unknown> | null;
  planId: string;
  upstreamSessionToken: string;
};

export type CurriculumPlanHomepageDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

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
        nickname
      }
      identity {
        __typename
        ... on StaffType {
          departmentId
          id
          name
          slotGroup
        }
        ... on StudentType {
          currentClassCode
          currentClassId
          id
          name
          slotGroup
          upstreamId
        }
      }
    }
  }
`;

const FETCH_CURRICULUM_PLAN_HOMEPAGE_LIST_QUERY = `
  query FetchCurriculumPlanHomepageList(
    $sessionToken: String!
    $schoolYear: String!
    $semester: String!
    $departmentId: String
  ) {
    fetchCurriculumPlanHomepageList(
      sessionToken: $sessionToken
      schoolYear: $schoolYear
      semester: $semester
      departmentId: $departmentId
    ) {
      upstreamSessionToken
      expiresAt
      count
      items {
        planId
        teachingClassId
        courseName
        className
        schoolYear
        semester
        courseCategory
        weeklyHours
        weekCount
        weekNumberText
        reviewStatus
        rawPlan
      }
    }
  }
`;

const FETCH_CURRICULUM_PLAN_HOMEPAGE_DETAIL_QUERY = `
  query FetchCurriculumPlanHomepageDetail($sessionToken: String!, $planId: String!) {
    fetchCurriculumPlanHomepageDetail(sessionToken: $sessionToken, planId: $planId) {
      upstreamSessionToken
      expiresAt
      planId
      homepage
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query CurriculumPlanHomepageDepartments($limit: Int) {
    departments(limit: $limit) {
      departmentName
      id
      isEnabled
      shortName
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

function normalizeRequiredString(value: string, fieldLabel: string) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${fieldLabel}不能为空。`);
  }

  return normalized;
}

function normalizeOptionalString(value: string | null | undefined) {
  return String(value || '').trim() || null;
}

function resolveDisplayName(response: CurrentAccountResponse) {
  const identityName = response.me.identity?.name?.trim();
  const nickname = response.me.userInfo.nickname?.trim();

  return identityName || nickname || `account-${response.me.accountId}`;
}

function toDepartmentOption(
  department: DepartmentDTO,
): CurriculumPlanHomepageDepartmentOption | null {
  const id = department.id.trim();

  if (!id) {
    return null;
  }

  return {
    departmentName: department.departmentName?.trim() || id,
    id,
    isEnabled: department.isEnabled,
    shortName: department.shortName?.trim() || null,
  };
}

function buildEnabledDepartmentOptions(departments: readonly DepartmentDTO[]) {
  return departments
    .map(toDepartmentOption)
    .filter((department): department is CurriculumPlanHomepageDepartmentOption =>
      Boolean(department && department.isEnabled),
    );
}

export async function fetchCurrentCurriculumPlanHomepageAccount(): Promise<CurrentCurriculumPlanHomepageAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accessGroup: response.me.userInfo.accessGroup,
      accountId: response.me.accountId,
      displayName: resolveDisplayName(response),
      staffId: response.me.identity?.__typename === 'StaffType' ? response.me.identity.id : null,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchCurriculumPlanHomepageList(input: {
  departmentId?: string | null;
  schoolYear: string;
  semester: string;
  sessionToken: string;
}) {
  const response = await requestGraphQL<
    CurriculumPlanHomepageListResponse,
    {
      departmentId: string | null;
      schoolYear: string;
      semester: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_HOMEPAGE_LIST_QUERY, {
    departmentId: normalizeOptionalString(input.departmentId),
    schoolYear: normalizeRequiredString(input.schoolYear, '学年'),
    semester: normalizeRequiredString(input.semester, '学期'),
    sessionToken: input.sessionToken,
  });

  return response.fetchCurriculumPlanHomepageList;
}

export async function fetchCurriculumPlanHomepageDepartmentOptions() {
  try {
    const response = await requestGraphQL<DepartmentsResponse, { limit: number }>(
      DEPARTMENTS_QUERY,
      { limit: 500 },
    );

    return buildEnabledDepartmentOptions(response.departments);
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载可选系部。'));
  }
}

export async function fetchCurriculumPlanHomepageDetail(input: {
  planId: string;
  sessionToken: string;
}) {
  const response = await requestGraphQL<
    CurriculumPlanHomepageDetailResponse,
    {
      planId: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_HOMEPAGE_DETAIL_QUERY, {
    planId: normalizeRequiredString(input.planId, '教学计划 ID'),
    sessionToken: input.sessionToken,
  });

  return response.fetchCurriculumPlanHomepageDetail;
}
