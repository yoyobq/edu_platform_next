// src/features/class-work-context/ui/selector.tsx
import { ReloadOutlined } from '@ant-design/icons';
import { Button, Select, Tooltip } from 'antd';

import { useClassWorkContext } from '@/entities/class-work-context';

export function ClassWorkSelector({ containedPopup = false }: { containedPopup?: boolean }) {
  const context = useClassWorkContext();
  if (!context) return null;
  return (
    <div
      className="flex flex-col gap-2 py-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="text-xs text-text-secondary">工作班级</span>
      <Select
        aria-label="工作班级"
        showSearch
        optionFilterProp="label"
        value={context.workClass?.id}
        placeholder={context.loading ? '正在读取班级…' : '选择工作班级'}
        loading={context.loading}
        disabled={context.loading || Boolean(context.error) || context.options.length === 0}
        options={context.options.map((item) => ({
          value: item.id,
          label: `${item.className} · ${item.classCode}`,
        }))}
        labelRender={({ value }) =>
          context.options.find((item) => item.id === value)?.className ?? '选择工作班级'
        }
        onChange={context.changeWorkClass}
        popupMatchSelectWidth={false}
        styles={{
          root: { width: '100%', minWidth: 160 },
          popup: { root: { maxWidth: 'min(420px, 90vw)' } },
        }}
        getPopupContainer={
          containedPopup ? (trigger) => trigger.parentElement ?? trigger : undefined
        }
        notFoundContent="暂无可用班级"
      />
      {context.error ? (
        <Button size="small" type="link" icon={<ReloadOutlined />} onClick={context.retry}>
          读取失败，重试
        </Button>
      ) : null}
      {context.notice ? (
        <Tooltip title={context.notice}>
          <span className="text-xs text-text-secondary">{context.notice}</span>
        </Tooltip>
      ) : null}
      {!context.loading && !context.error && context.options.length === 0 ? (
        <span className="text-xs text-text-secondary">暂无可用班级</span>
      ) : null}
      {!context.loading && !context.error && !context.workClass && context.options.length > 1 ? (
        <span className="text-xs text-text-secondary">选一次，班务页面默认跟随</span>
      ) : null}
    </div>
  );
}
