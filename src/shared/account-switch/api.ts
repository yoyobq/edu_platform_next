import { type AuthAccessGroup, isAuthAccessGroup } from '@/shared/auth-access';
import { executeGraphQL, isGraphQLIngressError } from '@/shared/graphql';

export type AccountSwitchLabIdentity =
  | {
      kind: 'STAFF';
      departmentId: string | null;
      id: string;
      name: string | null;
      slotGroup: readonly string[];
    }
  | {
      kind: 'STUDENT';
      currentClassCode: string | null;
      currentClassId: string | null;
      id: string;
      name: string | null;
      slotGroup: readonly string[];
      upstreamId: string | null;
    };

export type AccountSwitchLabSession = {
  accessToken: string;
  account: {
    id: number;
    identityHint: AuthAccessGroup | null;
    loginEmail: string | null;
    loginName: string | null;
    status: string;
  };
  accountId: number;
  displayName: string;
  identity: AccountSwitchLabIdentity | null;
  isAuthenticated: true;
  needsProfileCompletion: boolean;
  primaryAccessGroup: AuthAccessGroup;
  refreshToken: string;
  slotGroup: readonly string[];
  userInfo: {
    accessGroup: readonly AuthAccessGroup[];
    avatarUrl: string | null;
    email: string | null;
    nickname: string;
    signature: string | null;
    tags: readonly string[];
  };
};

type SessionTokensDTO = {
  accessToken: string;
  refreshToken: string;
};

type SessionQueryDTO = {
  account: {
    id: number;
    identityHint: unknown;
    loginEmail: unknown;
    loginName: unknown;
    status: unknown;
  };
  accountId: number;
  identity:
    | {
        __typename: 'StaffType';
        departmentId: unknown;
        id: unknown;
        name: unknown;
        slotGroup: unknown;
      }
    | {
        __typename: 'StudentType';
        currentClassCode: unknown;
        currentClassId: unknown;
        id: unknown;
        name: unknown;
        slotGroup: unknown;
        upstreamId: unknown;
      }
    | null;
  needsProfileCompletion: boolean;
  userInfo: {
    accessGroup: unknown;
    avatarUrl: unknown;
    email: unknown;
    nickname: unknown;
    signature: unknown;
    tags: unknown;
  };
};

type LoginMutationResponse = {
  login: SessionTokensDTO;
};

type MeQueryResponse = {
  me: SessionQueryDTO;
};

type RefreshMutationResponse = {
  refresh: SessionTokensDTO;
};

type LoginInput = {
  audience: 'DESKTOP';
  loginName: string;
  loginPassword: string;
  type: 'PASSWORD';
};

const ACCOUNT_SWITCH_ALLOWED_ACCESS_GROUPS = ['ADMIN', 'STAFF'] as const;

const LOGIN_MUTATION = `
  mutation Login($input: AuthLoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

const REFRESH_MUTATION = `
  mutation Refresh($input: AuthRefreshInput!) {
    refresh(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      accountId
      account {
        id
        identityHint
        loginEmail
        loginName
        status
      }
      userInfo {
        accessGroup
        avatarUrl
        email
        nickname
        signature
        tags
      }
      identity {
        __typename
        ... on StaffType {
          departmentId
          id
          name
          slotGroup
        }
        ... on StudentType {
          currentClassCode
          currentClassId
          id
          name
          slotGroup
          upstreamId
        }
      }
      needsProfileCompletion
    }
  }
`;

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeAccessGroup(value: unknown): readonly AuthAccessGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isAuthAccessGroup);
}

function normalizeSlotGroup(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()),
    ),
  ).filter((item) => item.length > 0);
}

function normalizeIdentity(value: SessionQueryDTO['identity']): AccountSwitchLabIdentity | null {
  if (!value) {
    return null;
  }

  if (value.__typename === 'StaffType') {
    return {
      kind: 'STAFF',
      departmentId: normalizeOptionalString(value.departmentId),
      id: normalizeOptionalString(value.id) ?? '',
      name: normalizeOptionalString(value.name),
      slotGroup: normalizeSlotGroup(value.slotGroup),
    };
  }

  return {
    kind: 'STUDENT',
    currentClassCode: normalizeOptionalString(value.currentClassCode),
    currentClassId: normalizeOptionalString(value.currentClassId),
    id: normalizeOptionalString(value.id) ?? '',
    name: normalizeOptionalString(value.name),
    slotGroup: normalizeSlotGroup(value.slotGroup),
    upstreamId: normalizeOptionalString(value.upstreamId),
  };
}

function resolveSessionSlotGroup(identity: AccountSwitchLabIdentity | null) {
  return identity?.slotGroup ?? [];
}

function resolvePrimaryAccessGroup(input: {
  accessGroup: readonly AuthAccessGroup[];
  identity: AccountSwitchLabIdentity | null;
}): AuthAccessGroup {
  if (input.identity?.kind === 'STAFF') {
    return 'STAFF';
  }

  if (input.identity?.kind === 'STUDENT') {
    return 'STUDENT';
  }

  for (const group of ['ADMIN', 'STAFF', 'STUDENT'] as const) {
    if (input.accessGroup.includes(group)) {
      return group;
    }
  }

  return 'GUEST';
}

function resolveDisplayName(input: {
  accountId: number;
  identity: AccountSwitchLabIdentity | null;
}) {
  return input.identity?.name ?? `account-${input.accountId}`;
}

function mapSession(tokens: SessionTokensDTO, session: SessionQueryDTO): AccountSwitchLabSession {
  const identity = normalizeIdentity(session.identity);
  const accessGroup = normalizeAccessGroup(session.userInfo.accessGroup);
  const primaryAccessGroup = resolvePrimaryAccessGroup({
    accessGroup,
    identity,
  });
  const displayName = resolveDisplayName({
    accountId: session.accountId,
    identity,
  });
  const nickname = normalizeOptionalString(session.userInfo.nickname) ?? '';

  return {
    accessToken: tokens.accessToken,
    account: {
      id: session.account.id,
      identityHint: isAuthAccessGroup(session.account.identityHint)
        ? session.account.identityHint
        : null,
      loginEmail: normalizeOptionalString(session.account.loginEmail),
      loginName: normalizeOptionalString(session.account.loginName),
      status: normalizeOptionalString(session.account.status) ?? 'ACTIVE',
    },
    accountId: session.accountId,
    displayName,
    identity,
    isAuthenticated: true,
    needsProfileCompletion: session.needsProfileCompletion === true,
    primaryAccessGroup,
    refreshToken: tokens.refreshToken,
    slotGroup: resolveSessionSlotGroup(identity),
    userInfo: {
      accessGroup,
      avatarUrl: normalizeOptionalString(session.userInfo.avatarUrl),
      email: normalizeOptionalString(session.userInfo.email),
      nickname,
      signature: normalizeOptionalString(session.userInfo.signature),
      tags: normalizeStringList(session.userInfo.tags),
    },
  };
}

export class AccountSwitchLabAccountMismatchError extends Error {
  constructor(input: { expectedAccountId: number; receivedAccountId: number }) {
    super(`账号恢复结果不一致：期望 ${input.expectedAccountId}，实际 ${input.receivedAccountId}。`);
    this.name = 'AccountSwitchLabAccountMismatchError';
  }
}

export function isAccountSwitchLabAccountMismatchError(
  error: unknown,
): error is AccountSwitchLabAccountMismatchError {
  return error instanceof AccountSwitchLabAccountMismatchError;
}

function assertRestoredAccountMatches(
  restoredSession: AccountSwitchLabSession,
  requestedSession: AccountSwitchLabSession,
) {
  if (restoredSession.accountId !== requestedSession.accountId) {
    throw new AccountSwitchLabAccountMismatchError({
      expectedAccountId: requestedSession.accountId,
      receivedAccountId: restoredSession.accountId,
    });
  }
}

export function canUseAccountSwitchLabSession(session: AccountSwitchLabSession) {
  return ACCOUNT_SWITCH_ALLOWED_ACCESS_GROUPS.some((group) =>
    session.userInfo.accessGroup.includes(group),
  );
}

function assertCanUseAccountSwitchLabSession(session: AccountSwitchLabSession) {
  if (canUseAccountSwitchLabSession(session)) {
    return;
  }

  throw new Error('账号切换只允许添加 Admin 或 Staff 账号。');
}

async function fetchAccountSwitchLabSession(tokens: SessionTokensDTO) {
  const meResponse = await executeGraphQL<MeQueryResponse, Record<string, never>>(
    ME_QUERY,
    {},
    {
      accessToken: tokens.accessToken,
      allowAuthRetry: false,
    },
  );
  const session = mapSession(tokens, meResponse.me);

  assertCanUseAccountSwitchLabSession(session);

  return session;
}

async function refreshAccountSwitchLabTokens(refreshToken: string) {
  const response = await executeGraphQL<
    RefreshMutationResponse,
    { input: { refreshToken: string } }
  >(
    REFRESH_MUTATION,
    {
      input: {
        refreshToken,
      },
    },
    {
      allowAuthRetry: false,
      authMode: 'none',
    },
  );

  return response.refresh;
}

export async function createAccountSwitchLabSession(input: {
  loginName: string;
  loginPassword: string;
}) {
  const loginInput: LoginInput = {
    audience: 'DESKTOP',
    loginName: input.loginName,
    loginPassword: input.loginPassword,
    type: 'PASSWORD',
  };
  const loginResponse = await executeGraphQL<LoginMutationResponse, { input: LoginInput }>(
    LOGIN_MUTATION,
    { input: loginInput },
    {
      allowAuthRetry: false,
      authMode: 'none',
    },
  );

  return fetchAccountSwitchLabSession(loginResponse.login);
}

export async function restoreAccountSwitchLabSession(session: AccountSwitchLabSession) {
  const tokens = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };

  try {
    const restoredSession = await fetchAccountSwitchLabSession(tokens);

    assertRestoredAccountMatches(restoredSession, session);

    return restoredSession;
  } catch (error) {
    if (!isGraphQLIngressError(error) || error.type !== 'auth') {
      throw error;
    }
  }

  const refreshedSession = await fetchAccountSwitchLabSession(
    await refreshAccountSwitchLabTokens(session.refreshToken),
  );

  assertRestoredAccountMatches(refreshedSession, session);

  return refreshedSession;
}
