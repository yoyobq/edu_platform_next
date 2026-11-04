// src/pages/teaching-inspection/index.tsx
import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import {
  TeachingInspectionPageContent,
  type TeachingInspectionPageData,
} from '@/features/teaching-inspection';
export function TeachingInspectionPage() {
  const data = useLoaderData() as TeachingInspectionPageData | { isForbidden: true };
  if ('isForbidden' in data) return <Error403 />;
  return <TeachingInspectionPageContent key={data.currentAccount.accountId} data={data} />;
}
