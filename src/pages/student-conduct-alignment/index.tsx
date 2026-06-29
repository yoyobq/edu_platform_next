// src/pages/student-conduct-alignment/index.tsx

import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import {
  type StudentConductAlignmentCurrentAccount,
  StudentConductAlignmentPageContent,
} from '@/features/student-conduct-alignment';

type StudentConductAlignmentLoaderData = {
  currentAccount?: StudentConductAlignmentCurrentAccount;
  isForbidden?: boolean;
} | null;

export function StudentConductAlignmentPage() {
  const loaderData = useLoaderData() as StudentConductAlignmentLoaderData;

  if (loaderData?.isForbidden || !loaderData?.currentAccount) {
    return <Error403 />;
  }

  return <StudentConductAlignmentPageContent currentAccount={loaderData.currentAccount} />;
}
