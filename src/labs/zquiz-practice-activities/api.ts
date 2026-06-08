// src/labs/zquiz-practice-activities/api.ts

import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type ZquizPracticeAvailability = 'NOT_STARTED' | 'OPEN' | 'ENDED' | 'CLOSED';

export type ZquizPracticeActivity = {
  attemptLimit: number | null;
  availability: ZquizPracticeAvailability;
  bankId: number;
  canStart: boolean;
  durationMinutes: number | null;
  endsAt: string | null;
  id: number;
  startsAt: string | null;
  title: string;
};

export type ZquizPracticeStartResult = Record<string, unknown>;

type ListMyZquizPracticeActivitiesResponse = {
  listMyZquizPracticeActivities: ZquizPracticeActivity[];
};

type StartZquizPracticeResponse = {
  startZquizPractice: ZquizPracticeStartResult;
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

const START_ZQUIZ_PRACTICE_MUTATION = `
  mutation StartZquizPractice($activityId: Int!) {
    startZquizPractice(activityId: $activityId)
  }
`;

const START_ZQUIZ_PRACTICE_WITH_INPUT_MUTATION = `
  mutation StartZquizPracticeWithInput($input: StartZquizPracticeInput!) {
    startZquizPractice(input: $input)
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

function shouldRetryStartWithInput(error: unknown) {
  if (!isGraphQLIngressError(error)) {
    return false;
  }

  return (
    error.graphqlErrors?.some((graphqlError) => {
      const message = graphqlError.message.toLowerCase();

      return (
        message.includes('unknown argument') ||
        (message.includes('argument') && message.includes('input') && message.includes('required'))
      );
    }) ?? false
  );
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
    bankId: activity.bankId,
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
        activityId: number;
      }
    >(START_ZQUIZ_PRACTICE_MUTATION, {
      activityId: input.activityId,
    });

    return response.startZquizPractice;
  } catch (directError) {
    if (!shouldRetryStartWithInput(directError)) {
      throw new Error(resolveGraphQLErrorMessage(directError, '暂时无法开始练习。'));
    }

    try {
      const response = await requestGraphQL<
        StartZquizPracticeResponse,
        {
          input: {
            activityId: number;
          };
        }
      >(START_ZQUIZ_PRACTICE_WITH_INPUT_MUTATION, {
        input: {
          activityId: input.activityId,
        },
      });

      return response.startZquizPractice;
    } catch {
      throw new Error(resolveGraphQLErrorMessage(directError, '暂时无法开始练习。'));
    }
  }
}
