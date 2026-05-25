// src/features/major-sync/index.ts

export type {
  MajorSyncCommitAction,
  MajorSyncCommitItem,
  MajorSyncCommitResult,
  MajorSyncDepartmentOption,
  MajorSyncDryRunAction,
  MajorSyncDryRunItem,
  MajorSyncDryRunResult,
  MajorSyncItem,
} from './api';
export {
  dryRunSyncMajorsFromUpstream,
  fetchMajorSyncDepartmentOptions,
  isExpiredUpstreamSessionError,
  resolveMajorSyncErrorMessage,
  syncMajorsFromUpstream,
} from './api';
export { MajorSyncPageContent } from './ui/major-sync-page-content';
