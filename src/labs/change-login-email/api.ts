import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

type RequestChangeLoginEmailResponse = {
  message?: string | null;
  success: boolean;
};

type RequestChangeLoginEmailResult = {
  message: string | null;
  success: boolean;
};

const REQUEST_CHANGE_LOGIN_EMAIL_MUTATION = `
  mutation RequestChangeLoginEmail($input: RequestChangeLoginEmailInput!) {
    requestChangeLoginEmail(input: $input) {
      message
      success
    }
  }
`;

const ADMIN_REQUEST_CHANGE_LOGIN_EMAIL_MUTATION = `
  mutation AdminRequestChangeLoginEmail($input: AdminRequestChangeLoginEmailInput!) {
    adminRequestChangeLoginEmail(input: $input) {
      message
      success
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

function normalizeResult(result: RequestChangeLoginEmailResponse): RequestChangeLoginEmailResult {
  return {
    message: result.message || null,
    success: result.success,
  };
}

export async function requestChangeLoginEmail(input: { newLoginEmail: string }) {
  try {
    const response = await requestGraphQL<
      {
        requestChangeLoginEmail: RequestChangeLoginEmailResponse;
      },
      {
        input: {
          newLoginEmail: string;
        };
      }
    >(REQUEST_CHANGE_LOGIN_EMAIL_MUTATION, {
      input,
    });

    const result = normalizeResult(response.requestChangeLoginEmail);

    if (!result.success) {
      throw new Error(result.message || '暂时无法发送登录邮箱变更邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法发送登录邮箱变更邮件。'));
  }
}

export async function adminRequestChangeLoginEmail(input: {
  accountId: number;
  newLoginEmail: string;
}) {
  try {
    const response = await requestGraphQL<
      {
        adminRequestChangeLoginEmail: RequestChangeLoginEmailResponse;
      },
      {
        input: {
          accountId: number;
          newLoginEmail: string;
        };
      }
    >(ADMIN_REQUEST_CHANGE_LOGIN_EMAIL_MUTATION, {
      input,
    });

    const result = normalizeResult(response.adminRequestChangeLoginEmail);

    if (!result.success) {
      throw new Error(result.message || '暂时无法为指定账号发送登录邮箱变更邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法为指定账号发送登录邮箱变更邮件。'));
  }
}
