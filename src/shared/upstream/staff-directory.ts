import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from '@/shared/graphql';

export type StaffDirectoryCacheStatus = 'FRESH' | 'MISS' | 'STALE';

export type StaffDirectoryEntry = {
  name: string;
  staffId: string;
};

export type StaffDirectoryResult = {
  cacheExpiresAt: string | null;
  cacheStatus: StaffDirectoryCacheStatus;
  fetchedAt: string | null;
  teacherCount: number;
  teachers: StaffDirectoryEntry[];
};

export type StaffDirectoryEntriesResult = {
  cacheExpiresAt: string | null;
  cacheStatus: StaffDirectoryCacheStatus;
  entries: StaffDirectoryEntry[];
  fetchedAt: string | null;
  missingStaffIds: string[];
};

export type PopulateStaffDirectoryResult = StaffDirectoryResult & {
  expiresAt: string | null;
  upstreamSessionToken: string | null;
};

export type VerifiedStaffIdentityResult = {
  departmentName: string | null;
  expiresAt: string;
  identityKind: string;
  orgId: string | null;
  personId: string;
  personName: string;
  upstreamLoginId: string;
  upstreamSessionToken: string;
};

export type StaffDirectoryCacheSession = {
  upstreamSessionToken: string;
};

export type PersistStaffDirectoryCacheSessionFromResult<
  TSession extends StaffDirectoryCacheSession,
> = (session: TSession, result: PopulateStaffDirectoryResult) => TSession;

export type ResolveStaffDirectoryCacheResult<TSession extends StaffDirectoryCacheSession> = {
  directory: StaffDirectoryResult | null;
  didPopulate: boolean;
  session: TSession | null;
};

type StaffDirectoryResponse = {
  staffDirectory: StaffDirectoryResult;
};

type StaffDirectoryEntriesResponse = {
  staffDirectoryEntries: StaffDirectoryEntriesResult;
};

type PopulateStaffDirectoryResponse = {
  populateStaffDirectory: PopulateStaffDirectoryResult;
};

type VerifiedStaffIdentityResponse = {
  fetchVerifiedStaffIdentity: VerifiedStaffIdentityResult;
};

function normalizeStaffDirectoryTeacherText(value: string) {
  return value.trim();
}

function findExactStaffDirectoryTeacher(value: string, teachers: readonly StaffDirectoryEntry[]) {
  const normalizedValue = normalizeStaffDirectoryTeacherText(value);

  if (!normalizedValue) {
    return null;
  }

  return (
    teachers.find(
      (teacher) =>
        teacher.staffId === normalizedValue ||
        teacher.name === normalizedValue ||
        formatStaffDirectoryTeacherLabel(teacher) === normalizedValue,
    ) ?? null
  );
}

export function formatStaffDirectoryTeacherLabel(teacher: StaffDirectoryEntry) {
  return `${teacher.staffId} ${teacher.name}`;
}

export function formatStaffDirectoryTeacherInputValue(
  value: string,
  teachers: readonly StaffDirectoryEntry[],
) {
  const matchedTeacher = findExactStaffDirectoryTeacher(value, teachers);

  return matchedTeacher ? formatStaffDirectoryTeacherLabel(matchedTeacher) : value;
}

export function resolveStaffDirectoryTeacherInputValue(
  value: string,
  teachers: readonly StaffDirectoryEntry[],
) {
  const matchedTeacher = findExactStaffDirectoryTeacher(value, teachers);

  return matchedTeacher?.staffId ?? value;
}

export function resolveStaffDirectoryTeacherStaffId(
  value: string,
  teachers: readonly StaffDirectoryEntry[],
) {
  const normalizedValue = normalizeStaffDirectoryTeacherText(value);
  const matchedTeacher = findExactStaffDirectoryTeacher(normalizedValue, teachers);

  if (matchedTeacher) {
    return matchedTeacher.staffId;
  }

  return normalizedValue.split(/\s+/)[0] ?? '';
}

const STAFF_DIRECTORY_QUERY = `
  query StaffDirectory {
    staffDirectory {
      cacheStatus
      fetchedAt
      cacheExpiresAt
      teacherCount
      teachers {
        staffId
        name
      }
    }
  }
`;

const STAFF_DIRECTORY_ENTRIES_QUERY = `
  query StaffDirectoryEntries($staffIds: [String!]!) {
    staffDirectoryEntries(staffIds: $staffIds) {
      cacheStatus
      fetchedAt
      cacheExpiresAt
      entries {
        staffId
        name
      }
      missingStaffIds
    }
  }
`;

const POPULATE_STAFF_DIRECTORY_MUTATION = `
  mutation PopulateStaffDirectory($input: PopulateStaffDirectoryInput!) {
    populateStaffDirectory(input: $input) {
      cacheStatus
      fetchedAt
      cacheExpiresAt
      teacherCount
      teachers {
        staffId
        name
      }
      upstreamSessionToken
      expiresAt
    }
  }
`;

const FETCH_VERIFIED_STAFF_IDENTITY_QUERY = `
  query FetchVerifiedStaffIdentity($sessionToken: String!) {
    fetchVerifiedStaffIdentity(sessionToken: $sessionToken) {
      departmentName
      expiresAt
      identityKind
      orgId
      personId
      personName
      upstreamLoginId
      upstreamSessionToken
    }
  }
`;

function normalizeRequiredString(value: string, fieldName: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} 为必填。`);
  }

  return normalizedValue;
}

function normalizeStaffIds(staffIds: string[]) {
  const normalizedStaffIds = staffIds
    .map((staffId) => staffId.trim())
    .filter((staffId) => staffId.length > 0);

  if (normalizedStaffIds.length > 800) {
    throw new Error('staffIds 最多支持 800 项。');
  }

  return normalizedStaffIds;
}

export async function readStaffDirectory() {
  const response = await executeGraphQL<StaffDirectoryResponse, OperationVariables>(
    STAFF_DIRECTORY_QUERY,
    {},
  );

  return response.staffDirectory;
}

export async function resolveStaffDirectoryEntries(staffIds: string[]) {
  const response = await executeGraphQL<
    StaffDirectoryEntriesResponse,
    {
      staffIds: string[];
    }
  >(STAFF_DIRECTORY_ENTRIES_QUERY, {
    staffIds: normalizeStaffIds(staffIds),
  });

  return response.staffDirectoryEntries;
}

export async function populateStaffDirectory(input: {
  forceRefresh?: boolean;
  sessionToken: string;
}) {
  const response = await executeGraphQL<
    PopulateStaffDirectoryResponse,
    {
      input: {
        forceRefresh: boolean;
        sessionToken: string;
      };
    }
  >(POPULATE_STAFF_DIRECTORY_MUTATION, {
    input: {
      forceRefresh: Boolean(input.forceRefresh),
      sessionToken: normalizeRequiredString(input.sessionToken, 'sessionToken'),
    },
  });

  return response.populateStaffDirectory;
}

export async function readVerifiedStaffIdentity(input: { sessionToken: string }) {
  const response = await executeGraphQL<
    VerifiedStaffIdentityResponse,
    {
      sessionToken: string;
    }
  >(FETCH_VERIFIED_STAFF_IDENTITY_QUERY, {
    sessionToken: normalizeRequiredString(input.sessionToken, 'sessionToken'),
  });

  return response.fetchVerifiedStaffIdentity;
}

export async function resolveStaffDirectoryCache<
  TSession extends StaffDirectoryCacheSession,
>(input: {
  canPopulate: boolean;
  currentDirectory?: StaffDirectoryResult | null;
  persistSessionFromResult: PersistStaffDirectoryCacheSessionFromResult<TSession>;
  populateStaffDirectoryFn?: typeof populateStaffDirectory;
  readStaffDirectoryFn?: typeof readStaffDirectory;
  session?: TSession | null;
}): Promise<ResolveStaffDirectoryCacheResult<TSession>> {
  if (!input.canPopulate) {
    return {
      didPopulate: false,
      directory: input.currentDirectory ?? null,
      session: input.session ?? null,
    };
  }

  const readDirectory = input.readStaffDirectoryFn ?? readStaffDirectory;
  const populateDirectory = input.populateStaffDirectoryFn ?? populateStaffDirectory;
  const currentDirectory = input.currentDirectory ?? (await readDirectory());

  if (currentDirectory.cacheStatus !== 'MISS' || !input.session) {
    return {
      didPopulate: false,
      directory: currentDirectory,
      session: input.session ?? null,
    };
  }

  const populateResult = await populateDirectory({
    sessionToken: input.session.upstreamSessionToken,
  });
  const nextSession = input.persistSessionFromResult(input.session, populateResult);

  return {
    didPopulate: true,
    directory: populateResult,
    session: nextSession,
  };
}
