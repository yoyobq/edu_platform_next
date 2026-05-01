type PayloadCryptoAccessSession = {
  accountId?: number;
  userInfo: {
    accessGroup: readonly string[];
  };
};

export function canAccessPayloadCrypto(session: PayloadCryptoAccessSession | null | undefined) {
  return Boolean(
    session &&
    (session.accountId === 1 || session.accountId === 2) &&
    session.userInfo.accessGroup.includes('ADMIN'),
  );
}
