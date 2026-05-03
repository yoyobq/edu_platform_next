export type UpstreamLoginCredentials = {
  password: string;
  rememberCredentials?: boolean;
  userId: string;
};

export function buildUpstreamLoginCredentialsInitialValues(input: {
  fallbackUserId?: string | null;
  lockedUserId?: string | null;
  rememberedCredentials?: UpstreamLoginCredentials | null;
}): UpstreamLoginCredentials {
  const lockedUserId = input.lockedUserId?.trim();

  if (input.rememberedCredentials) {
    if (lockedUserId && input.rememberedCredentials.userId !== lockedUserId) {
      return {
        password: '',
        rememberCredentials: false,
        userId: lockedUserId,
      };
    }

    return {
      ...input.rememberedCredentials,
      userId: lockedUserId || input.rememberedCredentials.userId,
    };
  }

  return {
    password: '',
    rememberCredentials: false,
    userId: lockedUserId || input.fallbackUserId || '',
  };
}

export function canUseRememberedUpstreamLoginCredentials(input: {
  lockedUserId?: string | null;
  rememberedCredentials?: UpstreamLoginCredentials | null;
}) {
  const lockedUserId = input.lockedUserId?.trim();

  if (!input.rememberedCredentials) {
    return false;
  }

  return !lockedUserId || input.rememberedCredentials.userId === lockedUserId;
}
