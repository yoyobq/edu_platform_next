// src/features/student-roster-membership-reconciliation/infrastructure/api-errors.ts

import { isGraphQLIngressError } from '@/shared/graphql';

export function isRosterMembershipPermissionError(error: unknown) {
  if (!isGraphQLIngressError(error) || error.type !== 'graphql') {
    return false;
  }

  return (
    error.graphqlErrors?.some(
      (graphqlError) =>
        (graphqlError.extensions as Record<string, unknown> | undefined)?.errorCode ===
        'INSUFFICIENT_PERMISSIONS',
    ) ?? false
  );
}
