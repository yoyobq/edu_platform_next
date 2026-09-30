// src/entities/class-work-context/ui.tsx
import { ArrowLeftOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Select, Skeleton, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';

import { type ClassWorkOption, type ClassWorkScope, useClassWorkContext } from './context';

import './ui.css';

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

export type ClassWorkScopeBarProps = {
  classId?: string | null;
  options: readonly ClassWorkOption[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (classId: string) => void;
};

/** The page owns options, selection and leave protection; this only presents its scope. */
export function ClassWorkScopeBar({
  classId,
  options,
  loading = false,
  disabled = false,
  onChange,
}: ClassWorkScopeBarProps) {
  const context = useClassWorkContext();
  const temporary = Boolean(classId && context?.workClass && classId !== context.workClass.id);
  const selected = options.find((option) => option.id === classId);
  const unavailable = Boolean(classId && !selected && !loading);
  return (
    <div className="class-work-scope-bar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="class-work-scope-picker">
          <span className="shrink-0 text-sm text-text-secondary">当前班级：</span>
          <div className="min-w-0 flex-1 rounded-block bg-bg-container">
            <Select<string>
              aria-label="当前班级"
              title={
                selected
                  ? `${selected.className} · ${selected.classCode}（仅切换当前页面）`
                  : undefined
              }
              variant="outlined"
              showSearch
              optionFilterProp="label"
              popupMatchSelectWidth={false}
              styles={{
                root: { width: '100%', minWidth: 0 },
                popup: { root: { maxWidth: 'min(420px, 90vw)' } },
              }}
              value={selected?.id}
              loading={loading}
              disabled={disabled || loading || options.length === 0}
              placeholder={
                loading
                  ? '正在读取班级'
                  : unavailable
                    ? '当前班级不可用'
                    : options.length
                      ? '选择班级'
                      : '暂无可选班级'
              }
              notFoundContent="没有匹配的班级"
              options={options.map((option) => ({
                ...option,
                value: option.id,
                label: `${option.className} · ${option.classCode}`,
              }))}
              labelRender={() => selected?.className}
              optionRender={(option) => (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="whitespace-normal break-words">{option.data.className}</span>
                  <span className="text-xs text-text-secondary">{option.data.classCode}</span>
                </div>
              )}
              onChange={onChange}
            />
          </div>
        </div>
        {temporary ? <Tag color="default">临时查看</Tag> : null}
        {temporary ? (
          <Button
            size="small"
            type="link"
            icon={<UndoOutlined />}
            onClick={context?.returnToWorkClass}
            title={`返回工作班级：${context?.workClass?.className}`}
          >
            返回工作班级
          </Button>
        ) : null}
        {unavailable ? <Typography.Text type="warning">请选择可操作班级</Typography.Text> : null}
      </div>
      {context?.returnToInspection ? (
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={context.returnToInspection}>
          返回学籍卡检查
        </Button>
      ) : null}
    </div>
  );
}
