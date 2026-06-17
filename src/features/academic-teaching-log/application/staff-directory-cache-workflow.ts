import type { AcademicViewerRole } from '@/entities/auth-access';
import {
  type PersistUpstreamSessionFromResult,
  populateStaffDirectory,
  readStaffDirectory,
  resolveStaffDirectoryCache,
  type StaffDirectoryResult,
  type StoredUpstreamSession,
} from '@/entities/upstream-session';

type StaffDirectoryWorkflowDeps = {
  populateStaffDirectoryFn?: typeof populateStaffDirectory;
  readStaffDirectoryFn?: typeof readStaffDirectory;
};

type ResolveStaffDirectoryParams = StaffDirectoryWorkflowDeps & {
  currentDirectory?: StaffDirectoryResult | null;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  session?: StoredUpstreamSession | null;
  viewerRole: AcademicViewerRole;
};

type ResolveStaffDirectoryOutcome = {
  directory: StaffDirectoryResult | null;
  didPopulate: boolean;
  session: StoredUpstreamSession | null;
};

export async function resolveLectureJournalStaffDirectory(
  params: ResolveStaffDirectoryParams,
): Promise<ResolveStaffDirectoryOutcome> {
  return resolveStaffDirectoryCache({
    canPopulate: params.viewerRole === 'admin',
    currentDirectory: params.currentDirectory,
    persistSessionFromResult: params.persistSessionFromResult,
    populateStaffDirectoryFn: params.populateStaffDirectoryFn,
    readStaffDirectoryFn: params.readStaffDirectoryFn,
    session: params.session,
  });
}
