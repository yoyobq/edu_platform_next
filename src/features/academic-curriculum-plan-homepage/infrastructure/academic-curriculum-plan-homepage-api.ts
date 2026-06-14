// src/features/academic-curriculum-plan-homepage/infrastructure/academic-curriculum-plan-homepage-api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL, type GraphQLAuthMode, hasGraphQLErrorCode } from '@/shared/graphql';

import type {
  CurriculumPlanHomepageDepartmentOption,
  CurriculumPlanHomepageDetailResult,
  CurriculumPlanHomepageListResult,
  CurriculumPlanHomepagePrefillContext,
  CurriculumPlanHomepagePrefillMode,
  CurriculumPlanHomepagePrefillPhase,
  CurriculumPlanHomepagePrefillResult,
  CurriculumPlanHomepageReferenceCandidatesResult,
  CurriculumPlanHomepageTeachingEndChapterCandidatesResult,
  SaveCurriculumPlanHomepageResult,
} from '../domain/curriculum-plan-homepage-types';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

type CurriculumPlanHomepageListResponse = {
  fetchCurriculumPlanHomepageList: CurriculumPlanHomepageListResult;
};

type CurriculumPlanHomepageDetailResponse = {
  fetchCurriculumPlanHomepageDetail: CurriculumPlanHomepageDetailResult;
};

type SaveCurriculumPlanHomepageResponse = {
  saveCurriculumPlanHomepage: SaveCurriculumPlanHomepageResult;
};

type CurriculumPlanHomepagePrefillResponse = {
  previewAcademicCurriculumPlanHomepagePrefill: CurriculumPlanHomepagePrefillResult;
};

type MyCurriculumPlanHomepagePrefillResponse = {
  previewMyAcademicCurriculumPlanHomepagePrefill: CurriculumPlanHomepagePrefillResult;
};

type CurriculumPlanHomepageReferenceCandidatesResponse = {
  listAcademicCurriculumPlanHomepageReferenceCandidates: CurriculumPlanHomepageReferenceCandidatesResult;
};

type MyCurriculumPlanHomepageReferenceCandidatesResponse = {
  listMyAcademicCurriculumPlanHomepageReferenceCandidates: CurriculumPlanHomepageReferenceCandidatesResult;
};

type CurriculumPlanHomepageTeachingEndChapterCandidatesResponse = {
  listAcademicCurriculumPlanHomepageTeachingEndChapterCandidates: CurriculumPlanHomepageTeachingEndChapterCandidatesResult;
};

type MyCurriculumPlanHomepageTeachingEndChapterCandidatesResponse = {
  listMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates: CurriculumPlanHomepageTeachingEndChapterCandidatesResult;
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

const PREFILL_TIME_WINDOW_CLOSED_ERROR_CODE =
  'ACADEMIC_COURSE_SCHEDULE_CURRICULUM_PLAN_HOMEPAGE_PREFILL_TIME_WINDOW_CLOSED';
const SEMESTER_INVALID_DATE_ERROR_CODE = 'ACADEMIC_SEMESTER_INVALID_DATE';

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
        staffId
        sstsCourseId
        sstsTeachingClassId
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

const SAVE_CURRICULUM_PLAN_HOMEPAGE_MUTATION = `
  mutation SaveCurriculumPlanHomepage($input: SaveCurriculumPlanHomepageInput!) {
    saveCurriculumPlanHomepage(input: $input) {
      upstreamSessionToken
      expiresAt
      code
      success
      msg
      data
    }
  }
`;

const PREVIEW_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_PREFILL_QUERY = `
  query PreviewAcademicCurriculumPlanHomepagePrefill(
    $planId: String!
    $phase: String!
    $context: CurriculumPlanHomepagePrefillContextInput!
    $overrideTimeWindow: Boolean
  ) {
    previewAcademicCurriculumPlanHomepagePrefill(
      planId: $planId
      phase: $phase
      context: $context
      overrideTimeWindow: $overrideTimeWindow
    ) {
      homepagePatch
      fieldWriteRules {
        field
        mode
        value
      }
      warnings
    }
  }
`;

const PREVIEW_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_PREFILL_QUERY = `
  query PreviewMyAcademicCurriculumPlanHomepagePrefill(
    $planId: String!
    $phase: String!
    $context: MyCurriculumPlanHomepagePrefillContextInput!
    $overrideTimeWindow: Boolean
  ) {
    previewMyAcademicCurriculumPlanHomepagePrefill(
      planId: $planId
      phase: $phase
      context: $context
      overrideTimeWindow: $overrideTimeWindow
    ) {
      homepagePatch
      fieldWriteRules {
        field
        mode
        value
      }
      warnings
    }
  }
`;

const LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY = `
  query ListAcademicCurriculumPlanHomepageReferenceCandidates(
    $upstreamSessionToken: String!
    $planId: String!
    $phase: String!
    $context: CurriculumPlanHomepageReferenceCandidatesContextInput!
  ) {
    listAcademicCurriculumPlanHomepageReferenceCandidates(
      upstreamSessionToken: $upstreamSessionToken
      planId: $planId
      phase: $phase
      context: $context
    ) {
      upstreamSessionToken
      expiresAt
      warnings
      candidateGroups {
        groupKey
        title
        phase
        applyMode
        targetFields
        items {
          sourcePlanId
          schoolYear
          semester
          courseName
          teachingClassName
          weekCount
          weeklyHours
          plannedLessons
          plannedLessonsDiff
          matchKind
          rank
          recommended
          values {
            textbookName
            teachingObjectives
            improvementMeasures
          }
        }
      }
    }
  }
`;

const LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY = `
  query ListMyAcademicCurriculumPlanHomepageReferenceCandidates(
    $upstreamSessionToken: String!
    $planId: String!
    $phase: String!
    $context: MyCurriculumPlanHomepageReferenceCandidatesContextInput!
  ) {
    listMyAcademicCurriculumPlanHomepageReferenceCandidates(
      upstreamSessionToken: $upstreamSessionToken
      planId: $planId
      phase: $phase
      context: $context
    ) {
      upstreamSessionToken
      expiresAt
      warnings
      candidateGroups {
        groupKey
        title
        phase
        applyMode
        targetFields
        items {
          sourcePlanId
          schoolYear
          semester
          courseName
          teachingClassName
          weekCount
          weeklyHours
          plannedLessons
          plannedLessonsDiff
          matchKind
          rank
          recommended
          values {
            textbookName
            teachingObjectives
            improvementMeasures
          }
        }
      }
    }
  }
`;

const LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY = `
  query ListAcademicCurriculumPlanHomepageTeachingEndChapterCandidates(
    $upstreamSessionToken: String!
    $planId: String!
    $phase: String!
  ) {
    listAcademicCurriculumPlanHomepageTeachingEndChapterCandidates(
      upstreamSessionToken: $upstreamSessionToken
      planId: $planId
      phase: $phase
    ) {
      upstreamSessionToken
      expiresAt
      warnings
      candidateGroups {
        groupKey
        title
        phase
        applyMode
        targetFields
        writeRule {
          field
          mode
          prefix
        }
        items {
          lecturePlanDetailId
          weekNumber
          sectionId
          sectionName
          topicName
          teachingChapterContent
          value
          displayText
        }
      }
    }
  }
`;

const LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY = `
  query ListMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates(
    $upstreamSessionToken: String!
    $planId: String!
    $phase: String!
    $context: MyCurriculumPlanHomepageTeachingEndChapterCandidatesContextInput!
  ) {
    listMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates(
      upstreamSessionToken: $upstreamSessionToken
      planId: $planId
      phase: $phase
      context: $context
    ) {
      upstreamSessionToken
      expiresAt
      warnings
      candidateGroups {
        groupKey
        title
        phase
        applyMode
        targetFields
        writeRule {
          field
          mode
          prefix
        }
        items {
          lecturePlanDetailId
          weekNumber
          sectionId
          sectionName
          topicName
          teachingChapterContent
          value
          displayText
        }
      }
    }
  }
`;

const UPSTREAM_SESSION_GRAPHQL_OPTIONS = {
  logoutOnRetryAuthFailure: false,
} as const;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    authMode?: GraphQLAuthMode;
    logoutOnRetryAuthFailure?: boolean;
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

export function isCurriculumPlanHomepagePrefillTimeWindowClosedError(error: unknown): boolean {
  return hasGraphQLErrorCode(error, PREFILL_TIME_WINDOW_CLOSED_ERROR_CODE);
}

export function isCurriculumPlanHomepageSemesterInvalidDateError(error: unknown): boolean {
  return hasGraphQLErrorCode(error, SEMESTER_INVALID_DATE_ERROR_CODE);
}

export function resolveCurriculumPlanHomepagePrefillErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (isCurriculumPlanHomepageSemesterInvalidDateError(error)) {
    return '学期日期数据异常，暂时无法生成预填建议。请联系管理员核对学期日期配置。';
  }

  return resolveUpstreamErrorMessage(error, fallback);
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
  >(
    FETCH_CURRICULUM_PLAN_HOMEPAGE_LIST_QUERY,
    {
      departmentId: normalizeOptionalString(input.departmentId),
      schoolYear: normalizeRequiredString(input.schoolYear, '学年'),
      semester: normalizeRequiredString(input.semester, '学期'),
      sessionToken: input.sessionToken,
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

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
  >(
    FETCH_CURRICULUM_PLAN_HOMEPAGE_DETAIL_QUERY,
    {
      planId: normalizeRequiredString(input.planId, '教学计划 ID'),
      sessionToken: input.sessionToken,
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.fetchCurriculumPlanHomepageDetail;
}

export async function saveCurriculumPlanHomepage(input: {
  homepage: Record<string, unknown>;
  sessionToken: string;
}) {
  const response = await requestGraphQL<
    SaveCurriculumPlanHomepageResponse,
    {
      input: {
        homepage: Record<string, unknown>;
        sessionToken: string;
      };
    }
  >(
    SAVE_CURRICULUM_PLAN_HOMEPAGE_MUTATION,
    {
      input: {
        homepage: input.homepage,
        sessionToken: input.sessionToken,
      },
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.saveCurriculumPlanHomepage;
}

export async function previewCurriculumPlanHomepagePrefill(input: {
  context: CurriculumPlanHomepagePrefillContext;
  mode: CurriculumPlanHomepagePrefillMode;
  overrideTimeWindow?: boolean;
  phase: CurriculumPlanHomepagePrefillPhase;
  planId: string;
}) {
  const commonVariables = {
    ...(input.overrideTimeWindow === undefined
      ? {}
      : {
          overrideTimeWindow: input.overrideTimeWindow,
        }),
    phase: input.phase,
    planId: normalizeRequiredString(input.planId, '教学计划 ID'),
  };

  if (input.mode === 'managed') {
    const response = await requestGraphQL<
      CurriculumPlanHomepagePrefillResponse,
      {
        context: Required<CurriculumPlanHomepagePrefillContext>;
        overrideTimeWindow?: boolean;
        phase: CurriculumPlanHomepagePrefillPhase;
        planId: string;
      }
    >(PREVIEW_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_PREFILL_QUERY, {
      ...commonVariables,
      context: {
        courseName: input.context.courseName,
        schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
        semester: normalizeRequiredString(input.context.semester, '学期'),
        sstsCourseId: normalizeRequiredString(input.context.sstsCourseId, 'SSTS 课程 ID'),
        sstsTeachingClassId: normalizeRequiredString(
          input.context.sstsTeachingClassId,
          'SSTS 教学班 ID',
        ),
        staffId: normalizeRequiredString(input.context.staffId ?? '', '教师 ID'),
        weekCount: input.context.weekCount,
        weeklyHours: input.context.weeklyHours,
      },
    });

    return response.previewAcademicCurriculumPlanHomepagePrefill;
  }

  const response = await requestGraphQL<
    MyCurriculumPlanHomepagePrefillResponse,
    {
      context: Omit<CurriculumPlanHomepagePrefillContext, 'staffId'>;
      overrideTimeWindow?: boolean;
      phase: CurriculumPlanHomepagePrefillPhase;
      planId: string;
    }
  >(PREVIEW_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_PREFILL_QUERY, {
    ...commonVariables,
    context: {
      courseName: input.context.courseName,
      schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
      semester: normalizeRequiredString(input.context.semester, '学期'),
      sstsCourseId: normalizeRequiredString(input.context.sstsCourseId, 'SSTS 课程 ID'),
      sstsTeachingClassId: normalizeRequiredString(
        input.context.sstsTeachingClassId,
        'SSTS 教学班 ID',
      ),
      weekCount: input.context.weekCount,
      weeklyHours: input.context.weeklyHours,
    },
  });

  return response.previewMyAcademicCurriculumPlanHomepagePrefill;
}

export async function listCurriculumPlanHomepageReferenceCandidates(input: {
  context: {
    courseName: string | null;
    schoolYear: string;
    semester: string;
    staffId?: string;
    weekCount: number | null;
    weeklyHours: number | null;
  };
  mode: CurriculumPlanHomepagePrefillMode;
  phase: CurriculumPlanHomepagePrefillPhase;
  planId: string;
  upstreamSessionToken: string;
}) {
  const commonVariables = {
    phase: input.phase,
    planId: normalizeRequiredString(input.planId, '教学计划 ID'),
    upstreamSessionToken: input.upstreamSessionToken,
  };

  if (input.mode === 'managed') {
    const response = await requestGraphQL<
      CurriculumPlanHomepageReferenceCandidatesResponse,
      {
        context: {
          courseName: string | null;
          schoolYear: string;
          semester: string;
          staffId: string;
          weekCount: number | null;
          weeklyHours: number | null;
        };
        phase: CurriculumPlanHomepagePrefillPhase;
        planId: string;
        upstreamSessionToken: string;
      }
    >(
      LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY,
      {
        ...commonVariables,
        context: {
          courseName: input.context.courseName,
          schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
          semester: normalizeRequiredString(input.context.semester, '学期'),
          staffId: normalizeRequiredString(input.context.staffId ?? '', '教师 ID'),
          weekCount: input.context.weekCount,
          weeklyHours: input.context.weeklyHours,
        },
      },
      UPSTREAM_SESSION_GRAPHQL_OPTIONS,
    );

    return response.listAcademicCurriculumPlanHomepageReferenceCandidates;
  }

  const response = await requestGraphQL<
    MyCurriculumPlanHomepageReferenceCandidatesResponse,
    {
      context: {
        courseName: string | null;
        schoolYear: string;
        semester: string;
        weekCount: number | null;
        weeklyHours: number | null;
      };
      phase: CurriculumPlanHomepagePrefillPhase;
      planId: string;
      upstreamSessionToken: string;
    }
  >(
    LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY,
    {
      ...commonVariables,
      context: {
        courseName: input.context.courseName,
        schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
        semester: normalizeRequiredString(input.context.semester, '学期'),
        weekCount: input.context.weekCount,
        weeklyHours: input.context.weeklyHours,
      },
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.listMyAcademicCurriculumPlanHomepageReferenceCandidates;
}

export async function listCurriculumPlanHomepageTeachingEndChapterCandidates(input: {
  context: {
    schoolYear: string;
    semester: string;
  };
  mode: CurriculumPlanHomepagePrefillMode;
  phase: CurriculumPlanHomepagePrefillPhase;
  planId: string;
  upstreamSessionToken: string;
}) {
  const commonVariables = {
    phase: input.phase,
    planId: normalizeRequiredString(input.planId, '教学计划 ID'),
    upstreamSessionToken: input.upstreamSessionToken,
  };

  if (input.mode === 'managed') {
    const response = await requestGraphQL<
      CurriculumPlanHomepageTeachingEndChapterCandidatesResponse,
      {
        phase: CurriculumPlanHomepagePrefillPhase;
        planId: string;
        upstreamSessionToken: string;
      }
    >(
      LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY,
      {
        ...commonVariables,
      },
      UPSTREAM_SESSION_GRAPHQL_OPTIONS,
    );

    return response.listAcademicCurriculumPlanHomepageTeachingEndChapterCandidates;
  }

  const response = await requestGraphQL<
    MyCurriculumPlanHomepageTeachingEndChapterCandidatesResponse,
    {
      context: {
        schoolYear: string;
        semester: string;
      };
      phase: CurriculumPlanHomepagePrefillPhase;
      planId: string;
      upstreamSessionToken: string;
    }
  >(
    LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY,
    {
      ...commonVariables,
      context: {
        schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
        semester: normalizeRequiredString(input.context.semester, '学期'),
      },
    },
    UPSTREAM_SESSION_GRAPHQL_OPTIONS,
  );

  return response.listMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates;
}
