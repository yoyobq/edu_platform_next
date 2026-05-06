import { canAccessPayloadCrypto as canAccessPayloadCryptoByInput } from '@/shared/auth-access';

type PayloadCryptoAccessSession = {
  accountId?: number | null;
  userInfo: {
    accessGroup: readonly string[];
  };
};

export function canAccessPayloadCrypto(session: PayloadCryptoAccessSession | null | undefined) {
  return Boolean(
    session &&
    canAccessPayloadCryptoByInput({
      accountId: session.accountId,
      accessGroup: session.userInfo.accessGroup,
    }),
  );
}
