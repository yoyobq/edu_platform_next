import { type FetchPolicy, gql, type OperationVariables } from '@apollo/client';
import { getOperationAST } from 'graphql';

import { getGraphQLClient } from './client';
import { GraphQLIngressError, toGraphQLIngressError } from './errors';

export type GraphQLAuthMode = 'required' | 'none';

type ExecuteGraphQLOptions = {
  accessToken?: string;
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

export async function executeGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  options: ExecuteGraphQLOptions = {},
): Promise<TData> {
  let operationName: string | undefined;

  try {
    const document = gql(query);
    const operation = getOperationAST(document, undefined);
    operationName = operation?.name?.value;
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
  } catch (error) {
    throw toGraphQLIngressError(error, { operationName });
  }
}
