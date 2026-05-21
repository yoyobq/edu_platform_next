export const DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR = 'var(--color-ai-accent-bg)';
export const PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR = 'var(--color-workbench-custom-purple-bg)';

export const CUSTOM_ITEM_BACKGROUND_OPTIONS = [
  {
    label: 'AI 橙',
    value: DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '蓝',
    value: 'var(--color-workbench-custom-blue-bg)',
  },
  {
    label: '绿',
    value: 'var(--color-workbench-custom-green-bg)',
  },
  {
    label: '紫',
    value: PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '黄',
    value: 'var(--color-workbench-custom-yellow-bg)',
  },
] as const;
