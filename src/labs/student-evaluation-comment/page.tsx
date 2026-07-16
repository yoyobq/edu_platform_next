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
                <StudentEvaluationCommentClassScopeEditor
                  classOptionSource={loaderData.classOptionSource}
                  onDirtyChange={setHasUnsavedChanges}
                />
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
    [loaderData.canEditClassScope, loaderData.classOptionSource],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <DecoratedPageHeader
        aside={hasUnsavedChanges ? <Tag color="warning">有未保存修改</Tag> : undefined}
        badge={<Tag>{studentEvaluationCommentLabMeta.name}</Tag>}
        description="人工正式评语实验面：支持班级范围批量写入与 CAS 并发保护，并提供学生本人只读视图。"
        icon={<FileTextOutlined />}
        title="学生正式评语"
      />

      <Alert
        showIcon
        description="本页不提供 AI 草稿、历史版本、导入导出或跨班批量操作；班级权限和学生身份始终由后端判定。"
        title="Lab 边界"
        type="info"
      />

      <Tabs defaultActiveKey={loaderData.defaultView} destroyOnHidden={false} items={items} />
    </div>
  );
}
