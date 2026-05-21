// src/shared/ui/responsive-layout/responsive-grid.tsx

import { createContext, type CSSProperties, type ReactNode, useContext, useRef } from 'react';

import type { DefaultWidthBand, ResponsiveValue, WidthBandRule } from './types';
import { useWidthBand } from './use-width-band';

type GridColumns = number | string;

const DEFAULT_WIDTH_BAND_RULES: WidthBandRule<DefaultWidthBand>[] = [
  { max: 767, value: 'compact' },
  { max: 1023, value: 'regular' },
  { max: 1279, value: 'large' },
];

const GridBandContext = createContext<DefaultWidthBand>('wide');

function resolveResponsiveValue<Value>(
  values: ResponsiveValue<Value>,
  band: DefaultWidthBand,
): Value | undefined {
  if (values[band] !== undefined) {
    return values[band];
  }

  if (band === 'wide') {
    return values.large ?? values.regular ?? values.compact ?? values.fallback;
  }

  if (band === 'large') {
    return values.regular ?? values.compact ?? values.fallback;
  }

  if (band === 'regular') {
    return values.compact ?? values.fallback;
  }

  return values.fallback;
}

function toGridTemplateColumns(columns: GridColumns | undefined): string | undefined {
  if (typeof columns === 'number') {
    return `repeat(${columns}, minmax(0, 1fr))`;
  }

  return columns;
}

function toGridColumn(span: number | 'full' | undefined): string | undefined {
  if (!span) {
    return undefined;
  }

  if (span === 'full') {
    return '1 / -1';
  }

  return `span ${span} / span ${span}`;
}

function joinClassNames(...classNames: (string | undefined)[]) {
  return classNames.filter(Boolean).join(' ');
}

export function ResponsiveGrid({
  children,
  className,
  columns,
  style,
}: {
  children: ReactNode;
  className?: string;
  columns: ResponsiveValue<GridColumns>;
  style?: CSSProperties;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const { band } = useWidthBand(gridRef, DEFAULT_WIDTH_BAND_RULES, 'wide');
  const gridTemplateColumns = toGridTemplateColumns(resolveResponsiveValue(columns, band) ?? 1);

  return (
    <GridBandContext.Provider value={band}>
      <div
        ref={gridRef}
        className={joinClassNames('grid', className)}
        style={{ ...style, gridTemplateColumns }}
      >
        {children}
      </div>
    </GridBandContext.Provider>
  );
}

export function ResponsiveGridItem({
  children,
  className,
  order,
  span,
  style,
}: {
  children: ReactNode;
  className?: string;
  order?: ResponsiveValue<CSSProperties['order']>;
  span?: ResponsiveValue<number | 'full'>;
  style?: CSSProperties;
}) {
  const band = useContext(GridBandContext);
  const gridColumn = span ? toGridColumn(resolveResponsiveValue(span, band)) : undefined;
  const resolvedOrder = order ? resolveResponsiveValue(order, band) : undefined;

  return (
    <div className={className} style={{ ...style, gridColumn, order: resolvedOrder }}>
      {children}
    </div>
  );
}
