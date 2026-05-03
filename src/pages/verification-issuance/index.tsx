import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import { VerificationIssuancePageContent } from '@/features/verification-issuance';

export function VerificationIssuancePage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return <VerificationIssuancePageContent />;
}
