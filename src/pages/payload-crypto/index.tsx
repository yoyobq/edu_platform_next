import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import { PayloadCryptoPageContent } from '@/features/payload-crypto';

export function PayloadCryptoPage() {
  const loaderData = useLoaderData() as { accountId?: number; isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return <PayloadCryptoPageContent currentAccountId={loaderData?.accountId ?? null} />;
}
