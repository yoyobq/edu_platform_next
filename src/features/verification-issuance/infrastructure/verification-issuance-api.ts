import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

type IssueInviteResponse = {
  expiresAt?: string | null;
  message?: string | null;
  recordId?: number | null;
  success: boolean;
  token?: string | null;
  type?: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

type AdminRequestPasswordResetEmailResponse = {
  message?: string | null;
  success: boolean;
};

export type IssueInviteResult = {
  expiresAt: string | null;
  message: string | null;
  recordId: number | null;
  token: string | null;
  type: 'INVITE_STAFF' | 'INVITE_STUDENT' | null;
};

export type AdminRequestPasswordResetEmailResult = {
  message: string | null;
  success: boolean;
};

export type VerificationIssuanceCurrentAccount = {
  accountId: number;
  displayName: string;
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      nickname: string | null;
    };
  } | null;
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

const CURRENT_ACCOUNT_QUERY = `
  query Me {
    me {
      accountId
      userInfo {
        nickname
      }
    }
  }
`;

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

export function resolveVerificationIssuanceErrorMessage(error: unknown, fallback: string) {
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

export async function issueVerificationStaffInvite(input: {
  invitedEmail: string;
  staffId: string;
}) {
  try {
    const response = await executeGraphQL<
      {
        inviteStaff: IssueInviteResponse;
      },
      {
        input: {
          invitedEmail: string;
          staffId: string;
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
    throw new Error(resolveVerificationIssuanceErrorMessage(error, '暂时无法签发教职工邀请。'));
  }
}

export async function adminRequestVerificationPasswordResetEmail(input: { accountId: number }) {
  try {
    const response = await executeGraphQL<
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
    throw new Error(
      resolveVerificationIssuanceErrorMessage(
        error,
        '暂时无法为指定账号发送老用户回归密码设置邮件。',
      ),
    );
  }
}

export async function fetchVerificationIssuanceCurrentAccount(): Promise<VerificationIssuanceCurrentAccount> {
  try {
    const response = await executeGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    if (!response.me) {
      throw new Error('当前登录账号尚未就绪。');
    }

    return {
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveVerificationIssuanceErrorMessage(error, '暂时无法读取当前账号。'));
  }
}
