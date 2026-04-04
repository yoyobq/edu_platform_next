export const PROFILE_COMPLETION_TARGET_IDENTITIES = ['STAFF', 'STUDENT'] as const;

export type ProfileCompletionTargetIdentity = (typeof PROFILE_COMPLETION_TARGET_IDENTITIES)[number];

export type ProfileCompletionInput = {
  departmentId?: string | null;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  targetIdentity: ProfileCompletionTargetIdentity;
};

export type ProfileCompletionResult = {
  success: boolean;
};
