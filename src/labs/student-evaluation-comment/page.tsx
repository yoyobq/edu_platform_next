// src/labs/student-evaluation-comment/page.tsx

import { useMemo, useState } from 'react';
import { FileTextOutlined, FormOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Tabs, Tag } from 'antd';
import { useLoaderData } from 'react-router';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { StudentEvaluationCommentClassScopeEditor } from './ui/class-scope-editor';
import { MyStudentEvaluationCommentsPanel } from './ui/my-comments-panel';
import { studentEvaluationCommentLabMeta } from './meta';
import type { StudentEvaluationCommentLabLoaderData } from './types';

export function StudentEvaluationCommentLabPage() {
  const loaderData = useLoaderData<StudentEvaluationCommentLabLoaderData>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const items = useMemo(
    () => [
      ...(loaderData.canEditClassScope
        ? [
            {
              children: (
                <StudentEvaluationCommentClassScopeEditor onDirtyChange={setHasUnsavedChanges} />
              ),
              icon: <FormOutlined />,
              key: 'class-scope',
              label: '班级评语编辑',
            },
          ]
        : []),
      {
        children: <MyStudentEvaluationCommentsPanel />,
        icon: <UserOutlined />,
        key: 'mine',
        label: '我的正式评语',
      },
    ],
    [loaderData.canEditClassScope],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        aside={hasUnsavedChanges ? <Tag color="warning">有未保存修改</Tag> : undefined}
        badge={<Tag>{studentEvaluationCommentLabMeta.name}</Tag>}
        description="教师可按班级范围人工编辑正式评语，或生成、审阅 AI 加密草稿；学生仅查看自己的正式评语。"
        icon={<FileTextOutlined />}
        title="学生正式评语"
      />

      <Alert
        showIcon
        description="AI 仅用于真实学期评语：系统按老师选定的学生异步生成 7 天有效的加密草稿，老师保存修改并二次确认后才写入正式评语。Excel 仍只用于人工草稿导入；本页不提供历史版本、导出或跨班批量操作。"
        title="Lab 边界"
        type="info"
      />

      <Tabs defaultActiveKey={loaderData.defaultView} destroyOnHidden={false} items={items} />
    </div>
  );
}
