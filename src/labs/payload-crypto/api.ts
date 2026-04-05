import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from '@/shared/graphql';

export async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
): Promise<TData> {
  return executeGraphQL(query, variables);
}
