export type FontScale = 'compact' | 'standard' | 'comfortable' | 'xlarge';

export const FONT_SCALE_CONFIG: Record<
  FontScale,
  { antdFontSize: number; htmlFontSize: string; label: string }
> = {
  compact: { antdFontSize: 13, htmlFontSize: '15px', label: '小' },
  standard: { antdFontSize: 14, htmlFontSize: '16px', label: '标' },
  comfortable: { antdFontSize: 16, htmlFontSize: '18px', label: '大' },
  xlarge: { antdFontSize: 18, htmlFontSize: '20px', label: '特大' },
};

export const FONT_SCALE_OPTIONS: { label: string; value: FontScale }[] = [
  { label: '小', value: 'compact' },
  { label: '标', value: 'standard' },
  { label: '大', value: 'comfortable' },
  { label: '特大', value: 'xlarge' },
];
