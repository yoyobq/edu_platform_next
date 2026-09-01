// src/features/academic-teaching-plan/ui/academic-teaching-plan-page-content.tsx

import { CalendarOutlined } from '@ant-design/icons';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import type { AcademicTeachingPlanPageLoaderData } from '../types';

import { MyTeachingPlanWorkspace } from './my-teaching-plan-workspace';

export function AcademicTeachingPlanPageContent(loaderData: AcademicTeachingPlanPageLoaderData) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        description="把课表与校历计算后的真源投影成课程级授课计划，直接查看每门课具体在哪些日期发生。"
        icon={<CalendarOutlined />}
        title="My 授课计划"
      />

      <MyTeachingPlanWorkspace {...loaderData} />
    </div>
  );
}
