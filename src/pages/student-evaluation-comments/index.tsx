// src/pages/student-evaluation-comments/index.tsx

import { FileDoneOutlined } from '@ant-design/icons';
import { useLoaderData } from 'react-router';

import { Error403 } from '@/features/error-feedback';
import {
  StudentEvaluationCommentWorkbench,
  type StudentEvaluationCommentWorkbenchLoaderData,
} from '@/features/student-evaluation-comment';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

export function StudentEvaluationCommentsPage() {
  const data = useLoaderData<StudentEvaluationCommentWorkbenchLoaderData | { isForbidden: true }>();
  if (!('currentAccount' in data)) return <Error403 />;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6">
      <DecoratedPageHeader
        description="在学期评语与毕业鉴定两个范围内，选择学生、生成或编辑草稿、审阅并确认正式结果。"
        icon={<FileDoneOutlined />}
        title="班级评语治理"
      />
      <StudentEvaluationCommentWorkbench currentAccount={data.currentAccount} />
    </div>
  );
}
