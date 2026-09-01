import { CalendarOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import { useLoaderData } from 'react-router';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { MyTeachingPlanWorkspace } from './ui/my-teaching-plan-workspace';
import { myTeachingPlanLabMeta } from './meta';
import type { MyTeachingPlanLabLoaderData } from './types';

export function MyTeachingPlanLabPage() {
  const loaderData = useLoaderData<MyTeachingPlanLabLoaderData>();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag color="blue">Product Lab</Tag>}
        description="把课表与校历计算后的真源投影成课程级教学计划，直接查看每门课具体在哪些日期发生。"
        icon={<CalendarOutlined />}
        title="My 教学计划"
      />

      <MyTeachingPlanWorkspace {...loaderData} />

      <span className="sr-only">{myTeachingPlanLabMeta.name}</span>
    </div>
  );
}
