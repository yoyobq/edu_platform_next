// src/pages/my-curriculum-plan-homepage/index.tsx

import { useLoaderData } from 'react-router';

import {
  AcademicCurriculumPlanHomepagePageContent,
  type AcademicCurriculumPlanHomepagePageLoaderData,
} from '@/features/academic-curriculum-plan-homepage';

export function MyCurriculumPlanHomepagePage() {
  const loaderData = useLoaderData() as AcademicCurriculumPlanHomepagePageLoaderData;

  return <AcademicCurriculumPlanHomepagePageContent currentAccount={loaderData.currentAccount} />;
}
