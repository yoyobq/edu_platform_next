import type { OperationVariables } from '@apollo/client';

import {
  executeGraphQL,
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/shared/graphql';

export { isExpiredUpstreamSessionError, resolveUpstreamErrorMessage };

type LoginUpstreamSessionResponse = {
  loginUpstreamSession: {
    expiresAt: string;
    upstreamSessionToken: string;
  };
};

type CurrentAccountResponse = {
  me: {
    accountId: number;
    userInfo: {
      nickname: string | null;
    };
  };
};

type TeacherDirectoryResponse = {
  fetchTeacherDirectory: TeacherDirectoryResult;
};

export type CurrentUpstreamDemoAccount = {
  accountId: number;
  displayName: string;
};

export type TeacherDirectoryResult = {
  expiresAt: string;
  teachers: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  upstreamSessionToken: string;
};

const LOGIN_UPSTREAM_SESSION_MUTATION = `
  mutation LoginUpstreamSession($input: LoginUpstreamSessionInput!) {
    loginUpstreamSession(input: $input) {
      expiresAt
      upstreamSessionToken
    }
  }
`;

const FETCH_TEACHER_DIRECTORY_QUERY = `
  query FetchTeacherDirectory($sessionToken: String!) {
    fetchTeacherDirectory(sessionToken: $sessionToken) {
      expiresAt
      teachers {
        code
        image
        name
        text
        value
      }
      upstreamSessionToken
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

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}

export async function loginUpstreamSession(input: { password: string; userId: string }) {
  try {
    const response = await requestGraphQL<
      LoginUpstreamSessionResponse,
      {
        input: {
          password: string;
          userId: string;
        };
      }
    >(LOGIN_UPSTREAM_SESSION_MUTATION, {
      input,
    });

    return response.loginUpstreamSession;
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法登录 upstream。'));
  }
}

export async function fetchCurrentUpstreamDemoAccount(): Promise<CurrentUpstreamDemoAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accountId: response.me.accountId,
      displayName: response.me.userInfo.nickname?.trim() || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchTeacherDirectory(input: { sessionToken: string }) {
  const response = await requestGraphQL<
    TeacherDirectoryResponse,
    {
      sessionToken: string;
    }
  >(FETCH_TEACHER_DIRECTORY_QUERY, {
    sessionToken: input.sessionToken,
  });

  return response.fetchTeacherDirectory;
}
