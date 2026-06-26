// src/shared/ui/stable-table/index.ts

import type { ColumnType } from 'antd/es/table';
import type { CSSProperties } from 'react';

export function buildStableColumnStyle(width: number): CSSProperties {
  return {
    maxWidth: width,
    minWidth: width,
    width,
  };
}

export function buildStableColumnSizing<TRecord>(
  width: number,
): Pick<ColumnType<TRecord>, 'onCell' | 'onHeaderCell' | 'width'> {
  return {
    onCell: () => ({
      style: buildStableColumnStyle(width),
    }),
    onHeaderCell: () => ({
      style: {
        ...buildStableColumnStyle(width),
        textAlign: 'center',
      },
    }),
    width,
  };
}
