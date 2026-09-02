// src/features/academic-curriculum-plan-homepage/infrastructure/academic-curriculum-plan-homepage-api.ts

import type { OperationVariables } from '@apollo/client';

import type { AcademicSemesterRecord } from '@/entities/academic-semester';
import {
  executeUpstreamSessionGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import { executeGraphQL, type GraphQLAuthMode, hasGraphQLDetailCode } from '@/shared/graphql';

import type {
  CurriculumPlanHomepageDepartmentOption,
  CurriculumPlanHomepageDetailResult,
  CurriculumPlanHomepageListResult,
  CurriculumPlanHomepagePatch,
  CurriculumPlanHomepagePrefillContext,
  CurriculumPlanHomepagePrefillMode,
  CurriculumPlanHomepagePrefillPhase,
  CurriculumPlanHomepagePrefillResult,
  CurriculumPlanHomepageReferenceCandidatesResult,
  CurriculumPlanHomepageTeachingEndChapterCandidatesResult,
  SaveCurriculumPlanHomepageResult,
} from '../domain/curriculum-plan-homepage-types';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  isVisible?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

type AcademicSemestersResponse = {
  academicSemesters: AcademicSemesterRecord[];
};

type CurriculumPlanHomepageListResponse = {
  fetchCurriculumPlanHomepageList: CurriculumPlanHomepageListResult;
};

type AcademicCurriculumPlanHomepageListResponse = {
  listManagedAcademicCurriculumPlanHomepages: CurriculumPlanHomepageListResult;
};

type MyAcademicCurriculumPlanHomepageListResponse = {
  listMyAcademicCurriculumPlanHomepages: CurriculumPlanHomepageListResult;
};

export type AcademicCurriculumPlanHomepageTeacherOption = {
  staffId: string;
  staffName: string;
};

type AcademicCurriculumPlanHomepageTeacherOptionsResponse = {
  listManagedAcademicSemesterPlannedTimetableTeacherOptions: {
    items: AcademicCurriculumPlanHomepageTeacherOption[];
  };
};

type CurriculumPlanHomepageDetailResponse = {
  fetchCurriculumPlanHomepageDetail: CurriculumPlanHomepageDetailResult;
};

type SaveAcademicCurriculumPlanHomepageResponse = {
  saveManagedAcademicCurriculumPlanHomepage: SaveCurriculumPlanHomepageResult;
};

type SaveMyAcademicCurriculumPlanHomepageResponse = {
  saveMyAcademicCurriculumPlanHomepage: SaveCurriculumPlanHomepageResult;
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

const ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_LIST_FIELDS = `
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
`;

const LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGES_QUERY = `
  query ListAcademicCurriculumPlanHomepages(
    $semesterId: Int!
    $staffId: String!
    $upstreamSessionToken: String!
  ) {
    listManagedAcademicCurriculumPlanHomepages(
      semesterId: $semesterId
      staffId: $staffId
      upstreamSessionToken: $upstreamSessionToken
    ) {
      ${ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_LIST_FIELDS}
    }
  }
`;

const LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGES_QUERY = `
  query ListMyAcademicCurriculumPlanHomepages(
    $semesterId: Int!
    $upstreamSessionToken: String!
  ) {
    listMyAcademicCurriculumPlanHomepages(
      semesterId: $semesterId
      upstreamSessionToken: $upstreamSessionToken
    ) {
      ${ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_LIST_FIELDS}
    }
  }
`;

const LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHER_OPTIONS_QUERY = `
  query AcademicCurriculumPlanHomepageTeacherOptions(
    $semesterId: Int!
    $keyword: String
    $limit: Int
  ) {
    listManagedAcademicSemesterPlannedTimetableTeacherOptions(
      semesterId: $semesterId
      keyword: $keyword
      limit: $limit
    ) {
      items {
        staffId
        staffName
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

const SAVE_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_RESULT_FIELDS = `
  upstreamSessionToken
  expiresAt
  code
  success
  msg
  data
  planId
`;

const SAVE_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_MUTATION = `
  mutation SaveAcademicCurriculumPlanHomepage(
    $input: AcademicCurriculumPlanHomepageSaveInput!
  ) {
    saveManagedAcademicCurriculumPlanHomepage(input: $input) {
      ${SAVE_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_RESULT_FIELDS}
    }
  }
`;

const SAVE_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_MUTATION = `
  mutation SaveMyAcademicCurriculumPlanHomepage(
    $input: MyAcademicCurriculumPlanHomepageSaveInput!
  ) {
    saveMyAcademicCurriculumPlanHomepage(input: $input) {
      ${SAVE_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_RESULT_FIELDS}
    }
  }
`;

const PREVIEW_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_PREFILL_QUERY = `
  query PreviewAcademicCurriculumPlanHomepagePrefill(
    $planId: String
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
    $planId: String
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
    $planId: String
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
    $planId: String
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

const LIST_ACADEMIC_SEMESTERS_QUERY = `
  query AcademicSemesters(
    $isCurrent: Boolean
    $isVisible: Boolean
    $limit: Int
    $schoolYear: Int
    $termNumber: Int
  ) {
    academicSemesters(
      isCurrent: $isCurrent
      isVisible: $isVisible
      limit: $limit
      schoolYear: $schoolYear
      termNumber: $termNumber
    ) {
      createdAt
      endDate
      examStartDate
      firstTeachingDate
      id
      isCurrent
      isVisible
      name
      schoolYear
      sortOrder
      startDate
      termNumber
      updatedAt
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

export function isCurriculumPlanHomepagePrefillTimeWindowClosedError(error: unknown): boolean {
  return hasGraphQLDetailCode(error, PREFILL_TIME_WINDOW_CLOSED_ERROR_CODE);
}

export function resolveCurriculumPlanHomepagePrefillErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return resolveUpstreamErrorMessage(error, fallback);
}

export async function requestAcademicSemesters(input: ListAcademicSemestersInput = {}) {
  try {
    const response = await requestGraphQL<
      AcademicSemestersResponse,
      OperationVariables & ListAcademicSemestersInput
    >(LIST_ACADEMIC_SEMESTERS_QUERY, input);

    return response.academicSemesters;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法加载学期列表。'));
  }
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
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
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
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchCurriculumPlanHomepageList;
}

export async function listAcademicCurriculumPlanHomepages(input: {
  mode: CurriculumPlanHomepagePrefillMode;
  semesterId: number;
  staffId: string;
  upstreamSessionToken: string;
}) {
  const commonVariables = {
    semesterId: input.semesterId,
    upstreamSessionToken: input.upstreamSessionToken,
  };

  if (input.mode === 'managed') {
    const response = await executeUpstreamSessionGraphQL<
      AcademicCurriculumPlanHomepageListResponse,
      typeof commonVariables & { staffId: string }
    >(LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGES_QUERY, {
      ...commonVariables,
      staffId: normalizeRequiredString(input.staffId, '教师工号'),
    });

    return response.listManagedAcademicCurriculumPlanHomepages;
  }

  const response = await executeUpstreamSessionGraphQL<
    MyAcademicCurriculumPlanHomepageListResponse,
    typeof commonVariables
  >(LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGES_QUERY, commonVariables);

  return response.listMyAcademicCurriculumPlanHomepages;
}

export async function listAcademicCurriculumPlanHomepageTeacherOptions(input: {
  keyword?: string;
  semesterId: number;
}) {
  const response = await requestGraphQL<
    AcademicCurriculumPlanHomepageTeacherOptionsResponse,
    { keyword: string | null; limit: number; semesterId: number }
  >(LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHER_OPTIONS_QUERY, {
    keyword: normalizeOptionalString(input.keyword),
    limit: 20,
    semesterId: input.semesterId,
  });

  return response.listManagedAcademicSemesterPlannedTimetableTeacherOptions.items;
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
  upstreamSessionToken: string;
}) {
  const response = await executeUpstreamSessionGraphQL<
    CurriculumPlanHomepageDetailResponse,
    {
      planId: string;
      sessionToken: string;
    }
  >(FETCH_CURRICULUM_PLAN_HOMEPAGE_DETAIL_QUERY, {
    planId: normalizeRequiredString(input.planId, '教学计划 ID'),
    sessionToken: input.upstreamSessionToken,
  });

  return response.fetchCurriculumPlanHomepageDetail;
}

export async function saveAcademicCurriculumPlanHomepage(input: {
  homepagePatch: CurriculumPlanHomepagePatch;
  mode: CurriculumPlanHomepagePrefillMode;
  planId: string | null;
  semesterId: number;
  staffId: string;
  teachingClassId: string;
  upstreamSessionToken: string;
}) {
  const commonInput = {
    homepagePatch: input.homepagePatch,
    planId: normalizeOptionalString(input.planId),
    semesterId: input.semesterId,
    teachingClassId: normalizeRequiredString(input.teachingClassId, '教学班 ID'),
    upstreamSessionToken: input.upstreamSessionToken,
  };

  if (input.mode === 'managed') {
    const response = await executeUpstreamSessionGraphQL<
      SaveAcademicCurriculumPlanHomepageResponse,
      { input: typeof commonInput & { staffId: string } }
    >(SAVE_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_MUTATION, {
      input: {
        ...commonInput,
        staffId: normalizeRequiredString(input.staffId, '教师工号'),
      },
    });

    return response.saveManagedAcademicCurriculumPlanHomepage;
  }

  const response = await executeUpstreamSessionGraphQL<
    SaveMyAcademicCurriculumPlanHomepageResponse,
    { input: typeof commonInput }
  >(SAVE_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_MUTATION, { input: commonInput });

  return response.saveMyAcademicCurriculumPlanHomepage;
}

export async function previewCurriculumPlanHomepagePrefill(input: {
  context: CurriculumPlanHomepagePrefillContext;
  mode: CurriculumPlanHomepagePrefillMode;
  overrideTimeWindow?: boolean;
  phase: CurriculumPlanHomepagePrefillPhase;
  planId: string | null;
}) {
  const commonVariables = {
    ...(input.overrideTimeWindow === undefined
      ? {}
      : {
          overrideTimeWindow: input.overrideTimeWindow,
        }),
    phase: input.phase,
    planId: normalizeOptionalString(input.planId),
  };

  if (input.mode === 'managed') {
    const response = await requestGraphQL<
      CurriculumPlanHomepagePrefillResponse,
      {
        context: Required<CurriculumPlanHomepagePrefillContext>;
        overrideTimeWindow?: boolean;
        phase: CurriculumPlanHomepagePrefillPhase;
        planId: string | null;
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
      planId: string | null;
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
  planId: string | null;
  upstreamSessionToken: string;
}) {
  const commonVariables = {
    phase: input.phase,
    planId: normalizeOptionalString(input.planId),
    upstreamSessionToken: input.upstreamSessionToken,
  };

  if (input.mode === 'managed') {
    const response = await executeUpstreamSessionGraphQL<
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
        planId: string | null;
        upstreamSessionToken: string;
      }
    >(LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY, {
      ...commonVariables,
      context: {
        courseName: input.context.courseName,
        schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
        semester: normalizeRequiredString(input.context.semester, '学期'),
        staffId: normalizeRequiredString(input.context.staffId ?? '', '教师 ID'),
        weekCount: input.context.weekCount,
        weeklyHours: input.context.weeklyHours,
      },
    });

    return response.listAcademicCurriculumPlanHomepageReferenceCandidates;
  }

  const response = await executeUpstreamSessionGraphQL<
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
      planId: string | null;
      upstreamSessionToken: string;
    }
  >(LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_REFERENCE_CANDIDATES_QUERY, {
    ...commonVariables,
    context: {
      courseName: input.context.courseName,
      schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
      semester: normalizeRequiredString(input.context.semester, '学期'),
      weekCount: input.context.weekCount,
      weeklyHours: input.context.weeklyHours,
    },
  });

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
    const response = await executeUpstreamSessionGraphQL<
      CurriculumPlanHomepageTeachingEndChapterCandidatesResponse,
      {
        phase: CurriculumPlanHomepagePrefillPhase;
        planId: string;
        upstreamSessionToken: string;
      }
    >(LIST_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY, {
      ...commonVariables,
    });

    return response.listAcademicCurriculumPlanHomepageTeachingEndChapterCandidates;
  }

  const response = await executeUpstreamSessionGraphQL<
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
  >(LIST_MY_ACADEMIC_CURRICULUM_PLAN_HOMEPAGE_TEACHING_END_CHAPTER_CANDIDATES_QUERY, {
    ...commonVariables,
    context: {
      schoolYear: normalizeRequiredString(input.context.schoolYear, '学年'),
      semester: normalizeRequiredString(input.context.semester, '学期'),
    },
  });

  return response.listMyAcademicCurriculumPlanHomepageTeachingEndChapterCandidates;
}
