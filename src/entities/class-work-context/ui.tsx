// src/entities/class-work-context/ui.tsx
import { ArrowLeftOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Flex, Skeleton, Tag } from 'antd';
import type { ReactNode } from 'react';

import { type ClassWorkScope, useClassWorkContext } from './context';
/** Page composition owns the boundary; feature instances keep their own temporary selection. */
export function ClassWorkEntry({
  children,
}: {
  children: (entry: { key: string; scope: ClassWorkScope }) => ReactNode;
}) {
  const context = useClassWorkContext();
  if (context && !context.ready) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }
  return children({ key: context?.entryKey ?? 'standalone', scope: context?.scope ?? {} });
}

export function ClassWorkScopeNotice({ classId }: { classId?: string | null }) {
  const context = useClassWorkContext();
  if (!context) return null;
  const temporary = Boolean(classId && context.workClass && classId !== context.workClass.id);
  if (!temporary && !context.returnToInspection) return null;
  return (
    <Flex align="center" justify="space-between" gap={8} wrap>
      <Flex align="center" gap={8} wrap>
        {temporary ? <Tag>临时查看</Tag> : null}
        {temporary ? (
          <span className="text-xs text-text-secondary">
            工作班级：{context.workClass?.className}
          </span>
        ) : null}
        {temporary ? (
          <Button
            size="small"
            type="link"
            icon={<UndoOutlined />}
            onClick={context.returnToWorkClass}
          >
            返回工作班级
          </Button>
        ) : null}
      </Flex>
      {context.returnToInspection ? (
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={context.returnToInspection}>
          返回学籍卡检查
        </Button>
      ) : null}
    </Flex>
  );
}
