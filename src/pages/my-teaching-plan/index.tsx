// src/pages/my-teaching-plan/index.tsx

import { useLoaderData } from 'react-router';

import {
  AcademicTeachingPlanPageContent,
  type AcademicTeachingPlanPageLoaderData,
} from '@/features/academic-teaching-plan';

export function MyTeachingPlanPage() {
  const loaderData = useLoaderData() as AcademicTeachingPlanPageLoaderData;

  return <AcademicTeachingPlanPageContent {...loaderData} />;
}
