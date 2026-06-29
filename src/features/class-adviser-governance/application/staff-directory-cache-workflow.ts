// src/features/class-adviser-governance/application/staff-directory-cache-workflow.ts

import {
  type PersistUpstreamSessionFromResult,
  populateStaffDirectory,
  resolveStaffDirectoryCache,
  type StaffDirectoryResult,
  type StoredUpstreamSession,
} from '@/entities/upstream-session';

type StaffDirectoryWorkflowDeps = {
  populateStaffDirectoryFn?: typeof populateStaffDirectory;
};

type ResolveClassAdviserGovernanceStaffDirectoryParams = StaffDirectoryWorkflowDeps & {
  currentDirectory?: StaffDirectoryResult | null;
  forceRefresh?: boolean;
  persistSessionFromResult: PersistUpstreamSessionFromResult;
  session?: StoredUpstreamSession | null;
};

type ResolveClassAdviserGovernanceStaffDirectoryOutcome = {
  directory: StaffDirectoryResult | null;
  didPopulate: boolean;
  session: StoredUpstreamSession | null;
};

export async function resolveClassAdviserGovernanceStaffDirectory(
  params: ResolveClassAdviserGovernanceStaffDirectoryParams,
): Promise<ResolveClassAdviserGovernanceStaffDirectoryOutcome> {
  const populateDirectory = params.populateStaffDirectoryFn ?? populateStaffDirectory;

  if (params.forceRefresh) {
    if (!params.session) {
      return {
        didPopulate: false,
        directory: params.currentDirectory ?? null,
        session: null,
      };
    }

    const populateResult = await populateDirectory({
      forceRefresh: true,
      upstreamSessionToken: params.session.upstreamSessionToken,
    });
    const nextSession = params.persistSessionFromResult(params.session, populateResult);

    return {
      didPopulate: true,
      directory: populateResult,
      session: nextSession,
    };
  }

  return resolveStaffDirectoryCache({
    canPopulate: true,
    currentDirectory: params.currentDirectory,
    persistSessionFromResult: params.persistSessionFromResult,
    populateStaffDirectoryFn: populateDirectory,
    session: params.session,
  });
}
