// src/shared/ui/responsive-layout/types.ts

export type WidthBandRule<Band extends string> = {
  max: number;
  value: Band;
};

export type DefaultWidthBand = 'compact' | 'regular' | 'large' | 'wide';

export type ResponsiveValue<Value> = Partial<Record<DefaultWidthBand, Value>> & {
  fallback?: Value;
};
