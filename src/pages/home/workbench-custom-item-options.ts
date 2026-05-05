export const DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR = 'var(--color-ai-accent-bg)';
export const PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR = 'rgb(243 232 255 / 0.82)';

export const CUSTOM_ITEM_BACKGROUND_OPTIONS = [
  {
    label: 'AI 橙',
    value: DEFAULT_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '蓝',
    value: 'rgb(219 234 254 / 0.82)',
  },
  {
    label: '绿',
    value: 'rgb(220 252 231 / 0.82)',
  },
  {
    label: '紫',
    value: PURPLE_CUSTOM_ITEM_BACKGROUND_COLOR,
  },
  {
    label: '黄',
    value: 'rgb(254 249 195 / 0.82)',
  },
] as const;
