import type { ProfileCompletionApiPort } from '../application/ports';
import type { ProfileCompletionInput } from '../application/types';

import { mapCompleteMyProfileResult, mapProfileCompletionInputToDTO } from './mapper';

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{
    message?: string;
  }>;
};

type CompleteMyProfileResponse = {
  completeMyProfile: {
    success: boolean;
  };
};

const COMPLETE_MY_PROFILE_MUTATION = `
  mutation CompleteMyProfile($input: CompleteMyProfileInput!) {
    completeMyProfile(input: $input) {
      success
    }
  }
`;

function getGraphQLEndpoint() {
  const endpoint = import.meta.env.VITE_GRAPHQL_ENDPOINT;

  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    throw new Error('未配置可用的 VITE_GRAPHQL_ENDPOINT。');
  }

  return endpoint;
}

async function requestGraphQL<TData, TVariables>(
  query: string,
  variables: TVariables,
  accessToken: string,
): Promise<TData> {
  const response = await fetch(getGraphQLEndpoint(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const payload = (await response.json()) as GraphQLResponse<TData>;

  if (!response.ok) {
    throw new Error(payload.errors?.[0]?.message || `请求失败（HTTP ${response.status}）。`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'GraphQL 请求失败。');
  }

  if (!payload.data) {
    throw new Error('GraphQL 未返回 data。');
  }

  return payload.data;
}

export function createProfileCompletionApi(accessToken: string): ProfileCompletionApiPort {
  return {
    async completeMyProfile(input: ProfileCompletionInput) {
      const response = await requestGraphQL<
        CompleteMyProfileResponse,
        { input: ReturnType<typeof mapProfileCompletionInputToDTO> }
      >(
        COMPLETE_MY_PROFILE_MUTATION,
        {
          input: mapProfileCompletionInputToDTO(input),
        },
        accessToken,
      );

      return mapCompleteMyProfileResult(response.completeMyProfile);
    },
  };
}
