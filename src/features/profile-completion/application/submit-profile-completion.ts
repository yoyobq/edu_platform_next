import type { ProfileCompletionPorts } from './ports';
import type { ProfileCompletionInput, ProfileCompletionResult } from './types';

export async function submitProfileCompletion(
  ports: ProfileCompletionPorts,
  input: ProfileCompletionInput,
): Promise<ProfileCompletionResult> {
  return ports.api.completeMyProfile(input);
}
