// src/labs/zquiz-exam-activities/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizExamAvailability = 'CLOSED' | 'ENDED' | 'NOT_STARTED' | 'OPEN';
export type ZquizExamAttemptStatus = 'ABANDONED' | 'GRADED' | 'IN_PROGRESS' | 'SUBMITTED';
export type ZquizExamAttemptGradingStatus =
  | 'AUTO_GRADED'
  | 'MANUAL_GRADED'
  | 'MANUAL_PENDING'
  | 'NOT_GRADED';
export type ZquizExamAttemptItemGradingStatus =
  | 'AUTO_GRADED'
  | 'MANUAL_GRADED'
  | 'MANUAL_PENDING'
  | 'UNANSWERED';
export type ZquizExamQuestionType =
  | 'ESSAY'
  | 'FILL_BLANK'
  | 'MULTIPLE_CHOICE'
  | 'SINGLE_CHOICE'
  | 'TRUE_FALSE';

export type ZquizExamActivity = {
  attemptLimit: number | null;
  availability: ZquizExamAvailability;
  bankId: number;
  canStart: boolean;
  durationMinutes: number | null;
  endsAt: string | null;
  id: number;
  startsAt: string | null;
  title: string;
};

export type ZquizExamActivityDetail = ZquizExamActivity & {
  items: {
    questionId: number;
    scoreMax: number;
    sortOrder: number;
  }[];
};

export type ZquizExamPaperOption = {
  content: string;
  label: string;
  sortOrder: number;
};

export type ZquizExamPaperBlank = {
  blankNo: number;
  score: number | null;
};

export type ZquizExamPaperAsset = {
  kind: string;
  mimeType: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
  storageKey: string;
};

export type ZquizExamPaperItem = {
  assets: ZquizExamPaperAsset[];
  blanks: ZquizExamPaperBlank[];
  options: ZquizExamPaperOption[];
  paperItemNo: number;
  questionId: number;
  scoreMax: number;
  stem: string;
  type: ZquizExamQuestionType;
};

export type ZquizExamDraftBlankAnswer = {
  answerText: string;
  blankNo: number;
};

export type ZquizExamDraftAnswer = {
  answerText: string | null;
  blankAnswers: ZquizExamDraftBlankAnswer[];
  paperItemNo: number;
  selectedLabels: string[];
};

export type ZquizExamPaper = {
  activity: ZquizExamActivity;
  attemptId: string;
  attemptNo: number;
  deadlineAt: string;
  draftAnswers: ZquizExamDraftAnswer[];
  items: ZquizExamPaperItem[];
  startedAt: string;
};

export type ZquizExamAutosaveResult = {
  attemptId: string;
  draftAnswers: ZquizExamDraftAnswer[];
  lastSavedAt: string;
};

export type ZquizExamSubmitResult = {
  attemptId: string;
  attemptNo: number;
  gradingStatus: ZquizExamAttemptGradingStatus;
  scoreAwarded: number;
  scoreMax: number;
  startedAt: string | null;
  status: ZquizExamAttemptStatus;
  submittedAt: string | null;
};

export type ZquizExamAttemptAnswer = {
  answerText: string | null;
  blankAnswers: ZquizExamDraftBlankAnswer[];
  selectedLabels: string[];
};

export type ZquizExamAttemptItem = ZquizExamPaperItem & {
  answer: ZquizExamAttemptAnswer;
  gradingStatus: ZquizExamAttemptItemGradingStatus;
  isCorrect: boolean | null;
  scoreAwarded: number;
};

export type ZquizExamAttempt = {
  activity: ZquizExamActivity;
  attemptNo: number;
  gradingStatus: ZquizExamAttemptGradingStatus;
  id: string;
  items: ZquizExamAttemptItem[];
  scoreAwarded: number;
  scoreMax: number;
  startedAt: string | null;
  status: ZquizExamAttemptStatus;
  submittedAt: string | null;
};

export type ZquizExamDraftAnswers = Record<string, unknown>;

export type SubmitZquizExamAnswerInput = {
  answerText?: string | null;
  blankAnswers?: ZquizExamDraftBlankAnswer[] | null;
  paperItemNo: number;
  selectedLabels?: string[] | null;
};

type ListMyZquizExamActivitiesResponse = {
  listMyZquizExamActivities: ZquizExamActivity[];
};

type GetMyZquizExamActivityResponse = {
  getMyZquizExamActivity: ZquizExamActivityDetail | null;
};

type StartZquizExamResponse = {
  startZquizExam: ZquizExamPaper;
};

type AutosaveZquizExamResponse = {
  autosaveZquizExam: ZquizExamAutosaveResult;
};

type SubmitZquizExamResponse = {
  submitZquizExam: ZquizExamSubmitResult;
};

type GetMyZquizExamAttemptResponse = {
  getMyZquizExamAttempt: ZquizExamAttempt | null;
};

const EXAM_CONFIGURATION_ERROR_MESSAGE = '考试配置异常，请联系教师';
const EXAM_DEADLINE_ERROR_MESSAGE = '考试已超过提交时间';
const EXAM_CONFIGURATION_ERROR_CODES = new Set([
  'ACTIVITY_TIME_RANGE_INVALID',
  'TIME_INVALID_BUSINESS_DATETIME',
  'ZQUIZ_ACTIVITY_TIME_RANGE_INVALID',
  'ZQUIZ_TIME_INVALID_BUSINESS_DATETIME',
  'ZQUIZ_ERROR.ACTIVITY_TIME_RANGE_INVALID',
  'ZQUIZ_ERROR.TIME_INVALID_BUSINESS_DATETIME',
]);
const EXAM_NOT_OPEN_ERROR_CODES = new Set([
  'ACTIVITY_NOT_OPEN',
  'ZQUIZ_ACTIVITY_NOT_OPEN',
  'ZQUIZ_ERROR.ACTIVITY_NOT_OPEN',
]);

const LIST_MY_ZQUIZ_EXAM_ACTIVITIES_QUERY = `
  query listMyZquizExamActivities {
    listMyZquizExamActivities {
      id
      title
      bankId
      startsAt
      endsAt
      durationMinutes
      attemptLimit
      availability
      canStart
    }
  }
`;

const GET_MY_ZQUIZ_EXAM_ACTIVITY_QUERY = `
  query getMyZquizExamActivity($input: ZquizExamInput!) {
    getMyZquizExamActivity(input: $input) {
      id
      title
      bankId
      startsAt
      endsAt
      durationMinutes
      attemptLimit
      availability
      canStart
      items {
        questionId
        scoreMax
        sortOrder
      }
    }
  }
`;

const START_ZQUIZ_EXAM_MUTATION = `
  mutation startZquizExam($input: ZquizExamInput!) {
    startZquizExam(input: $input) {
      activity {
        id
        title
        bankId
        startsAt
        endsAt
        durationMinutes
        attemptLimit
        availability
        canStart
      }
      attemptId
      attemptNo
      startedAt
      deadlineAt
      items {
        paperItemNo
        questionId
        type
        stem
        scoreMax
        options {
          label
          content
          sortOrder
        }
        blanks {
          blankNo
          score
        }
        assets {
          kind
          storageKey
          originalName
          mimeType
          sizeBytes
          sortOrder
        }
      }
      draftAnswers {
        paperItemNo
        selectedLabels
        blankAnswers {
          blankNo
          answerText
        }
        answerText
      }
    }
  }
`;

const ZQUIZ_EXAM_ATTEMPT_FIELDS = `
  id
  attemptNo
  status
  gradingStatus
  scoreAwarded
  scoreMax
  startedAt
  submittedAt
  activity {
    id
    title
    bankId
    startsAt
    endsAt
    durationMinutes
    attemptLimit
    availability
    canStart
  }
  items {
    paperItemNo
    questionId
    type
    stem
    scoreMax
    scoreAwarded
    isCorrect
    gradingStatus
    options {
      label
      content
      sortOrder
    }
    blanks {
      blankNo
      score
    }
    assets {
      kind
      storageKey
      originalName
      mimeType
      sizeBytes
      sortOrder
    }
    answer {
      selectedLabels
      blankAnswers {
        blankNo
        answerText
      }
      answerText
    }
  }
`;

const AUTOSAVE_ZQUIZ_EXAM_MUTATION = `
  mutation autosaveZquizExam($input: AutosaveZquizExamInput!) {
    autosaveZquizExam(input: $input) {
      attemptId
      lastSavedAt
      draftAnswers {
        paperItemNo
        selectedLabels
        blankAnswers {
          blankNo
          answerText
        }
        answerText
      }
    }
  }
`;

const SUBMIT_ZQUIZ_EXAM_MUTATION = `
  mutation submitZquizExam($input: SubmitZquizExamInput!) {
    submitZquizExam(input: $input) {
      attemptId
      attemptNo
      status
      gradingStatus
      scoreAwarded
      scoreMax
      startedAt
      submittedAt
    }
  }
`;

const GET_MY_ZQUIZ_EXAM_ATTEMPT_QUERY = `
  query getMyZquizExamAttempt($input: ZquizExamAttemptInput!) {
    getMyZquizExamAttempt(input: $input) {
      ${ZQUIZ_EXAM_ATTEMPT_FIELDS}
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function normalizeOptionalString(value: string | null | undefined) {
  return value || null;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value : null;
}

function normalizeActivity(activity: ZquizExamActivity): ZquizExamActivity {
  return {
    attemptLimit: normalizeOptionalNumber(activity.attemptLimit),
    availability: activity.availability,
    bankId: activity.bankId,
    canStart: Boolean(activity.canStart),
    durationMinutes: normalizeOptionalNumber(activity.durationMinutes),
    endsAt: normalizeOptionalString(activity.endsAt),
    id: activity.id,
    startsAt: normalizeOptionalString(activity.startsAt),
    title: activity.title,
  };
}

function normalizeDetail(detail: ZquizExamActivityDetail): ZquizExamActivityDetail {
  return {
    ...normalizeActivity(detail),
    items: detail.items.map((item) => ({
      questionId: item.questionId,
      scoreMax: item.scoreMax,
      sortOrder: item.sortOrder,
    })),
  };
}

function normalizeDraftAnswer(answer: ZquizExamDraftAnswer): ZquizExamDraftAnswer {
  return {
    answerText: normalizeOptionalString(answer.answerText),
    blankAnswers: answer.blankAnswers.map((blankAnswer) => ({
      answerText: blankAnswer.answerText,
      blankNo: blankAnswer.blankNo,
    })),
    paperItemNo: answer.paperItemNo,
    selectedLabels: [...answer.selectedLabels],
  };
}

function normalizePaperItem(item: ZquizExamPaperItem): ZquizExamPaperItem {
  return {
    ...item,
    assets: item.assets.map((asset) => ({
      ...asset,
      mimeType: normalizeOptionalString(asset.mimeType),
      originalName: normalizeOptionalString(asset.originalName),
      sizeBytes: normalizeOptionalNumber(asset.sizeBytes),
    })),
    blanks: item.blanks.map((blank) => ({
      blankNo: blank.blankNo,
      score: normalizeOptionalNumber(blank.score),
    })),
    options: [...item.options].sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

function normalizePaper(paper: ZquizExamPaper): ZquizExamPaper {
  return {
    activity: normalizeActivity(paper.activity),
    attemptId: paper.attemptId,
    attemptNo: paper.attemptNo,
    deadlineAt: paper.deadlineAt,
    draftAnswers: paper.draftAnswers.map(normalizeDraftAnswer),
    items: paper.items.map(normalizePaperItem),
    startedAt: paper.startedAt,
  };
}

function normalizeAutosaveResult(result: ZquizExamAutosaveResult): ZquizExamAutosaveResult {
  return {
    attemptId: result.attemptId,
    draftAnswers: result.draftAnswers.map(normalizeDraftAnswer),
    lastSavedAt: result.lastSavedAt,
  };
}

function normalizeSubmitResult(result: ZquizExamSubmitResult): ZquizExamSubmitResult {
  return {
    attemptId: result.attemptId,
    attemptNo: result.attemptNo,
    gradingStatus: result.gradingStatus,
    scoreAwarded: result.scoreAwarded,
    scoreMax: result.scoreMax,
    startedAt: normalizeOptionalString(result.startedAt),
    status: result.status,
    submittedAt: normalizeOptionalString(result.submittedAt),
  };
}

function normalizeAttemptAnswer(answer: ZquizExamAttemptAnswer): ZquizExamAttemptAnswer {
  return {
    answerText: normalizeOptionalString(answer.answerText),
    blankAnswers: answer.blankAnswers.map((blankAnswer) => ({
      answerText: blankAnswer.answerText,
      blankNo: blankAnswer.blankNo,
    })),
    selectedLabels: [...answer.selectedLabels],
  };
}

function normalizeAttemptItem(item: ZquizExamAttemptItem): ZquizExamAttemptItem {
  return {
    ...normalizePaperItem(item),
    answer: normalizeAttemptAnswer(item.answer),
    gradingStatus: item.gradingStatus,
    isCorrect: item.isCorrect,
    scoreAwarded: item.scoreAwarded,
  };
}

function normalizeAttempt(attempt: ZquizExamAttempt): ZquizExamAttempt {
  return {
    activity: normalizeActivity(attempt.activity),
    attemptNo: attempt.attemptNo,
    gradingStatus: attempt.gradingStatus,
    id: attempt.id,
    items: attempt.items.map(normalizeAttemptItem),
    scoreAwarded: attempt.scoreAwarded,
    scoreMax: attempt.scoreMax,
    startedAt: normalizeOptionalString(attempt.startedAt),
    status: attempt.status,
    submittedAt: normalizeOptionalString(attempt.submittedAt),
  };
}

function getGraphQLErrorCodes(error: unknown) {
  if (!isGraphQLIngressError(error)) {
    return [];
  }

  return (
    error.graphqlErrors?.flatMap((graphqlError) => {
      const extensions = graphqlError.extensions as Record<string, unknown> | undefined;
      return [extensions?.code, extensions?.errorCode, extensions?.errorName, graphqlError.message]
        .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
        .map((code) => code.trim());
    }) ?? []
  );
}

function hasGraphQLErrorCode(error: unknown, codes: ReadonlySet<string>) {
  return getGraphQLErrorCodes(error).some((code) => codes.has(code));
}

function resolveGraphQLErrorMessage(
  error: unknown,
  fallback: string,
  options: {
    mapNotOpenToDeadline?: boolean;
  } = {},
) {
  if (hasGraphQLErrorCode(error, EXAM_CONFIGURATION_ERROR_CODES)) {
    return EXAM_CONFIGURATION_ERROR_MESSAGE;
  }

  if (options.mapNotOpenToDeadline && hasGraphQLErrorCode(error, EXAM_NOT_OPEN_ERROR_CODES)) {
    return EXAM_DEADLINE_ERROR_MESSAGE;
  }

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

function normalizeSelectedLabels(value: unknown, maxCount: number) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const normalized = values
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized)).slice(0, maxCount);
}

function normalizeDraftText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildChoiceSubmitAnswer(
  item: ZquizExamPaperItem,
  draftAnswer: unknown,
): SubmitZquizExamAnswerInput | null {
  const selectedLabels = normalizeSelectedLabels(
    draftAnswer,
    item.type === 'MULTIPLE_CHOICE' ? item.options.length : 1,
  );

  return selectedLabels.length > 0
    ? {
        paperItemNo: item.paperItemNo,
        selectedLabels,
      }
    : null;
}

function buildFillBlankSubmitAnswer(
  item: ZquizExamPaperItem,
  draftAnswer: unknown,
): SubmitZquizExamAnswerInput | null {
  if (!draftAnswer || typeof draftAnswer !== 'object' || Array.isArray(draftAnswer)) {
    return null;
  }

  const source = draftAnswer as Record<string, unknown>;
  const blankAnswers = item.blanks
    .map((blank) => ({
      answerText: normalizeDraftText(source[String(blank.blankNo)]),
      blankNo: blank.blankNo,
    }))
    .filter((blankAnswer) => blankAnswer.answerText.length > 0);

  return blankAnswers.length > 0
    ? {
        blankAnswers,
        paperItemNo: item.paperItemNo,
      }
    : null;
}

function buildEssaySubmitAnswer(
  item: ZquizExamPaperItem,
  draftAnswer: unknown,
): SubmitZquizExamAnswerInput | null {
  const answerText = normalizeDraftText(draftAnswer);

  return answerText
    ? {
        answerText,
        paperItemNo: item.paperItemNo,
      }
    : null;
}

export function buildZquizExamAnswers(
  items: ZquizExamPaperItem[],
  draftAnswers: ZquizExamDraftAnswers,
): SubmitZquizExamAnswerInput[] {
  const submitAnswers: SubmitZquizExamAnswerInput[] = [];

  for (const item of items) {
    const draftAnswer = draftAnswers[String(item.paperItemNo)];
    const submitAnswer =
      item.type === 'FILL_BLANK'
        ? buildFillBlankSubmitAnswer(item, draftAnswer)
        : item.type === 'ESSAY'
          ? buildEssaySubmitAnswer(item, draftAnswer)
          : buildChoiceSubmitAnswer(item, draftAnswer);

    if (submitAnswer) {
      submitAnswers.push(submitAnswer);
    }
  }

  return submitAnswers;
}

export function buildZquizExamDraftAnswersFromServer(
  items: ZquizExamPaperItem[],
  draftAnswers: ZquizExamDraftAnswer[],
): ZquizExamDraftAnswers {
  const itemByNo = new Map(items.map((item) => [item.paperItemNo, item]));
  const result: ZquizExamDraftAnswers = {};

  for (const answer of draftAnswers) {
    const item = itemByNo.get(answer.paperItemNo);

    if (!item) {
      continue;
    }

    if (
      item.type === 'SINGLE_CHOICE' ||
      item.type === 'TRUE_FALSE' ||
      item.type === 'MULTIPLE_CHOICE'
    ) {
      result[String(item.paperItemNo)] =
        item.type === 'MULTIPLE_CHOICE'
          ? [...answer.selectedLabels]
          : (answer.selectedLabels[0] ?? '');
      continue;
    }

    if (item.type === 'FILL_BLANK') {
      result[String(item.paperItemNo)] = Object.fromEntries(
        answer.blankAnswers.map((blankAnswer) => [
          String(blankAnswer.blankNo),
          blankAnswer.answerText,
        ]),
      );
      continue;
    }

    result[String(item.paperItemNo)] = answer.answerText ?? '';
  }

  return result;
}

export function resolveZquizExamErrorMessage(error: unknown, fallback: string) {
  return resolveGraphQLErrorMessage(error, fallback);
}

export async function listMyZquizExamActivities() {
  try {
    const response = await requestGraphQL<ListMyZquizExamActivitiesResponse, Record<string, never>>(
      LIST_MY_ZQUIZ_EXAM_ACTIVITIES_QUERY,
      {},
    );

    return response.listMyZquizExamActivities.map(normalizeActivity);
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取可选考试列表。'));
  }
}

export async function getMyZquizExamActivity(input: { activityId: number }) {
  try {
    const response = await requestGraphQL<
      GetMyZquizExamActivityResponse,
      {
        input: {
          activityId: number;
        };
      }
    >(GET_MY_ZQUIZ_EXAM_ACTIVITY_QUERY, {
      input: {
        activityId: input.activityId,
      },
    });

    return response.getMyZquizExamActivity
      ? normalizeDetail(response.getMyZquizExamActivity)
      : null;
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取考试详情。'));
  }
}

export async function startZquizExam(input: { activityId: number }) {
  try {
    const response = await requestGraphQL<
      StartZquizExamResponse,
      {
        input: {
          activityId: number;
        };
      }
    >(START_ZQUIZ_EXAM_MUTATION, {
      input: {
        activityId: input.activityId,
      },
    });

    return normalizePaper(response.startZquizExam);
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法开始考试。'));
  }
}

export async function autosaveZquizExam(input: {
  answers: SubmitZquizExamAnswerInput[];
  attemptId: string;
}) {
  try {
    const response = await requestGraphQL<
      AutosaveZquizExamResponse,
      {
        input: {
          answers: SubmitZquizExamAnswerInput[];
          attemptId: string;
        };
      }
    >(AUTOSAVE_ZQUIZ_EXAM_MUTATION, {
      input: {
        answers: input.answers,
        attemptId: input.attemptId,
      },
    });

    return normalizeAutosaveResult(response.autosaveZquizExam);
  } catch (error) {
    throw new Error(
      resolveGraphQLErrorMessage(error, '暂时无法保存考试答案。', {
        mapNotOpenToDeadline: true,
      }),
    );
  }
}

export async function submitZquizExam(input: {
  answers: SubmitZquizExamAnswerInput[];
  attemptId: string;
}) {
  try {
    const response = await requestGraphQL<
      SubmitZquizExamResponse,
      {
        input: {
          answers: SubmitZquizExamAnswerInput[];
          attemptId: string;
        };
      }
    >(SUBMIT_ZQUIZ_EXAM_MUTATION, {
      input: {
        answers: input.answers,
        attemptId: input.attemptId,
      },
    });

    return normalizeSubmitResult(response.submitZquizExam);
  } catch (error) {
    throw new Error(
      resolveGraphQLErrorMessage(error, '暂时无法提交考试。', {
        mapNotOpenToDeadline: true,
      }),
    );
  }
}

export async function getMyZquizExamAttempt(input: {
  activityId: number;
  attemptId?: string | null;
}) {
  try {
    const response = await requestGraphQL<
      GetMyZquizExamAttemptResponse,
      {
        input: {
          activityId: number;
          attemptId?: string | null;
        };
      }
    >(GET_MY_ZQUIZ_EXAM_ATTEMPT_QUERY, {
      input: {
        activityId: input.activityId,
        attemptId: input.attemptId ?? null,
      },
    });

    return response.getMyZquizExamAttempt ? normalizeAttempt(response.getMyZquizExamAttempt) : null;
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取考试结果。'));
  }
}
