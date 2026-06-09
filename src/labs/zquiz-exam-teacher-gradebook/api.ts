// src/labs/zquiz-exam-teacher-gradebook/api.ts

import type { OperationVariables } from '@apollo/client';

import { normalizeOptionalTextValue } from '@/shared/form-normalization';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizExamScorePolicy = 'HIGHEST_SCORE' | 'LATEST_ATTEMPT';
export type ZquizActivityStatus = 'CLOSED' | 'DRAFT' | 'PUBLISHED';
export type ZquizAttemptStatus = 'ABANDONED' | 'GRADED' | 'IN_PROGRESS' | 'SUBMITTED';
export type ZquizAttemptGradingStatus =
  | 'AUTO_GRADED'
  | 'MANUAL_GRADED'
  | 'MANUAL_PENDING'
  | 'NOT_GRADED';
export type ZquizQuestionStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
export type ZquizQuestionType =
  | 'ESSAY'
  | 'FILL_BLANK'
  | 'MULTIPLE_CHOICE'
  | 'SINGLE_CHOICE'
  | 'TRUE_FALSE';

export type ZquizExamGradebookAttempt = {
  attemptId: string;
  attemptNo: number;
  gradingStatus: ZquizAttemptGradingStatus;
  scoreAwarded: number;
  scoreMax: number;
  startedAt: string | null;
  status: ZquizAttemptStatus;
  submittedAt: string | null;
};

export type ZquizExamGradebookStudent = {
  accountId: number | null;
  classCode: string;
  className: string;
  latestAttempt: ZquizExamGradebookAttempt | null;
  scoreAwarded: number | null;
  scoreMax: number | null;
  scoreRate: number | null;
  selectedAttempt: ZquizExamGradebookAttempt | null;
  studentId: string;
  studentName: string;
};

export type ZquizExamTeacherGradebook = {
  activityId: number;
  completedStudentCount: number;
  rows: ZquizExamGradebookStudent[];
  scorePolicy: ZquizExamScorePolicy;
  targetStudentCount: number;
};

export type ZquizExamQuestionAnalysisItem = {
  answeredAttemptCount: number;
  attemptCount: number;
  averageScoreRate: number | null;
  correctCount: number;
  correctRate: number | null;
  incorrectCount: number;
  manualPendingCount: number;
  questionId: number;
  questionStatus: ZquizQuestionStatus | null;
  questionType: ZquizQuestionType;
  scoreAwardedSum: number;
  scoreMaxSum: number;
  stem: string | null;
  unansweredAttemptCount: number;
};

export type ZquizExamQuestionAnalysis = {
  activityId: number;
  items: ZquizExamQuestionAnalysisItem[];
  scorePolicy: ZquizExamScorePolicy;
  selectedAttemptCount: number;
};

export type ZquizTeacherExamActivity = {
  endsAt: string | null;
  id: number;
  itemCount: number;
  startsAt: string | null;
  status: ZquizActivityStatus;
  targetCount: number;
  title: string;
  updatedAt: string;
};

export type ZquizExamTarget = {
  classCodeSnapshot: string | null;
  classId: string;
  classNameSnapshot: string;
};

export type ZquizExamTeacherTargetDetail = {
  id: number;
  status: ZquizActivityStatus;
  targets: ZquizExamTarget[];
  title: string;
};

export type ListZquizTeacherExamActivitiesInput = {
  keyword?: string | null;
  limit?: number | null;
  status?: ZquizActivityStatus | null;
};

export type ZquizExamTeacherGradebookInput = {
  activityId: number | null | undefined;
  classId?: string | null;
  scorePolicy?: ZquizExamScorePolicy | null;
};

export type ZquizExamQuestionAnalysisInput = {
  activityId: number | null | undefined;
  scorePolicy?: ZquizExamScorePolicy | null;
};

type GetZquizExamTeacherGradebookResponse = {
  getZquizExamTeacherGradebook: ZquizExamTeacherGradebook;
};

type GetZquizExamQuestionAnalysisResponse = {
  getZquizExamQuestionAnalysis: ZquizExamQuestionAnalysis;
};

type ListZquizTeacherExamActivitiesResponse = {
  listZquizTeacherActivities: ZquizTeacherExamActivity[];
};

type GetZquizExamTeacherTargetsResponse = {
  getZquizExamTeacherDetail: ZquizExamTeacherTargetDetail | null;
};

const SCORE_POLICIES = new Set<ZquizExamScorePolicy>(['LATEST_ATTEMPT', 'HIGHEST_SCORE']);

const ZQUIZ_EXAM_GRADEBOOK_ATTEMPT_FIELDS = `
  attemptId
  attemptNo
  status
  gradingStatus
  scoreAwarded
  scoreMax
  startedAt
  submittedAt
`;

const GET_ZQUIZ_EXAM_TEACHER_GRADEBOOK_QUERY = `
  query getZquizExamTeacherGradebook($input: ZquizExamTeacherGradebookInput!) {
    getZquizExamTeacherGradebook(input: $input) {
      activityId
      scorePolicy
      targetStudentCount
      completedStudentCount
      rows {
        accountId
        studentId
        studentName
        classCode
        className
        scoreAwarded
        scoreMax
        scoreRate
        selectedAttempt {
          ${ZQUIZ_EXAM_GRADEBOOK_ATTEMPT_FIELDS}
        }
        latestAttempt {
          ${ZQUIZ_EXAM_GRADEBOOK_ATTEMPT_FIELDS}
        }
      }
    }
  }
`;

const GET_ZQUIZ_EXAM_QUESTION_ANALYSIS_QUERY = `
  query getZquizExamQuestionAnalysis($input: ZquizExamQuestionAnalysisInput!) {
    getZquizExamQuestionAnalysis(input: $input) {
      activityId
      scorePolicy
      selectedAttemptCount
      items {
        questionId
        questionType
        stem
        questionStatus
        attemptCount
        answeredAttemptCount
        unansweredAttemptCount
        correctCount
        incorrectCount
        manualPendingCount
        scoreAwardedSum
        scoreMaxSum
        averageScoreRate
        correctRate
      }
    }
  }
`;

const LIST_ZQUIZ_TEACHER_EXAM_ACTIVITIES_QUERY = `
  query listZquizTeacherExamActivities($input: ListZquizTeacherActivitiesInput) {
    listZquizTeacherActivities(input: $input) {
      id
      title
      status
      startsAt
      endsAt
      targetCount
      itemCount
      updatedAt
    }
  }
`;

const GET_ZQUIZ_EXAM_TEACHER_TARGETS_QUERY = `
  query getZquizExamTeacherTargets($input: ZquizExamInput!) {
    getZquizExamTeacherDetail(input: $input) {
      id
      title
      status
      targets {
        classId
        classCodeSnapshot
        classNameSnapshot
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

function compactInput<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function normalizeRequiredPositiveInteger(value: number | null | undefined, label: string) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${label} 必须是正整数。`);
  }

  return Number(value);
}

function normalizeLimit(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error('limit 必须是 1 到 200 之间的整数。');
  }

  return value;
}

function normalizeScorePolicy(value: ZquizExamScorePolicy | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!SCORE_POLICIES.has(value)) {
    throw new Error('成绩策略无效。');
  }

  return value;
}

function normalizeAttempt(
  attempt: ZquizExamGradebookAttempt | null | undefined,
): ZquizExamGradebookAttempt | null {
  if (!attempt) {
    return null;
  }

  return {
    ...attempt,
    startedAt: attempt.startedAt || null,
    submittedAt: attempt.submittedAt || null,
  };
}

function normalizeGradebook(gradebook: ZquizExamTeacherGradebook): ZquizExamTeacherGradebook {
  return {
    ...gradebook,
    rows: gradebook.rows.map((row) => ({
      ...row,
      accountId: row.accountId ?? null,
      latestAttempt: normalizeAttempt(row.latestAttempt),
      scoreAwarded: row.scoreAwarded ?? null,
      scoreMax: row.scoreMax ?? null,
      scoreRate: row.scoreRate ?? null,
      selectedAttempt: normalizeAttempt(row.selectedAttempt),
    })),
  };
}

function normalizeQuestionAnalysis(analysis: ZquizExamQuestionAnalysis): ZquizExamQuestionAnalysis {
  return {
    ...analysis,
    items: analysis.items.map((item) => ({
      ...item,
      averageScoreRate: item.averageScoreRate ?? null,
      correctRate: item.correctRate ?? null,
      questionStatus: item.questionStatus ?? null,
      stem: item.stem || null,
    })),
  };
}

function normalizeTeacherExamActivity(
  activity: ZquizTeacherExamActivity,
): ZquizTeacherExamActivity {
  return {
    ...activity,
    endsAt: activity.endsAt || null,
    startsAt: activity.startsAt || null,
  };
}

function normalizeTargetDetail(
  detail: ZquizExamTeacherTargetDetail | null,
): ZquizExamTeacherTargetDetail | null {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    targets: detail.targets.map((target) => ({
      ...target,
      classCodeSnapshot: target.classCodeSnapshot || null,
    })),
  };
}

export function normalizeListZquizTeacherExamActivitiesInput(
  input: ListZquizTeacherExamActivitiesInput = {},
) {
  return compactInput({
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
    limit: normalizeLimit(input.limit),
    mode: 'EXAM' as const,
    status: input.status || undefined,
  });
}

export function normalizeZquizExamTeacherGradebookInput(input: ZquizExamTeacherGradebookInput) {
  return compactInput({
    activityId: normalizeRequiredPositiveInteger(input.activityId, '活动 ID'),
    classId: normalizeOptionalTextValue(input.classId, 'to_undefined'),
    scorePolicy: normalizeScorePolicy(input.scorePolicy),
  });
}

export function normalizeZquizExamQuestionAnalysisInput(input: ZquizExamQuestionAnalysisInput) {
  return compactInput({
    activityId: normalizeRequiredPositiveInteger(input.activityId, '活动 ID'),
    scorePolicy: normalizeScorePolicy(input.scorePolicy),
  });
}

export function resolveZquizExamTeacherGradebookErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string' && extensions.errorMessage.trim()) {
      return extensions.errorMessage;
    }

    if (
      typeof firstError?.message === 'string' &&
      firstError.message.trim() &&
      firstError.message !== extensions.code &&
      firstError.message !== extensions.errorCode
    ) {
      return firstError.message;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function listZquizTeacherExamActivities(
  input: ListZquizTeacherExamActivitiesInput = {},
) {
  const response = await requestGraphQL<
    ListZquizTeacherExamActivitiesResponse,
    {
      input: ReturnType<typeof normalizeListZquizTeacherExamActivitiesInput>;
    }
  >(LIST_ZQUIZ_TEACHER_EXAM_ACTIVITIES_QUERY, {
    input: normalizeListZquizTeacherExamActivitiesInput(input),
  });

  return response.listZquizTeacherActivities.map(normalizeTeacherExamActivity);
}

export async function getZquizExamTeacherTargets(input: { activityId: number }) {
  const variables = {
    input: {
      activityId: normalizeRequiredPositiveInteger(input.activityId, '活动 ID'),
    },
  };
  const response = await requestGraphQL<GetZquizExamTeacherTargetsResponse, typeof variables>(
    GET_ZQUIZ_EXAM_TEACHER_TARGETS_QUERY,
    variables,
  );

  return normalizeTargetDetail(response.getZquizExamTeacherDetail);
}

export async function getZquizExamTeacherGradebook(input: ZquizExamTeacherGradebookInput) {
  const response = await requestGraphQL<
    GetZquizExamTeacherGradebookResponse,
    {
      input: ReturnType<typeof normalizeZquizExamTeacherGradebookInput>;
    }
  >(GET_ZQUIZ_EXAM_TEACHER_GRADEBOOK_QUERY, {
    input: normalizeZquizExamTeacherGradebookInput(input),
  });

  return normalizeGradebook(response.getZquizExamTeacherGradebook);
}

export async function getZquizExamQuestionAnalysis(input: ZquizExamQuestionAnalysisInput) {
  const response = await requestGraphQL<
    GetZquizExamQuestionAnalysisResponse,
    {
      input: ReturnType<typeof normalizeZquizExamQuestionAnalysisInput>;
    }
  >(GET_ZQUIZ_EXAM_QUESTION_ANALYSIS_QUERY, {
    input: normalizeZquizExamQuestionAnalysisInput(input),
  });

  return normalizeQuestionAnalysis(response.getZquizExamQuestionAnalysis);
}
