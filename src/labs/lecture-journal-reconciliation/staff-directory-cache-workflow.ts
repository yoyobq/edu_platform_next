import type {
  PersistUpstreamSessionFromResult,
  StoredUpstreamSession,
} from '@/entities/upstream-session';

import {
  populateStaffDirectory,
  readStaffDirectory,
  type StaffDirectoryResult,
} from '@/shared/upstream';

type StaffDirectoryViewerRole = 'admin' | 'authenticated' | 'staff';

type StaffDirectoryWorkflowDeps = {
  populateStaffDirectoryFn?: typeof populateStaffDirectory;
  readStaffDirectoryFn?: typeof readStaffDirectory;
};

type ResolveStaffDirectoryParams = StaffDirectoryWorkflowDeps & {
  currentDirectory?: StaffDirectoryResult | null;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  session?: StoredUpstreamSession | null;
  viewerRole: StaffDirectoryViewerRole;
};

type ResolveStaffDirectoryOutcome = {
  directory: StaffDirectoryResult | null;
  didPopulate: boolean;
};

export async function resolveLectureJournalStaffDirectory(
  params: ResolveStaffDirectoryParams,
): Promise<ResolveStaffDirectoryOutcome> {
  if (params.viewerRole !== 'admin') {
    return {
      didPopulate: false,
      directory: params.currentDirectory ?? null,
    };
  }

  const readDirectory = params.readStaffDirectoryFn ?? readStaffDirectory;
  const populateDirectory = params.populateStaffDirectoryFn ?? populateStaffDirectory;
  const currentDirectory = params.currentDirectory ?? (await readDirectory());

  if (currentDirectory.cacheStatus !== 'MISS' || !params.session) {
    return {
      didPopulate: false,
      directory: currentDirectory,
    };
  }

  const populateResult = await populateDirectory({
    sessionToken: params.session.upstreamSessionToken,
  });

  params.persistSessionFromResult(params.session, populateResult);

  return {
    didPopulate: true,
    directory: populateResult,
  };
}
