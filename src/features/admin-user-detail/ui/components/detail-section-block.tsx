import { type CSSProperties, type ReactNode } from 'react';
import { LockOutlined } from '@ant-design/icons';

import type { DetailItem, DetailSection } from '../model';

function ReadonlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <LockOutlined style={{ fontSize: 11, color: 'var(--ant-color-text-quaternary)' }} />
      <span
        className="font-mono text-sm font-medium"
        style={{ letterSpacing: '-0.01em', color: 'var(--ant-color-text)' }}
      >
        {children}
      </span>
    </div>
  );
}

function getSectionToneStyle(tone: DetailSection['tone']) {
  switch (tone) {
    case 'editable':
      return {
        bodyClassName: '',
        gridClassName: 'grid gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: undefined,
      };
    case 'reference':
      return {
        bodyClassName: 'border-t border-border pt-4',
        bodyStyle: undefined,
        gridClassName: 'grid gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-xs font-mono',
        valueStyle: { color: 'var(--ant-color-text-secondary)' } as CSSProperties,
      };
    case 'fixed':
    default:
      return {
        bodyClassName: '',
        gridClassName: 'grid gap-x-6 gap-y-4 md:grid-cols-2',
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: { color: 'var(--ant-color-text)' } as CSSProperties,
      };
  }
}

function DetailFieldGrid({
  gridClassName,
  items,
  itemClassName,
  itemStyle,
  valueClassName,
  valueStyle,
}: {
  gridClassName: string;
  items: readonly DetailItem[];
  itemClassName: string;
  itemStyle?: CSSProperties;
  valueClassName: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className={gridClassName}>
      {items.map((item) => (
        <div key={item.key} className={`flex flex-col gap-1.5 ${itemClassName}`} style={itemStyle}>
          <div className="text-xs text-text-secondary">{item.label}</div>
          <div className={valueClassName} style={valueStyle}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSectionBlock({ section }: { section: DetailSection }) {
  const toneStyle = getSectionToneStyle(section.tone);

  return (
    <div className={toneStyle.bodyClassName} style={toneStyle.bodyStyle}>
      <DetailFieldGrid
        gridClassName={toneStyle.gridClassName}
        items={section.items}
        itemClassName={toneStyle.itemClassName}
        itemStyle={toneStyle.itemStyle}
        valueClassName={toneStyle.valueClassName}
        valueStyle={toneStyle.valueStyle}
      />
    </div>
  );
}

export { ReadonlyValue };
