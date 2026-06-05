// src/features/student-roster-membership-reconciliation/infrastructure/api.ts

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

import type {
  ClaimClassAdviserForRosterSyncInput,
  ClaimClassAdviserForRosterSyncResult,
  CommitUpstreamStudentRosterReconciliationInput,
  CurrentRosterMembershipAccount,
  DryRunReconcileUpstreamStudentRosterInput,
  PreviousClassAdviserClassesResult,
  StudentRosterMembershipReconciliationResult,
} from '../application/types';

export { isExpiredUpstreamSessionError };

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

type DryRunReconcileUpstreamStudentRosterResponse = {
  dryRunReconcileUpstreamStudentRoster: StudentRosterMembershipReconciliationResult;
};

type ClaimClassAdviserForRosterSyncResponse = {
  claimClassAdviserForRosterSync: ClaimClassAdviserForRosterSyncResult;
};

type CommitUpstreamStudentRosterReconciliationResponse = {
  commitUpstreamStudentRosterReconciliation: StudentRosterMembershipReconciliationResult;
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

const UPSTREAM_STUDENT_ROSTER_RECONCILIATION_RESULT_FIELDS = `
  fragment UpstreamStudentRosterReconciliationResultFields
    on UpstreamStudentRosterReconciliationResultDTO {
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

const DRY_RUN_RECONCILE_UPSTREAM_STUDENT_ROSTER_MUTATION = `
  ${UPSTREAM_STUDENT_ROSTER_RECONCILIATION_RESULT_FIELDS}

  mutation DryRunReconcileUpstreamStudentRoster(
    $input: DryRunReconcileUpstreamStudentRosterInput!
  ) {
    dryRunReconcileUpstreamStudentRoster(input: $input) {
      ...UpstreamStudentRosterReconciliationResultFields
    }
  }
`;

const CLAIM_CLASS_ADVISER_FOR_ROSTER_SYNC_MUTATION = `
  mutation ClaimClassAdviserForRosterSync($input: ClaimClassAdviserForRosterSyncInput!) {
    claimClassAdviserForRosterSync(input: $input) {
      claimed
      changed
      reason
      classCode
      className
      fetchedCount
      upstreamSessionToken
      expiresAt
    }
  }
`;

const COMMIT_UPSTREAM_STUDENT_ROSTER_RECONCILIATION_MUTATION = `
  ${UPSTREAM_STUDENT_ROSTER_RECONCILIATION_RESULT_FIELDS}

  mutation CommitUpstreamStudentRosterReconciliation(
    $input: CommitUpstreamStudentRosterReconciliationInput!
  ) {
    commitUpstreamStudentRosterReconciliation(input: $input) {
      ...UpstreamStudentRosterReconciliationResultFields
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

function normalizeDryRunInput(input: DryRunReconcileUpstreamStudentRosterInput) {
  return {
    classCode: normalizeRequiredTextValue(input.classCode, { label: '班级' }),
    upstreamSessionToken: normalizeRequiredTextValue(input.upstreamSessionToken, {
      message: 'upstreamSessionToken 为必填。',
    }),
  };
}

function normalizeClaimClassAdviserInput(input: ClaimClassAdviserForRosterSyncInput) {
  return normalizeDryRunInput(input);
}

function normalizeCommitInput(input: CommitUpstreamStudentRosterReconciliationInput) {
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

export async function dryRunReconcileUpstreamStudentRoster(
  input: DryRunReconcileUpstreamStudentRosterInput,
) {
  const response = await requestGraphQL<
    DryRunReconcileUpstreamStudentRosterResponse,
    {
      input: ReturnType<typeof normalizeDryRunInput>;
    }
  >(DRY_RUN_RECONCILE_UPSTREAM_STUDENT_ROSTER_MUTATION, {
    input: normalizeDryRunInput(input),
  });

  return response.dryRunReconcileUpstreamStudentRoster;
}

export async function claimClassAdviserForRosterSync(input: ClaimClassAdviserForRosterSyncInput) {
  const response = await requestGraphQL<
    ClaimClassAdviserForRosterSyncResponse,
    {
      input: ReturnType<typeof normalizeClaimClassAdviserInput>;
    }
  >(CLAIM_CLASS_ADVISER_FOR_ROSTER_SYNC_MUTATION, {
    input: normalizeClaimClassAdviserInput(input),
  });

  return response.claimClassAdviserForRosterSync;
}

export async function commitUpstreamStudentRosterReconciliation(
  input: CommitUpstreamStudentRosterReconciliationInput,
) {
  const response = await requestGraphQL<
    CommitUpstreamStudentRosterReconciliationResponse,
    {
      input: ReturnType<typeof normalizeCommitInput>;
    }
  >(COMMIT_UPSTREAM_STUDENT_ROSTER_RECONCILIATION_MUTATION, {
    input: normalizeCommitInput(input),
  });

  return response.commitUpstreamStudentRosterReconciliation;
}

export function resolveStudentRosterMembershipErrorMessage(error: unknown) {
  return resolveUpstreamErrorMessage(error, '暂时无法执行学生名册归属核对。');
}
