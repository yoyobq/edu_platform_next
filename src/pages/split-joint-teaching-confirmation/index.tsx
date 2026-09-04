// src/pages/split-joint-teaching-confirmation/index.tsx
import { useLoaderData } from 'react-router';

import { SplitJointTeachingConfirmationPageContent } from '@/features/academic-split-joint-teaching';
import { Error403 } from '@/features/error-feedback';

export function SplitJointTeachingConfirmationPage() {
  const loaderData = useLoaderData() as { isForbidden?: boolean } | null;

  if (loaderData?.isForbidden) {
    return <Error403 />;
  }

  return <SplitJointTeachingConfirmationPageContent />;
}
