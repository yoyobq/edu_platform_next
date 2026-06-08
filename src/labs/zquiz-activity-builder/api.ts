// src/labs/zquiz-activity-builder/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
  normalizeTextListValue,
} from '@/shared/form-normalization';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizActivityMode = 'EXAM' | 'PRACTICE';
export type ZquizActivityStatus = 'CLOSED' | 'DRAFT' | 'PUBLISHED';
export type ZquizBankStatus = 'ACTIVE' | 'ARCHIVED';
export type ZquizQuestionStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
export type ZquizQuestionType =
  | 'ESSAY'
  | 'FILL_BLANK'
  | 'MULTIPLE_CHOICE'
  | 'SINGLE_CHOICE'
  | 'TRUE_FALSE';

export type ZquizTeacherBank = {
  code: string;
  id: number;
  name: string;
  sortOrder: number;
  status: ZquizBankStatus;
};

export type ZquizTeacherActivitySummary = {
  attemptLimit: number | null;
  bankId: number;
  createdByAccountId: number | null;
  durationMinutes: number | null;
  endsAt: string | null;
  id: number;
  itemCount: number;
  mode: ZquizActivityMode;
  startsAt: string | null;
  status: ZquizActivityStatus;
  targetCount: number;
  title: string;
  updatedAt: string;
};

export type ZquizAssemblyQuestionOption = {
  content: string;
  id: number;
  isCorrect: boolean;
  label: string;
  questionId: number;
  sortOrder: number;
};

export type ZquizAssemblyQuestion = {
  bankId: number;
  explanation: string | null;
  id: number;
  knowledgeNodeIds: number[];
  options: ZquizAssemblyQuestionOption[];
  sortOrder: number;
  status: ZquizQuestionStatus;
  stem: string;
  type: ZquizQuestionType;
};

export type ZquizActivityTarget = {
  classCodeSnapshot: string | null;
  classId: string;
  classNameSnapshot: string;
};

export type ZquizActivityItem = {
  question: ZquizAssemblyQuestion | null;
  questionId: number;
  scoreMax: number;
  sortOrder: number;
};

export type ZquizTeacherActivityDetail = {
  attemptLimit: number | null;
  bankId: number;
  createdAt: string;
  createdByAccountId: number | null;
  durationMinutes: number | null;
  endsAt: string | null;
  id: number;
  items: ZquizActivityItem[];
  mode: ZquizActivityMode;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  startsAt: string | null;
  status: ZquizActivityStatus;
  targets: ZquizActivityTarget[];
  title: string;
  updatedAt: string;
};

export type LocalClassOption = {
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
};

export type ListZquizBanksInput = {
  keyword?: string | null;
  limit?: number | null;
  status?: ZquizBankStatus | null;
};

export type ListZquizTeacherActivitiesInput = {
  bankId?: number | null;
  keyword?: string | null;
  limit?: number | null;
  mode?: ZquizActivityMode | null;
  status?: ZquizActivityStatus | null;
};

export type ListZquizAssemblyQuestionsInput = {
  bankId: number;
  keyword?: string | null;
  knowledgeNodeId?: number | null;
  limit?: number | null;
  questionType?: ZquizQuestionType | null;
};

export type ListLocalClassOptionsInput = {
  departmentId?: string | null;
  keyword?: string | null;
};

export type ZquizActivityDraftItemSource = {
  questionId: number;
  scoreMax: number;
};

export type ZquizActivityDraftSource = {
  activityId?: number | null;
  attemptLimit?: number | null;
  bankId?: number | null;
  durationMinutes?: number | null;
  endsAt?: string | null;
  items?: readonly ZquizActivityDraftItemSource[] | null;
  shuffleOptions?: boolean | null;
  shuffleQuestions?: boolean | null;
  startsAt?: string | null;
  targetClassIds?: readonly string[] | null;
  title?: string | null;
};

export type SaveZquizActivityDraftInput = {
  activityId: number | null;
  attemptLimit: number | null;
  bankId: number;
  durationMinutes: number | null;
  endsAt: string | null;
  items: {
    questionId: number;
    scoreMax: number;
    sortOrder: number;
  }[];
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  startsAt: string | null;
  targetClassIds: string[];
  title: string;
};

export type ZquizPublishValidationSource = Pick<
  SaveZquizActivityDraftInput,
  'durationMinutes' | 'endsAt' | 'items' | 'startsAt' | 'targetClassIds'
> & {
  mode: ZquizActivityMode;
};

type ListZquizBanksResponse = {
  listZquizBanks: ZquizTeacherBank[];
};

type ListZquizTeacherActivitiesResponse = {
  listZquizTeacherActivities: ZquizTeacherActivitySummary[];
};

type ListZquizAssemblyQuestionsResponse = {
  listZquizAssemblyQuestions: ZquizAssemblyQuestion[];
};

type ListLocalClassOptionsResponse = {
  listLocalClassOptions: LocalClassOption[];
};

type SaveZquizPracticeDraftResponse = {
  saveZquizPracticeDraft: Omit<ZquizTeacherActivityDetail, 'mode'>;
};

type SaveZquizExamDraftResponse = {
  saveZquizExamDraft: Omit<ZquizTeacherActivityDetail, 'mode'>;
};

type GetZquizPracticeTeacherDetailResponse = {
  getZquizPracticeTeacherDetail: Omit<ZquizTeacherActivityDetail, 'mode'> | null;
};

type GetZquizExamTeacherDetailResponse = {
  getZquizExamTeacherDetail: Omit<ZquizTeacherActivityDetail, 'mode'> | null;
};

type PublishZquizPracticeResponse = {
  publishZquizPractice: Omit<ZquizTeacherActivityDetail, 'mode'>;
};

type PublishZquizExamResponse = {
  publishZquizExam: Omit<ZquizTeacherActivityDetail, 'mode'>;
};

const BUSINESS_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;

const ZQUIZ_ASSEMBLY_QUESTION_FIELDS = `
  id
  bankId
  type
  stem
  explanation
  status
  sortOrder
  knowledgeNodeIds
  options {
    id
    questionId
    label
    content
    isCorrect
    sortOrder
  }
`;

const ZQUIZ_ACTIVITY_DETAIL_FIELDS = `
  id
  title
  bankId
  status
  startsAt
  endsAt
  durationMinutes
  attemptLimit
  shuffleQuestions
  shuffleOptions
  createdByAccountId
  createdAt
  updatedAt
  targets {
    classId
    classCodeSnapshot
    classNameSnapshot
  }
  items {
    questionId
    scoreMax
    sortOrder
    question {
      ${ZQUIZ_ASSEMBLY_QUESTION_FIELDS}
    }
  }
`;

const LIST_ZQUIZ_BANKS_QUERY = `
  query listZquizBanks($input: ListZquizBanksInput) {
    listZquizBanks(input: $input) {
      id
      code
      name
      status
      sortOrder
    }
  }
`;

const LIST_ZQUIZ_TEACHER_ACTIVITIES_QUERY = `
  query listZquizTeacherActivities($input: ListZquizTeacherActivitiesInput) {
    listZquizTeacherActivities(input: $input) {
      id
      mode
      title
      bankId
      status
      startsAt
      endsAt
      durationMinutes
      attemptLimit
      createdByAccountId
      updatedAt
      targetCount
      itemCount
    }
  }
`;

const LIST_ZQUIZ_ASSEMBLY_QUESTIONS_QUERY = `
  query listZquizAssemblyQuestions($input: ListZquizAssemblyQuestionsInput!) {
    listZquizAssemblyQuestions(input: $input) {
      ${ZQUIZ_ASSEMBLY_QUESTION_FIELDS}
    }
  }
`;

const LIST_LOCAL_CLASS_OPTIONS_QUERY = `
  query ZquizActivityBuilderLocalClassOptions($input: ListLocalClassOptionsInput) {
    listLocalClassOptions(input: $input) {
      id
      departmentId
      classCode
      className
      gradeYear
    }
  }
`;

const SAVE_ZQUIZ_PRACTICE_DRAFT_MUTATION = `
  mutation saveZquizPracticeDraft($input: SaveZquizPracticeDraftInput!) {
    saveZquizPracticeDraft(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

const SAVE_ZQUIZ_EXAM_DRAFT_MUTATION = `
  mutation saveZquizExamDraft($input: SaveZquizExamDraftInput!) {
    saveZquizExamDraft(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

const GET_ZQUIZ_PRACTICE_TEACHER_DETAIL_QUERY = `
  query getZquizPracticeTeacherDetail($input: ZquizPracticeInput!) {
    getZquizPracticeTeacherDetail(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

const GET_ZQUIZ_EXAM_TEACHER_DETAIL_QUERY = `
  query getZquizExamTeacherDetail($input: ZquizExamInput!) {
    getZquizExamTeacherDetail(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

const PUBLISH_ZQUIZ_PRACTICE_MUTATION = `
  mutation publishZquizPractice($input: ZquizPracticeInput!) {
    publishZquizPractice(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

const PUBLISH_ZQUIZ_EXAM_MUTATION = `
  mutation publishZquizExam($input: ZquizExamInput!) {
    publishZquizExam(input: $input) {
      ${ZQUIZ_ACTIVITY_DETAIL_FIELDS}
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function normalizeLimit(value: number | null | undefined, label = 'limit') {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error(`${label} 必须是 1 到 200 之间的整数。`);
  }

  return value;
}

function normalizeRequiredPositiveInteger(value: number | null | undefined, label: string) {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${label} 必须是正整数。`);
  }

  return Number(value);
}

function normalizeOptionalPositiveInteger(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredPositiveInteger(value, label);
}

function normalizeFilterPositiveInteger(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) {
    return undefined;
  }

  return normalizeRequiredPositiveInteger(value, label);
}

function normalizeScoreMax(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('题目分值必须大于 0。');
  }

  return value;
}

function normalizeOptionalDateTimeText(value: string | null | undefined) {
  const normalized = normalizeOptionalTextValue(value, 'to_null');

  if (normalized && !BUSINESS_DATETIME_PATTERN.test(normalized)) {
    throw new Error('时间必须是不带时区的业务时间，格式为 YYYY-MM-DD HH:mm:ss.SSS。');
  }

  return normalized;
}

function normalizeQuestion(question: ZquizAssemblyQuestion): ZquizAssemblyQuestion {
  return {
    ...question,
    explanation: question.explanation || null,
    knowledgeNodeIds: [...question.knowledgeNodeIds],
    options: [...question.options].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

function normalizeDetail(
  mode: ZquizActivityMode,
  detail: Omit<ZquizTeacherActivityDetail, 'mode'>,
): ZquizTeacherActivityDetail {
  return {
    ...detail,
    attemptLimit: detail.attemptLimit ?? null,
    durationMinutes: detail.durationMinutes ?? null,
    endsAt: detail.endsAt || null,
    items: [...detail.items]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item) => ({
        ...item,
        question: item.question ? normalizeQuestion(item.question) : null,
      })),
    mode,
    startsAt: detail.startsAt || null,
    targets: detail.targets.map((target) => ({
      ...target,
      classCodeSnapshot: target.classCodeSnapshot || null,
    })),
  };
}

function compactFilterInput<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function toComparableDateTime(value: string) {
  const timestamp = Date.parse(value.replace(' ', 'T'));

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function normalizeListZquizBanksInput(input: ListZquizBanksInput = {}) {
  return compactFilterInput({
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
    limit: normalizeLimit(input.limit),
    status: input.status || undefined,
  });
}

export function normalizeListZquizTeacherActivitiesInput(
  input: ListZquizTeacherActivitiesInput = {},
) {
  return compactFilterInput({
    bankId: normalizeFilterPositiveInteger(input.bankId, '题库 ID'),
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
    limit: normalizeLimit(input.limit),
    mode: input.mode || undefined,
    status: input.status || undefined,
  });
}

export function normalizeListZquizAssemblyQuestionsInput(input: ListZquizAssemblyQuestionsInput) {
  return compactFilterInput({
    bankId: normalizeRequiredPositiveInteger(input.bankId, '题库 ID'),
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
    knowledgeNodeId: normalizeFilterPositiveInteger(input.knowledgeNodeId, '知识点 ID'),
    limit: normalizeLimit(input.limit),
    questionType: input.questionType || undefined,
  });
}

export function normalizeListLocalClassOptionsInput(input: ListLocalClassOptionsInput = {}) {
  return compactFilterInput({
    departmentId: normalizeOptionalTextValue(input.departmentId, 'to_undefined'),
    keyword: normalizeOptionalTextValue(input.keyword, 'to_undefined'),
  });
}

export function buildZquizActivityDraftInput(
  input: ZquizActivityDraftSource,
): SaveZquizActivityDraftInput {
  return {
    activityId: normalizeOptionalPositiveInteger(input.activityId, '活动 ID'),
    attemptLimit: normalizeOptionalPositiveInteger(input.attemptLimit, '作答次数'),
    bankId: normalizeRequiredPositiveInteger(input.bankId, '题库'),
    durationMinutes: normalizeOptionalPositiveInteger(input.durationMinutes, '时长'),
    endsAt: normalizeOptionalDateTimeText(input.endsAt),
    items: (input.items ?? []).map((item, index) => ({
      questionId: normalizeRequiredPositiveInteger(item.questionId, '题目 ID'),
      scoreMax: normalizeScoreMax(item.scoreMax),
      sortOrder: index + 1,
    })),
    shuffleOptions: input.shuffleOptions ?? true,
    shuffleQuestions: input.shuffleQuestions ?? true,
    startsAt: normalizeOptionalDateTimeText(input.startsAt),
    targetClassIds: normalizeTextListValue([...(input.targetClassIds ?? [])], {
      dedupe: true,
      emptyItemPolicy: 'filter',
    }),
    title: normalizeRequiredTextValue(input.title, { label: '活动标题' }),
  };
}

export function validateZquizActivityPublishDraft(input: ZquizPublishValidationSource) {
  const errors: string[] = [];

  if (input.items.length === 0) {
    errors.push('发布前至少选择 1 道题。');
  }

  if (input.targetClassIds.length === 0) {
    errors.push('发布前至少选择 1 个目标班级。');
  }

  if (input.mode === 'EXAM') {
    if (!input.startsAt) {
      errors.push('考试发布前必须填写开始时间。');
    }

    if (!input.endsAt) {
      errors.push('考试发布前必须填写结束时间。');
    }

    if (!input.durationMinutes || input.durationMinutes <= 0) {
      errors.push('考试发布前必须填写大于 0 的考试时长。');
    }

    if (input.startsAt && input.endsAt) {
      const startsAt = toComparableDateTime(input.startsAt);
      const endsAt = toComparableDateTime(input.endsAt);
      const isAfterEnd =
        startsAt !== null && endsAt !== null
          ? startsAt > endsAt
          : input.startsAt.localeCompare(input.endsAt) > 0;

      if (isAfterEnd) {
        errors.push('考试开始时间不能晚于结束时间。');
      }
    }
  }

  return errors;
}

export function resolveZquizActivityBuilderErrorMessage(error: unknown, fallback: string) {
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

export async function listZquizBanks(input: ListZquizBanksInput = {}) {
  const response = await requestGraphQL<
    ListZquizBanksResponse,
    {
      input: ReturnType<typeof normalizeListZquizBanksInput>;
    }
  >(LIST_ZQUIZ_BANKS_QUERY, {
    input: normalizeListZquizBanksInput(input),
  });

  return [...response.listZquizBanks].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id - right.id,
  );
}

export async function listZquizTeacherActivities(input: ListZquizTeacherActivitiesInput = {}) {
  const response = await requestGraphQL<
    ListZquizTeacherActivitiesResponse,
    {
      input: ReturnType<typeof normalizeListZquizTeacherActivitiesInput>;
    }
  >(LIST_ZQUIZ_TEACHER_ACTIVITIES_QUERY, {
    input: normalizeListZquizTeacherActivitiesInput(input),
  });

  return response.listZquizTeacherActivities.map((activity) => ({
    ...activity,
    attemptLimit: activity.attemptLimit ?? null,
    durationMinutes: activity.durationMinutes ?? null,
    endsAt: activity.endsAt || null,
    startsAt: activity.startsAt || null,
  }));
}

export async function listZquizAssemblyQuestions(input: ListZquizAssemblyQuestionsInput) {
  const response = await requestGraphQL<
    ListZquizAssemblyQuestionsResponse,
    {
      input: ReturnType<typeof normalizeListZquizAssemblyQuestionsInput>;
    }
  >(LIST_ZQUIZ_ASSEMBLY_QUESTIONS_QUERY, {
    input: normalizeListZquizAssemblyQuestionsInput(input),
  });

  return response.listZquizAssemblyQuestions.map(normalizeQuestion);
}

export async function listLocalClassOptions(input: ListLocalClassOptionsInput = {}) {
  const response = await requestGraphQL<
    ListLocalClassOptionsResponse,
    {
      input: ReturnType<typeof normalizeListLocalClassOptionsInput>;
    }
  >(LIST_LOCAL_CLASS_OPTIONS_QUERY, {
    input: normalizeListLocalClassOptionsInput(input),
  });

  return response.listLocalClassOptions;
}

export async function saveZquizPracticeDraft(input: ZquizActivityDraftSource) {
  const response = await requestGraphQL<
    SaveZquizPracticeDraftResponse,
    {
      input: SaveZquizActivityDraftInput;
    }
  >(SAVE_ZQUIZ_PRACTICE_DRAFT_MUTATION, {
    input: buildZquizActivityDraftInput(input),
  });

  return normalizeDetail('PRACTICE', response.saveZquizPracticeDraft);
}

export async function saveZquizExamDraft(input: ZquizActivityDraftSource) {
  const response = await requestGraphQL<
    SaveZquizExamDraftResponse,
    {
      input: SaveZquizActivityDraftInput;
    }
  >(SAVE_ZQUIZ_EXAM_DRAFT_MUTATION, {
    input: buildZquizActivityDraftInput(input),
  });

  return normalizeDetail('EXAM', response.saveZquizExamDraft);
}

export async function saveZquizActivityDraft(
  mode: ZquizActivityMode,
  input: ZquizActivityDraftSource,
) {
  return mode === 'PRACTICE' ? saveZquizPracticeDraft(input) : saveZquizExamDraft(input);
}

export async function getZquizActivityTeacherDetail(input: {
  activityId: number;
  mode: ZquizActivityMode;
}) {
  const variables = {
    input: {
      activityId: normalizeRequiredPositiveInteger(input.activityId, '活动 ID'),
    },
  };

  if (input.mode === 'PRACTICE') {
    const response = await requestGraphQL<GetZquizPracticeTeacherDetailResponse, typeof variables>(
      GET_ZQUIZ_PRACTICE_TEACHER_DETAIL_QUERY,
      variables,
    );

    return response.getZquizPracticeTeacherDetail
      ? normalizeDetail('PRACTICE', response.getZquizPracticeTeacherDetail)
      : null;
  }

  const response = await requestGraphQL<GetZquizExamTeacherDetailResponse, typeof variables>(
    GET_ZQUIZ_EXAM_TEACHER_DETAIL_QUERY,
    variables,
  );

  return response.getZquizExamTeacherDetail
    ? normalizeDetail('EXAM', response.getZquizExamTeacherDetail)
    : null;
}

export async function publishZquizActivity(input: { activityId: number; mode: ZquizActivityMode }) {
  const variables = {
    input: {
      activityId: normalizeRequiredPositiveInteger(input.activityId, '活动 ID'),
    },
  };

  if (input.mode === 'PRACTICE') {
    const response = await requestGraphQL<PublishZquizPracticeResponse, typeof variables>(
      PUBLISH_ZQUIZ_PRACTICE_MUTATION,
      variables,
    );

    return normalizeDetail('PRACTICE', response.publishZquizPractice);
  }

  const response = await requestGraphQL<PublishZquizExamResponse, typeof variables>(
    PUBLISH_ZQUIZ_EXAM_MUTATION,
    variables,
  );

  return normalizeDetail('EXAM', response.publishZquizExam);
}
