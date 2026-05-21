import { type CSSProperties, type ReactNode } from 'react';
import { LockOutlined } from '@ant-design/icons';

import { ResponsiveGrid } from '@/shared/ui/responsive-layout';

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
        gridClassName: 'gap-x-6 gap-y-6',
        gridColumns: { compact: 1, regular: 2, wide: 3 },
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: undefined,
      };
    case 'reference':
      return {
        bodyClassName: 'border-t border-border pt-4',
        bodyStyle: undefined,
        gridClassName: 'gap-x-6 gap-y-3',
        gridColumns: { compact: 1, regular: 2, wide: 4 },
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-xs font-mono',
        valueStyle: { color: 'var(--ant-color-text-secondary)' } as CSSProperties,
      };
    case 'fixed':
    default:
      return {
        bodyClassName: '',
        gridClassName: 'gap-x-6 gap-y-4',
        gridColumns: { compact: 1, regular: 2 },
        itemClassName: '',
        itemStyle: undefined,
        valueClassName: 'text-sm font-medium',
        valueStyle: { color: 'var(--ant-color-text)' } as CSSProperties,
      };
  }
}

function DetailFieldGrid({
  gridClassName,
  gridColumns,
  items,
  itemClassName,
  itemStyle,
  valueClassName,
  valueStyle,
}: {
  gridClassName: string;
  gridColumns: { compact: number; regular?: number; wide?: number };
  items: readonly DetailItem[];
  itemClassName: string;
  itemStyle?: CSSProperties;
  valueClassName: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <ResponsiveGrid className={gridClassName} columns={gridColumns}>
      {items.map((item) => (
        <div key={item.key} className={`flex flex-col gap-1.5 ${itemClassName}`} style={itemStyle}>
          <div className="text-xs text-text-secondary">{item.label}</div>
          <div className={valueClassName} style={valueStyle}>
            {item.value}
          </div>
        </div>
      ))}
    </ResponsiveGrid>
  );
}

export function DetailSectionBlock({ section }: { section: DetailSection }) {
  const toneStyle = getSectionToneStyle(section.tone);

  return (
    <div className={toneStyle.bodyClassName} style={toneStyle.bodyStyle}>
      <DetailFieldGrid
        gridClassName={toneStyle.gridClassName}
        gridColumns={toneStyle.gridColumns}
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
