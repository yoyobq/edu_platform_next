// src/labs/zquiz-practice-activities/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizPracticeAvailability = 'NOT_STARTED' | 'OPEN' | 'ENDED' | 'CLOSED';
export type ZquizPracticeAttemptStatus = 'ABANDONED' | 'GRADED' | 'IN_PROGRESS' | 'SUBMITTED';
export type ZquizPracticeAttemptGradingStatus =
  | 'AUTO_GRADED'
  | 'MANUAL_GRADED'
  | 'MANUAL_PENDING'
  | 'NOT_GRADED';
export type ZquizPracticeAttemptItemGradingStatus =
  | 'AUTO_GRADED'
  | 'MANUAL_GRADED'
  | 'MANUAL_PENDING'
  | 'UNANSWERED';

export type ZquizPracticeActivity = {
  attemptLimit: number | null;
  availability: ZquizPracticeAvailability;
  bankId?: number;
  canStart: boolean;
  durationMinutes: number | null;
  endsAt: string | null;
  id: number;
  startsAt: string | null;
  title: string;
};

export type ZquizPracticeQuestionType =
  | 'ESSAY'
  | 'FILL_BLANK'
  | 'MULTIPLE_CHOICE'
  | 'SINGLE_CHOICE'
  | 'TRUE_FALSE';

export type ZquizPracticePaperOption = {
  content: string;
  label: string;
  sortOrder: number;
};

export type ZquizPracticePaperBlank = {
  blankNo: number;
  score: number | null;
};

export type ZquizPracticePaperAsset = {
  kind: string;
  mimeType: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  sortOrder: number;
  storageKey: string;
};

export type ZquizPracticePaperItem = {
  assets: ZquizPracticePaperAsset[];
  blanks: ZquizPracticePaperBlank[];
  options: ZquizPracticePaperOption[];
  paperItemNo: number;
  questionId: number;
  scoreMax: number;
  stem: string;
  type: ZquizPracticeQuestionType;
};

export type ZquizPracticePaper = {
  activity: Pick<
    ZquizPracticeActivity,
    'attemptLimit' | 'availability' | 'canStart' | 'durationMinutes' | 'id' | 'title'
  >;
  items: ZquizPracticePaperItem[];
  signedPaperToken: string;
};

export type ZquizPracticeActivityDetail = ZquizPracticeActivity & {
  items: {
    questionId: number;
    scoreMax: number;
    sortOrder: number;
  }[];
};

export type ZquizPracticeAttemptBlankAnswer = {
  blankNo: number;
  answerText: string;
};

export type ZquizPracticeAttemptAnswer = {
  answerText: string | null;
  blankAnswers: ZquizPracticeAttemptBlankAnswer[];
  selectedLabels: string[];
};

export type ZquizPracticeAttemptItem = ZquizPracticePaperItem & {
  answer: ZquizPracticeAttemptAnswer;
  gradingStatus: ZquizPracticeAttemptItemGradingStatus;
  isCorrect: boolean | null;
  scoreAwarded: number;
};

export type ZquizPracticeAttempt = {
  activity: ZquizPracticeActivity;
  attemptNo: number;
  gradingStatus: ZquizPracticeAttemptGradingStatus;
  id: string;
  items: ZquizPracticeAttemptItem[];
  scoreAwarded: number;
  scoreMax: number;
  startedAt: string | null;
  status: ZquizPracticeAttemptStatus;
  submittedAt: string | null;
};

export type ZquizPracticeDraftAnswers = Record<string, unknown>;

export type SubmitZquizPracticeAnswerInput = {
  answerText?: string;
  blankAnswers?: ZquizPracticeAttemptBlankAnswer[];
  paperItemNo: number;
  selectedLabels?: string[];
};

type ListMyZquizPracticeActivitiesResponse = {
  listMyZquizPracticeActivities: ZquizPracticeActivity[];
};

type GetMyZquizPracticeActivityResponse = {
  getMyZquizPracticeActivity: ZquizPracticeActivityDetail | null;
};

type StartZquizPracticeResponse = {
  startZquizPractice: ZquizPracticePaper;
};

type SubmitZquizPracticeResponse = {
  submitZquizPractice: ZquizPracticeAttempt;
};

type GetMyZquizPracticeAttemptResponse = {
  getMyZquizPracticeAttempt: ZquizPracticeAttempt | null;
};

const LIST_MY_ZQUIZ_PRACTICE_ACTIVITIES_QUERY = `
  query listMyZquizPracticeActivities {
    listMyZquizPracticeActivities {
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

const GET_MY_ZQUIZ_PRACTICE_ACTIVITY_QUERY = `
  query getMyZquizPracticeActivity($input: ZquizPracticeInput!) {
    getMyZquizPracticeActivity(input: $input) {
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

const START_ZQUIZ_PRACTICE_MUTATION = `
  mutation startZquizPractice($input: ZquizPracticeInput!) {
    startZquizPractice(input: $input) {
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
      signedPaperToken
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
    }
  }
`;

const ZQUIZ_PRACTICE_ATTEMPT_FIELDS = `
  id
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
  attemptNo
  status
  gradingStatus
  scoreAwarded
  scoreMax
  startedAt
  submittedAt
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

const SUBMIT_ZQUIZ_PRACTICE_MUTATION = `
  mutation submitZquizPractice($input: SubmitZquizPracticeInput!) {
    submitZquizPractice(input: $input) {
      ${ZQUIZ_PRACTICE_ATTEMPT_FIELDS}
    }
  }
`;

const GET_MY_ZQUIZ_PRACTICE_ATTEMPT_QUERY = `
  query getMyZquizPracticeAttempt($input: ZquizPracticeAttemptInput!) {
    getMyZquizPracticeAttempt(input: $input) {
      ${ZQUIZ_PRACTICE_ATTEMPT_FIELDS}
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function resolveGraphQLErrorMessage(error: unknown, fallback: string) {
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

function normalizeOptionalString(value: string | null | undefined) {
  return value || null;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value : null;
}

function normalizeActivity(activity: ZquizPracticeActivity): ZquizPracticeActivity {
  return {
    attemptLimit: normalizeOptionalNumber(activity.attemptLimit),
    availability: activity.availability,
    ...(typeof activity.bankId === 'number' ? { bankId: activity.bankId } : {}),
    canStart: Boolean(activity.canStart),
    durationMinutes: normalizeOptionalNumber(activity.durationMinutes),
    endsAt: normalizeOptionalString(activity.endsAt),
    id: activity.id,
    startsAt: normalizeOptionalString(activity.startsAt),
    title: activity.title,
  };
}

function normalizeActivityDetail(
  activity: ZquizPracticeActivityDetail,
): ZquizPracticeActivityDetail {
  return {
    ...normalizeActivity(activity),
    items: activity.items.map((item) => ({
      questionId: item.questionId,
      scoreMax: item.scoreMax,
      sortOrder: item.sortOrder,
    })),
  };
}

function normalizeAttemptAnswer(answer: ZquizPracticeAttemptAnswer): ZquizPracticeAttemptAnswer {
  return {
    answerText: normalizeOptionalString(answer.answerText),
    blankAnswers: answer.blankAnswers.map((blankAnswer) => ({
      answerText: blankAnswer.answerText,
      blankNo: blankAnswer.blankNo,
    })),
    selectedLabels: [...answer.selectedLabels],
  };
}

function normalizeAttempt(attempt: ZquizPracticeAttempt): ZquizPracticeAttempt {
  return {
    activity: normalizeActivity(attempt.activity),
    attemptNo: attempt.attemptNo,
    gradingStatus: attempt.gradingStatus,
    id: attempt.id,
    items: attempt.items.map((item) => ({
      ...item,
      answer: normalizeAttemptAnswer(item.answer),
      assets: item.assets.map((asset) => ({ ...asset })),
      blanks: item.blanks.map((blank) => ({
        blankNo: blank.blankNo,
        score: normalizeOptionalNumber(blank.score),
      })),
      options: item.options.map((option) => ({ ...option })),
    })),
    scoreAwarded: attempt.scoreAwarded,
    scoreMax: attempt.scoreMax,
    startedAt: normalizeOptionalString(attempt.startedAt),
    status: attempt.status,
    submittedAt: normalizeOptionalString(attempt.submittedAt),
  };
}

function normalizeSelectedLabels(input: unknown, maxCount: number) {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  const selectedLabels: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const label = value.trim();

    if (!label || selectedLabels.includes(label)) {
      continue;
    }

    selectedLabels.push(label);

    if (selectedLabels.length >= maxCount) {
      break;
    }
  }

  return selectedLabels;
}

function normalizeDraftText(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

function buildChoiceSubmitAnswer(
  item: ZquizPracticePaperItem,
  draftAnswer: unknown,
): SubmitZquizPracticeAnswerInput | null {
  const selectedLabels = normalizeSelectedLabels(
    draftAnswer,
    item.type === 'MULTIPLE_CHOICE' ? item.options.length || 64 : 1,
  );

  return selectedLabels.length > 0
    ? {
        paperItemNo: item.paperItemNo,
        selectedLabels,
      }
    : null;
}

function buildFillBlankSubmitAnswer(
  item: ZquizPracticePaperItem,
  draftAnswer: unknown,
): SubmitZquizPracticeAnswerInput | null {
  const currentValue =
    draftAnswer && typeof draftAnswer === 'object' && !Array.isArray(draftAnswer)
      ? (draftAnswer as Record<string, unknown>)
      : {};
  const blankAnswers = Object.entries(currentValue)
    .map(([blankNo, answerText]) => ({
      answerText: normalizeDraftText(answerText),
      blankNo: Number(blankNo),
    }))
    .filter((blankAnswer) => Number.isInteger(blankAnswer.blankNo) && blankAnswer.answerText);

  return blankAnswers.length > 0
    ? {
        blankAnswers,
        paperItemNo: item.paperItemNo,
      }
    : null;
}

function buildEssaySubmitAnswer(
  item: ZquizPracticePaperItem,
  draftAnswer: unknown,
): SubmitZquizPracticeAnswerInput | null {
  const answerText = normalizeDraftText(draftAnswer);

  return answerText
    ? {
        answerText,
        paperItemNo: item.paperItemNo,
      }
    : null;
}

export function buildZquizPracticeSubmitAnswers(
  items: ZquizPracticePaperItem[],
  draftAnswers: ZquizPracticeDraftAnswers,
): SubmitZquizPracticeAnswerInput[] {
  const submitAnswers: SubmitZquizPracticeAnswerInput[] = [];

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

export function resolveZquizPracticeErrorMessage(error: unknown, fallback: string) {
  return resolveGraphQLErrorMessage(error, fallback);
}

export async function listMyZquizPracticeActivities() {
  try {
    const response = await requestGraphQL<
      ListMyZquizPracticeActivitiesResponse,
      Record<string, never>
    >(LIST_MY_ZQUIZ_PRACTICE_ACTIVITIES_QUERY, {});

    return response.listMyZquizPracticeActivities.map(normalizeActivity);
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取可选练习列表。'));
  }
}

export async function getMyZquizPracticeActivity(input: { activityId: number }) {
  try {
    const response = await requestGraphQL<
      GetMyZquizPracticeActivityResponse,
      {
        input: {
          activityId: number;
        };
      }
    >(GET_MY_ZQUIZ_PRACTICE_ACTIVITY_QUERY, {
      input: {
        activityId: input.activityId,
      },
    });

    return response.getMyZquizPracticeActivity
      ? normalizeActivityDetail(response.getMyZquizPracticeActivity)
      : null;
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取练习详情。'));
  }
}

export async function startZquizPractice(input: { activityId: number }) {
  try {
    const response = await requestGraphQL<
      StartZquizPracticeResponse,
      {
        input: {
          activityId: number;
        };
      }
    >(START_ZQUIZ_PRACTICE_MUTATION, {
      input: {
        activityId: input.activityId,
      },
    });

    return response.startZquizPractice;
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法开始练习。'));
  }
}

export async function submitZquizPractice(input: {
  activityId: number;
  answers: SubmitZquizPracticeAnswerInput[];
  signedPaperToken: string;
}) {
  try {
    const response = await requestGraphQL<
      SubmitZquizPracticeResponse,
      {
        input: {
          activityId: number;
          answers: SubmitZquizPracticeAnswerInput[];
          signedPaperToken: string;
        };
      }
    >(SUBMIT_ZQUIZ_PRACTICE_MUTATION, {
      input: {
        activityId: input.activityId,
        answers: input.answers,
        signedPaperToken: input.signedPaperToken,
      },
    });

    return normalizeAttempt(response.submitZquizPractice);
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法提交练习。'));
  }
}

export async function getMyZquizPracticeAttempt(input: { attemptId: string }) {
  try {
    const response = await requestGraphQL<
      GetMyZquizPracticeAttemptResponse,
      {
        input: {
          attemptId: string;
        };
      }
    >(GET_MY_ZQUIZ_PRACTICE_ATTEMPT_QUERY, {
      input: {
        attemptId: input.attemptId,
      },
    });

    return response.getMyZquizPracticeAttempt
      ? normalizeAttempt(response.getMyZquizPracticeAttempt)
      : null;
  } catch (error) {
    throw new Error(resolveGraphQLErrorMessage(error, '暂时无法读取练习结果。'));
  }
}
