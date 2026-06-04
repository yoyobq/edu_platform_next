// src/labs/student-roster-membership-reconciliation/api.ts

import type { OperationVariables } from '@apollo/client';

import {
  isExpiredUpstreamSessionError,
  resolveUpstreamErrorMessage,
} from '@/entities/upstream-session';

import {
  normalizeOptionalTextValue,
  normalizeRequiredTextValue,
} from '@/shared/form-normalization';
import { executeGraphQL, type GraphQLAuthMode } from '@/shared/graphql';

export { isExpiredUpstreamSessionError };

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

export type StudentRosterMembershipCategory =
  | 'AUTO_APPLY'
  | 'DIFFERENCE'
  | 'SUPPRESSED'
  | 'UNPROCESSABLE';

export type StudentRosterMembershipDecisionOutcome = 'INCLUDE' | 'EXCLUDE';

export type StudentRosterMembershipReasonCode =
  | 'DROPPED_CONFIRMED'
  | 'NOT_CHECKED_IN_CONFIRMED'
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
  activeDecisionOutcome: StudentRosterMembershipDecisionOutcome | null;
  category: StudentRosterMembershipCategory;
  classCode: string;
  className: string;
  currentClassCode: string | null;
  currentClassName: string | null;
  currentMembershipId: string | null;
  isEnrolled: string | null;
  isInSchool: string | null;
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

export type DryRunReconcileStudentRosterMembershipInput = {
  classCode: string;
  upstreamSessionToken: string;
};

export type StudentRosterMembershipConfirmationInput = {
  decisionOutcome: StudentRosterMembershipDecisionOutcome;
  reasonCode: StudentRosterMembershipReasonCode;
  reasonText?: string;
  studentId: string;
};

export type StudentRosterMembershipEndDecisionInput = {
  decisionId: string;
  endReason?: string;
};

export type CommitStudentRosterMembershipReconciliationInput =
  DryRunReconcileStudentRosterMembershipInput & {
    confirmations?: StudentRosterMembershipConfirmationInput[];
    endDecisions?: StudentRosterMembershipEndDecisionInput[];
  };

type CurrentAccountResponse = {
  me: {
    accountId: number;
    account: {
      identityHint: string | null;
    };
  };
};

type PreviousClassAdviserClassesResponse = {
  fetchPreviousClassAdviserClasses: PreviousClassAdviserClassesResult;
};

type DryRunReconcileStudentRosterMembershipResponse = {
  dryRunReconcileStudentRosterMembership: StudentRosterMembershipReconciliationResult;
};

type CommitStudentRosterMembershipReconciliationResponse = {
  commitStudentRosterMembershipReconciliation: StudentRosterMembershipReconciliationResult;
};

const CURRENT_ACCOUNT_QUERY = `
  query StudentRosterMembershipCurrentAccount {
    me {
      accountId
      account {
        identityHint
      }
    }
  }
`;

const FETCH_PREVIOUS_CLASS_ADVISER_CLASSES_QUERY = `
  query StudentRosterMembershipPreviousClassAdviserClasses($sessionToken: String!) {
    fetchPreviousClassAdviserClasses(sessionToken: $sessionToken) {
      upstreamSessionToken
      expiresAt
      count
      classes {
        code
        name
        text
        value
        image
      }
    }
  }
`;

const STUDENT_ROSTER_MEMBERSHIP_RESULT_FIELDS = `
  fragment StudentRosterMembershipResultFields on StudentRosterMembershipReconciliationResultDTO {
    dryRun
    committed
    requiresReconfirm
    traceId
    upstreamSessionToken
    expiresAt
    sessionStrategy
    classCode
    className
    fetchedCount
    autoAppliedCount
    differenceCount
    suppressedCount
    unprocessableCount
    confirmationRequiredCount
    createdMembershipCount
    touchedMembershipCount
    endedMembershipCount
    createdDecisionCount
    endedDecisionCount
    items {
      key
      rowIndex
      category
      action
      requiresConfirmation
      classCode
      className
      studentId
      studentName
      studentStatus
      upstreamPresence
      upstreamStudentId
      upstreamClassCode
      upstreamClassName
      isEnrolled
      isInSchool
      currentMembershipId
      currentClassCode
      currentClassName
      activeDecisionId
      activeDecisionOutcome
      recommendedDecisionOutcome
      recommendedReasonCode
      reason
    }
  }
`;

const DRY_RUN_RECONCILE_STUDENT_ROSTER_MEMBERSHIP_MUTATION = `
  ${STUDENT_ROSTER_MEMBERSHIP_RESULT_FIELDS}

  mutation DryRunReconcileStudentRosterMembership(
    $input: DryRunReconcileStudentRosterMembershipInput!
  ) {
    dryRunReconcileStudentRosterMembership(input: $input) {
      ...StudentRosterMembershipResultFields
    }
  }
`;

const COMMIT_STUDENT_ROSTER_MEMBERSHIP_RECONCILIATION_MUTATION = `
  ${STUDENT_ROSTER_MEMBERSHIP_RESULT_FIELDS}

  mutation CommitStudentRosterMembershipReconciliation(
    $input: CommitStudentRosterMembershipReconciliationInput!
  ) {
    commitStudentRosterMembershipReconciliation(input: $input) {
      ...StudentRosterMembershipResultFields
    }
  }
`;

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options?: {
    authMode?: GraphQLAuthMode;
  },
): Promise<TData> {
  return options ? executeGraphQL(query, variables, options) : executeGraphQL(query, variables);
}

function normalizeDryRunInput(input: DryRunReconcileStudentRosterMembershipInput) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级' }),
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

function normalizeCommitInput(input: CommitStudentRosterMembershipReconciliationInput) {
  const normalizedInput = normalizeDryRunInput(input);

  return {
    ...normalizedInput,
    confirmations: input.confirmations?.map((confirmation) => ({
      decisionOutcome: confirmation.decisionOutcome,
      reasonCode: confirmation.reasonCode,
      reasonText: normalizeOptionalTextValue(confirmation.reasonText, 'to_undefined'),
      studentId: normalizeRequiredTextValue(confirmation.studentId, { label: '学生编号' }),
    })),
    endDecisions: input.endDecisions?.map((decision) => ({
      decisionId: normalizeRequiredTextValue(decision.decisionId, { label: '裁定' }),
      endReason: normalizeOptionalTextValue(decision.endReason, 'to_undefined'),
    })),
  };
}

export async function fetchCurrentRosterMembershipAccount(): Promise<CurrentRosterMembershipAccount> {
  try {
    const response = await requestGraphQL<CurrentAccountResponse, Record<string, never>>(
      CURRENT_ACCOUNT_QUERY,
      {},
    );

    return {
      accountId: response.me.accountId,
      displayName: response.me.account.identityHint?.trim() || `account-${response.me.accountId}`,
    };
  } catch (error) {
    throw new Error(resolveUpstreamErrorMessage(error, '暂时无法确认当前登录账号。'));
  }
}

export async function fetchPreviousClassAdviserClasses(input: { sessionToken: string }) {
  const response = await requestGraphQL<
    PreviousClassAdviserClassesResponse,
    {
      sessionToken: string;
    }
  >(
    FETCH_PREVIOUS_CLASS_ADVISER_CLASSES_QUERY,
    {
      sessionToken: normalizeRequiredTextValue(input.sessionToken, {
        message: 'upstreamSessionToken 为必填。',
      }),
    },
    {
      authMode: 'none',
    },
  );

  return response.fetchPreviousClassAdviserClasses;
}

export async function dryRunReconcileStudentRosterMembership(
  input: DryRunReconcileStudentRosterMembershipInput,
) {
  const response = await requestGraphQL<
    DryRunReconcileStudentRosterMembershipResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(DRY_RUN_RECONCILE_STUDENT_ROSTER_MEMBERSHIP_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.dryRunReconcileStudentRosterMembership;
}

export async function commitStudentRosterMembershipReconciliation(
  input: CommitStudentRosterMembershipReconciliationInput,
) {
  const response = await requestGraphQL<
    CommitStudentRosterMembershipReconciliationResponse,
    {
      input: ReturnType<typeof normalizeCommitInput>;
    }
  >(COMMIT_STUDENT_ROSTER_MEMBERSHIP_RECONCILIATION_MUTATION, {
    input: normalizeCommitInput(input),
  });

  return response.commitStudentRosterMembershipReconciliation;
}

export function resolveStudentRosterMembershipErrorMessage(error: unknown) {
  return resolveUpstreamErrorMessage(error, '暂时无法执行学生名册归属核对。');
}
