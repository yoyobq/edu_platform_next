// src/pages/student-conduct-alignment/index.tsx

import { useLoaderData, useSearchParams } from 'react-router';

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
  const [searchParams] = useSearchParams();

  if (loaderData?.isForbidden || !loaderData?.currentAccount) {
    return <Error403 />;
  }

  const classId = searchParams.get('classId')?.trim() || undefined;
  const semesterId = readPositiveInteger(searchParams.get('semesterId'));

  return (
    <StudentConductAlignmentPageContent
      currentAccount={loaderData.currentAccount}
      initialClassId={classId}
      initialSemesterId={semesterId}
    />
  );
}

function readPositiveInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
