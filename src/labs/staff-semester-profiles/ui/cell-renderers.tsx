// src/labs/staff-semester-profiles/ui/cell-renderers.tsx
import { Typography } from 'antd';

import { EMPTY_CELL_TEXT } from '../lib/labels';

export function renderEmptyText() {
  return <Typography.Text type="secondary">{EMPTY_CELL_TEXT}</Typography.Text>;
}

export function renderSingleLineText(
  value: string | null | undefined,
  options: { strong?: boolean } = {},
) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return renderEmptyText();
  }

  return (
    <Typography.Text ellipsis={{ tooltip: normalizedValue }} strong={options.strong}>
      {normalizedValue}
    </Typography.Text>
  );
}
