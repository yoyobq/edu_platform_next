import { type FetchPolicy, gql, type OperationVariables } from '@apollo/client';
import { getOperationAST } from 'graphql';

import { getGraphQLClient, getGraphQLRuntimeConfig } from './client';
import { GraphQLIngressError, toGraphQLIngressError } from './errors';

export type GraphQLAuthMode = 'required' | 'none';

type ExecuteGraphQLOptions = {
  accessToken?: string;
  allowAuthRetry?: boolean;
  authMode?: GraphQLAuthMode;
  fetchPolicy?: FetchPolicy;
};

function buildOperationContext(options: ExecuteGraphQLOptions) {
  if (options.authMode === 'none') {
    return {
      authMode: 'none' as const,
    };
  }

  return {
    authMode: 'required' as const,
    ...(options.accessToken
      ? {
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
        }
      : {}),
  };
}

async function dispatchGraphQLRequest<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options: ExecuteGraphQLOptions,
): Promise<TData> {
  const document = gql(query);
  const operation = getOperationAST(document, undefined);
  const operationName = operation?.name?.value;
  const client = getGraphQLClient();
  const context = buildOperationContext(options);

  if (operation?.operation === 'mutation') {
    const result = await client.mutate<TData, TVariables>({
      context,
      fetchPolicy: 'no-cache',
      mutation: document,
      variables,
    });

    if (!result.data) {
      throw new GraphQLIngressError({
        type: 'malformed',
        message: 'GraphQL 未返回 data。',
        operationName,
      });
    }

    return result.data;
  }

  const result = await client.query<TData, TVariables>({
    context,
    fetchPolicy: options.fetchPolicy || 'no-cache',
    query: document,
    variables,
  });

  if (!result.data) {
    throw new GraphQLIngressError({
      type: 'malformed',
      message: 'GraphQL 未返回 data。',
      operationName,
    });
  }

  return result.data;
}

function tryExtractOperationName(query: string): string | undefined {
  try {
    return getOperationAST(gql(query), undefined)?.name?.value;
  } catch {
    return undefined;
  }
}

export async function executeGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options: ExecuteGraphQLOptions = {},
): Promise<TData> {
  try {
    return await dispatchGraphQLRequest<TData, TVariables>(query, variables, options);
  } catch (error) {
    const ingressError = toGraphQLIngressError(error, {
      operationName: tryExtractOperationName(query),
    });

    if (
      ingressError.type !== 'auth' ||
      options.authMode === 'none' ||
      options.allowAuthRetry === false
    ) {
      throw ingressError;
    }

    const { refreshSession, onAuthFailure } = getGraphQLRuntimeConfig();

    if (!refreshSession) {
      throw ingressError;
    }

    try {
      await refreshSession();
    } catch {
      onAuthFailure?.();
      throw ingressError;
    }

    const retryOptions = { ...options, accessToken: undefined };

    try {
      return await dispatchGraphQLRequest<TData, TVariables>(query, variables, retryOptions);
    } catch (retryError) {
      const retryIngressError = toGraphQLIngressError(retryError, {
        operationName: ingressError.operationName,
      });

      if (retryIngressError.type === 'auth') {
        onAuthFailure?.();
      }

      throw retryIngressError;
    }
  }
}
