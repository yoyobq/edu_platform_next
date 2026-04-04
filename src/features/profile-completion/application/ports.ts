import type { ProfileCompletionInput, ProfileCompletionResult } from './types';

export type ProfileCompletionApiPort = {
  completeMyProfile: (input: ProfileCompletionInput) => Promise<ProfileCompletionResult>;
};

export type ProfileCompletionPorts = {
  api: ProfileCompletionApiPort;
};
