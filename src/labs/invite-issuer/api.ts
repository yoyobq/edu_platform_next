import type { OperationVariables } from '@apollo/client';

import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

type IssueInviteResponse = {
  expiresAt?: string | null;
  message?: string | null;
  recordId?: number | null;
  success: boolean;
  token?: string | null;
  type?: 'INVITE_STAFF' | null;
};

type AdminRequestPasswordResetEmailResponse = {
  message?: string | null;
  success: boolean;
};

type IssueInviteResult = {
  expiresAt: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | null;
};

type AdminRequestPasswordResetEmailResult = {
  message: string | null;
  success: boolean;
};

const INVITE_STAFF_MUTATION = `
  mutation InviteStaff($input: InviteStaffInput!) {
    inviteStaff(input: $input) {
      expiresAt
      message
      recordId
      success
      token
      type
    }
  }
`;

const ADMIN_REQUEST_PASSWORD_RESET_EMAIL_MUTATION = `
  mutation AdminRequestPasswordResetEmail($input: AdminRequestPasswordResetEmailInput!) {
    adminRequestPasswordResetEmail(input: $input) {
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

function normalizeIssueInviteResult(result: IssueInviteResponse): IssueInviteResult {
  return {
    expiresAt: result.expiresAt || null,
    message: result.message || null,
    recordId: result.recordId ?? null,
    token: result.token || null,
    type: result.type || null,
  };
}

function normalizeAdminRequestPasswordResetEmailResult(
  result: AdminRequestPasswordResetEmailResponse,
): AdminRequestPasswordResetEmailResult {
  return {
    message: result.message || null,
    success: result.success,
  };
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (isGraphQLIngressError(error)) {
    const firstError = error.graphqlErrors?.[0];
    const extensions = (firstError?.extensions as Record<string, unknown> | undefined) || {};

    if (typeof extensions.errorMessage === 'string') {
      return extensions.errorMessage;
    }

    if (extensions.errorCode === 'INVITE_ISSUE_FAILED') {
      return '邀请邮件发送失败，系统已撤销该邀请，请稍后重试或联系管理员。';
    }

    return error.userMessage;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function issueStaffInvite(input: { invitedEmail: string; staffId?: string }) {
  try {
    const response = await requestGraphQL<
      {
        inviteStaff: IssueInviteResponse;
      },
      {
        input: {
          invitedEmail: string;
          staffId?: string;
        };
      }
    >(INVITE_STAFF_MUTATION, {
      input,
    });

    if (!response.inviteStaff.success) {
      throw new Error(response.inviteStaff.message || '暂时无法签发教职工邀请。');
    }

    return normalizeIssueInviteResult(response.inviteStaff);
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法签发教职工邀请。'));
  }
}

export async function adminRequestPasswordResetEmail(input: { accountId: number }) {
  try {
    const response = await requestGraphQL<
      {
        adminRequestPasswordResetEmail: AdminRequestPasswordResetEmailResponse;
      },
      {
        input: {
          accountId: number;
        };
      }
    >(ADMIN_REQUEST_PASSWORD_RESET_EMAIL_MUTATION, {
      input,
    });

    const result = normalizeAdminRequestPasswordResetEmailResult(
      response.adminRequestPasswordResetEmail,
    );

    if (!result.success) {
      throw new Error(result.message || '暂时无法为指定账号发送老用户回归密码设置邮件。');
    }

    return result;
  } catch (error) {
    throw new Error(resolveErrorMessage(error, '暂时无法为指定账号发送老用户回归密码设置邮件。'));
  }
}
