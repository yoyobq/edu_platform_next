// src/labs/zquiz-practice-activities/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizPracticeAvailability = 'NOT_STARTED' | 'OPEN' | 'ENDED' | 'CLOSED';

export type ZquizPracticeActivity = {
  attemptLimit: number | null;
  availability: ZquizPracticeAvailability;
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
  score: number;
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

type ListMyZquizPracticeActivitiesResponse = {
  listMyZquizPracticeActivities: ZquizPracticeActivity[];
};

type StartZquizPracticeResponse = {
  startZquizPractice: ZquizPracticePaper;
};

const LIST_MY_ZQUIZ_PRACTICE_ACTIVITIES_QUERY = `
  query listMyZquizPracticeActivities {
    listMyZquizPracticeActivities {
      id
      title
      startsAt
      endsAt
      durationMinutes
      attemptLimit
      availability
      canStart
    }
  }
`;

const START_ZQUIZ_PRACTICE_MUTATION = `
  mutation startZquizPractice($input: ZquizPracticeInput!) {
    startZquizPractice(input: $input) {
      activity {
        id
        title
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
    canStart: Boolean(activity.canStart),
    durationMinutes: normalizeOptionalNumber(activity.durationMinutes),
    endsAt: normalizeOptionalString(activity.endsAt),
    id: activity.id,
    startsAt: normalizeOptionalString(activity.startsAt),
    title: activity.title,
  };
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
