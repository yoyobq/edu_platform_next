import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import {
  clearPayloadCryptoHistory,
  PayloadCryptoPageContent,
  readPayloadCryptoHistory,
  requestPayloadDecryption,
  requestPayloadEncryption,
  writePayloadCryptoHistory,
} from '@/features/payload-crypto';

export function PayloadCryptoPage() {
  const loaderData = useLoaderData() as { accountId?: number; isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return (
    <PayloadCryptoPageContent
      clearHistory={clearPayloadCryptoHistory}
      currentAccountId={loaderData?.accountId ?? null}
      decryptPayload={requestPayloadDecryption}
      encryptPayload={requestPayloadEncryption}
      readHistory={readPayloadCryptoHistory}
      writeHistory={writePayloadCryptoHistory}
    />
  );
}
