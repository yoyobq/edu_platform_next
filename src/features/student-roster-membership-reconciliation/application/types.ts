// src/features/student-roster-membership-reconciliation/application/types.ts

export type CurrentRosterMembershipAccount = {
  accountId: number;
  displayName: string;
};

export type PreviousClassAdviserClassesResult = {
  classes: {
    code: string;
    image: string;
    name: string;
    text: string;
    value: string;
  }[];
  count: number;
  expiresAt: string;
  upstreamSessionToken: string;
};

export type RosterMembershipDepartmentOption = {
  departmentName: string;
  id: string;
  isEnabled: boolean;
  shortName: string | null;
};

export type LocalRosterClassOption = {
  classCode: string;
  className: string;
  departmentId: string;
  gradeYear: number | null;
  id: string;
};

export type ListLocalClassOptionsInput = {
  departmentId?: string;
  keyword?: string;
};

export type ClaimClassAdviserForRosterSyncReason =
  | 'ALREADY_CLAIMED'
  | 'CLAIMED'
  | 'EMPTY_ROSTER'
  | 'HISTORY_NOT_MATCHED';

export type ClaimClassAdviserForRosterSyncResult = {
  changed: boolean;
  claimed: boolean;
  classCode: string;
  className: string;
  expiresAt: string;
  fetchedCount: number;
  reason: ClaimClassAdviserForRosterSyncReason;
  upstreamSessionToken: string;
};

export type StudentRosterMembershipCategory =
  | 'AUTO_APPLY'
  | 'DIFFERENCE'
  | 'SUPPRESSED'
  | 'UNPROCESSABLE';

export type StudentRosterMembershipDecisionOutcome = 'INCLUDE' | 'EXCLUDE';

export type StudentRosterMembershipReasonCode =
  | 'DROPPED_CONFIRMED'
  | 'NOT_CHECKED_IN_CONFIRMED'
  | 'REENROLLED_CONFIRMED'
  | 'RETAINED_GRADE_CONFIRMED'
  | 'TRANSFERRED_OUT_CONFIRMED'
  | 'TRANSFERRED_IN_CONFIRMED'
  | 'UPSTREAM_ROSTER_ERROR_CONFIRMED'
  | 'CLASS_MEMBERSHIP_CORRECTION';

export type StudentStatus =
  | 'PRE_REGISTERED'
  | 'NOT_CHECKED_IN'
  | 'ENROLLED'
  | 'OFF_CAMPUS_INTERNSHIP'
  | 'SUSPENDED'
  | 'GRADUATED'
  | 'DROPPED';

export type UpstreamRosterPresence = 'RETURNED' | 'MISSING' | 'UNKNOWN';

export type StudentRosterMembershipReconciliationItem = {
  action: string;
  activeDecisionId: string | null;
  activeDecisionEffectiveSemesterId: number | null;
  activeDecisionOutcome: StudentRosterMembershipDecisionOutcome | null;
  activeDecisionReasonCode: StudentRosterMembershipReasonCode | null;
  category: StudentRosterMembershipCategory;
  classCode: string;
  className: string;
  currentClassCode: string | null;
  currentClassName: string | null;
  currentMembershipId: string | null;
  isEnrolled: string | null;
  isInSchool: string | null;
  inferredAdmissionYear: number | null;
  inferredOriginalClassCode: string | null;
  inferredOriginalClassSeq: string | null;
  inferredTargetClassSeq: string | null;
  key: string;
  reason: string | null;
  recommendedDecisionOutcome: StudentRosterMembershipDecisionOutcome | null;
  recommendedReasonCode: StudentRosterMembershipReasonCode | null;
  requiresConfirmation: boolean;
  rowIndex: number | null;
  studentId: string | null;
  studentName: string | null;
  studentStatus: StudentStatus | null;
  upstreamClassCode: string | null;
  upstreamClassName: string | null;
  upstreamPresence: UpstreamRosterPresence;
  upstreamStudentId: string | null;
};

export type StudentRosterMembershipReconciliationResult = {
  autoAppliedCount: number;
  classCode: string;
  className: string;
  committed: boolean;
  confirmationRequiredCount: number;
  createdDecisionCount: number;
  createdMembershipCount: number;
  differenceCount: number;
  dryRun: boolean;
  endedDecisionCount: number;
  endedMembershipCount: number;
  expiresAt: string;
  fetchedCount: number;
  items: StudentRosterMembershipReconciliationItem[];
  requiresReconfirm: boolean;
  sessionStrategy: string;
  suppressedCount: number;
  touchedMembershipCount: number;
  traceId: string;
  unprocessableCount: number;
  upstreamSessionToken: string;
};

export type DryRunReconcileUpstreamStudentRosterInput = {
  classCode: string;
  upstreamSessionToken: string;
};

export type ClaimClassAdviserForRosterSyncInput = DryRunReconcileUpstreamStudentRosterInput;

export type StudentRosterMembershipConfirmationInput = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  effectiveSemesterId?: number | null;
  reasonCode: StudentRosterMembershipReasonCode;
  reasonText?: string;
  studentId: string;
};

export type StudentRosterMembershipEndDecisionInput = {
  decisionId: string;
  endReason?: string;
};

export type CommitUpstreamStudentRosterReconciliationInput =
  DryRunReconcileUpstreamStudentRosterInput & {
    confirmations?: StudentRosterMembershipConfirmationInput[];
    endDecisions?: StudentRosterMembershipEndDecisionInput[];
  };
