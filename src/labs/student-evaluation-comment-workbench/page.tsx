// src/labs/student-evaluation-comment-workbench/page.tsx

import { FileDoneOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import { useLoaderData } from 'react-router';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { StudentEvaluationCommentProductWorkbench } from './ui/product-workbench';
import { studentEvaluationCommentWorkbenchLabMeta } from './meta';
import type { StudentEvaluationCommentWorkbenchLoaderData } from './types';

export function StudentEvaluationCommentWorkbenchLabPage() {
  const loaderData = useLoaderData<StudentEvaluationCommentWorkbenchLoaderData>();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        badge={<Tag color="blue">Product Lab</Tag>}
        description="以学期为范围完成全班评语：选择学生、生成或编辑草稿、审阅并确认正式结果。"
        icon={<FileDoneOutlined />}
        title="班级评语工作台"
      />

      <StudentEvaluationCommentProductWorkbench currentAccount={loaderData.currentAccount} />

      <span className="sr-only">{studentEvaluationCommentWorkbenchLabMeta.name}</span>
    </div>
  );
}
