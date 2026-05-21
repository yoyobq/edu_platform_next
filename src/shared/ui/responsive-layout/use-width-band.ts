// src/shared/ui/responsive-layout/use-width-band.ts

import { type RefObject, useEffect, useMemo, useState } from 'react';

import type { WidthBandRule } from './types';

function resolveWidthBand<Band extends string>(
  width: number,
  rules: WidthBandRule<Band>[],
  fallback: Band,
): Band {
  for (const rule of rules) {
    if (width <= rule.max) {
      return rule.value;
    }
  }

  return fallback;
}

export function useWidthBand<ElementType extends HTMLElement, Band extends string>(
  elementRef: RefObject<ElementType | null>,
  rules: WidthBandRule<Band>[],
  fallback: Band,
) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = elementRef.current;

    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef]);

  return useMemo(
    () => ({
      width,
      band: resolveWidthBand(width, rules, fallback),
    }),
    [fallback, rules, width],
  );
}
