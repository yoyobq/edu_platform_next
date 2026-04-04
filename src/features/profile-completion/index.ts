import type { ProfileCompletionPorts } from './application/ports';
import { submitProfileCompletion as runSubmitProfileCompletion } from './application/submit-profile-completion';
export type { ProfileCompletionApiPort, ProfileCompletionPorts } from './application/ports';
export type {
  ProfileCompletionInput,
  ProfileCompletionResult,
  ProfileCompletionTargetIdentity,
} from './application/types';
export { PROFILE_COMPLETION_TARGET_IDENTITIES } from './application/types';
import { createProfileCompletionApi } from './infrastructure/profile-completion-api';
export {
  ProfileCompletionForm,
  type ProfileCompletionFormValues,
} from './ui/profile-completion-form';
export { ProfileCompletionPanel } from './ui/profile-completion-panel';

export function submitProfileCompletion(
  input: {
    departmentId?: string | null;
    name: string;
    nickname?: string | null;
    phone?: string | null;
    targetIdentity: 'STAFF' | 'STUDENT';
  },
  options: {
    accessToken: string;
  },
) {
  const profileCompletionPorts: ProfileCompletionPorts = {
    api: createProfileCompletionApi(options.accessToken),
  };

  return runSubmitProfileCompletion(profileCompletionPorts, input);
}
