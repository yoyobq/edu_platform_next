import { type AuthAccessGroup, isAuthAccessGroup } from '@/shared/auth-access';
import { executeGraphQL } from '@/shared/graphql';

export type AccountSwitchLabIdentity =
  | {
      kind: 'STAFF';
      accountId: number;
      createdAt: string;
      departmentId: string | null;
      employmentStatus: string;
      id: string;
      jobTitle: string | null;
      name: string;
      remark: string | null;
      updatedAt: string;
    }
  | {
      kind: 'STUDENT';
      accountId: number;
      classId: number | null;
      createdAt: string;
      id: string;
      name: string;
      remarks: string | null;
      studentStatus: string;
      updatedAt: string;
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
        accountId: number;
        createdAt: string;
        departmentId: string | null;
        employmentStatus: string;
        id: string;
        jobTitle: string | null;
        name: string;
        remark: string | null;
        updatedAt: string;
      }
    | {
        __typename: 'StudentType';
        accountId: number;
        classId: number | null;
        createdAt: string;
        id: string;
        name: string;
        remarks: string | null;
        studentStatus: string;
        updatedAt: string;
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
          accountId
          createdAt
          departmentId
          employmentStatus
          id
          jobTitle
          name
          remark
          updatedAt
        }
        ... on StudentType {
          accountId
          classId
          createdAt
          id
          name
          remarks
          studentStatus
          updatedAt
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

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');

  return atob(paddedValue);
}

function parseTokenClaims(accessToken: string) {
  const [, payloadSegment] = accessToken.split('.');

  if (!payloadSegment) {
    return {
      accessGroup: [] as readonly AuthAccessGroup[],
      slotGroup: [] as readonly string[],
    };
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as {
      accessGroup?: unknown;
      slotGroup?: unknown;
    };

    return {
      accessGroup: normalizeAccessGroup(payload.accessGroup),
      slotGroup: normalizeSlotGroup(payload.slotGroup),
    };
  } catch {
    return {
      accessGroup: [] as readonly AuthAccessGroup[],
      slotGroup: [] as readonly string[],
    };
  }
}

function normalizeIdentity(value: SessionQueryDTO['identity']): AccountSwitchLabIdentity | null {
  if (!value) {
    return null;
  }

  if (value.__typename === 'StaffType') {
    return {
      kind: 'STAFF',
      accountId: value.accountId,
      createdAt: value.createdAt,
      departmentId: value.departmentId,
      employmentStatus: value.employmentStatus,
      id: value.id,
      jobTitle: value.jobTitle,
      name: value.name,
      remark: value.remark,
      updatedAt: value.updatedAt,
    };
  }

  return {
    kind: 'STUDENT',
    accountId: value.accountId,
    classId: value.classId,
    createdAt: value.createdAt,
    id: value.id,
    name: value.name,
    remarks: value.remarks,
    studentStatus: value.studentStatus,
    updatedAt: value.updatedAt,
  };
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
  account: SessionQueryDTO['account'];
  identity: AccountSwitchLabIdentity | null;
  nickname: string | null;
  primaryAccessGroup: AuthAccessGroup;
}) {
  if (input.nickname) {
    return input.nickname;
  }

  if (input.identity?.name) {
    return input.identity.name;
  }

  return normalizeOptionalString(input.account.loginName) || input.primaryAccessGroup.toLowerCase();
}

function mapSession(tokens: SessionTokensDTO, session: SessionQueryDTO): AccountSwitchLabSession {
  const parsedClaims = parseTokenClaims(tokens.accessToken);
  const identity = normalizeIdentity(session.identity);
  const accessGroup = normalizeAccessGroup(session.userInfo.accessGroup);
  const effectiveAccessGroup = accessGroup.length > 0 ? accessGroup : parsedClaims.accessGroup;
  const primaryAccessGroup = resolvePrimaryAccessGroup({
    accessGroup: effectiveAccessGroup,
    identity,
  });
  const nickname = normalizeOptionalString(session.userInfo.nickname);

  return {
    accessToken: tokens.accessToken,
    account: {
      id: session.account.id,
      identityHint: isAuthAccessGroup(session.account.identityHint)
        ? session.account.identityHint
        : null,
      loginEmail: normalizeOptionalString(session.account.loginEmail),
      loginName: normalizeOptionalString(session.account.loginName),
      status: typeof session.account.status === 'string' ? session.account.status : 'ACTIVE',
    },
    accountId: session.accountId,
    displayName: resolveDisplayName({
      account: session.account,
      identity,
      nickname,
      primaryAccessGroup,
    }),
    identity,
    isAuthenticated: true,
    needsProfileCompletion: session.needsProfileCompletion === true,
    primaryAccessGroup,
    refreshToken: tokens.refreshToken,
    slotGroup: parsedClaims.slotGroup,
    userInfo: {
      accessGroup: effectiveAccessGroup,
      avatarUrl: normalizeOptionalString(session.userInfo.avatarUrl),
      email: normalizeOptionalString(session.userInfo.email),
      nickname: nickname ?? primaryAccessGroup.toLowerCase(),
      signature: normalizeOptionalString(session.userInfo.signature),
      tags: normalizeStringList(session.userInfo.tags),
    },
  };
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
  const meResponse = await executeGraphQL<MeQueryResponse, Record<string, never>>(
    ME_QUERY,
    {},
    {
      accessToken: loginResponse.login.accessToken,
      allowAuthRetry: false,
    },
  );

  const session = mapSession(loginResponse.login, meResponse.me);

  assertCanUseAccountSwitchLabSession(session);

  return session;
}
