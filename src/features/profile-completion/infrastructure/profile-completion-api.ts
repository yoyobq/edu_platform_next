import type { OperationVariables } from '@apollo/client';

import { executeGraphQL } from '@/shared/graphql';

import type { ProfileCompletionApiPort } from '../application/ports';
import type { ProfileCompletionInput } from '../application/types';

import { mapCompleteMyProfileResult, mapProfileCompletionInputToDTO } from './mapper';

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

async function requestGraphQL<TData, TVariables extends OperationVariables>(
  query: string,
  variables: TVariables,
  accessToken: string,
): Promise<TData> {
  return executeGraphQL(query, variables, {
    accessToken,
  });
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
