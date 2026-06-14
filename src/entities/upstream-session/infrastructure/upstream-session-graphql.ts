// src/entities/upstream-session/infrastructure/upstream-session-graphql.ts
import { type FetchPolicy, type OperationVariables } from '@apollo/client';

import { executeGraphQL, type GraphQLAuthMode } from '@/shared/graphql';

export type ExecuteUpstreamSessionGraphQLOptions = {
  authMode?: GraphQLAuthMode;
  fetchPolicy?: FetchPolicy;
};

const UPSTREAM_SESSION_PROXY_GRAPHQL_OPTIONS = {
  logoutOnRetryAuthFailure: false,
} as const;

export function executeUpstreamSessionGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options: ExecuteUpstreamSessionGraphQLOptions = {},
) {
  return executeGraphQL<TData, TVariables>(query, variables, {
    ...options,
    ...UPSTREAM_SESSION_PROXY_GRAPHQL_OPTIONS,
  });
}
