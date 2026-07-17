// src/entities/academic-semester/ui/academic-term-tabs.spec.ts

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AcademicTermTabs } from './academic-term-tabs';

describe('AcademicTermTabs', () => {
  it('keeps the compact academic term labels and orders tabs by backend sequence', () => {
    const html = renderToStaticMarkup(
      createElement(AcademicTermTabs, {
        activeSemesterId: 13,
        children: createElement('div', null, '当前学期内容'),
        records: [
          {
            label: '2025-2026学年第二学期',
            schoolYear: 2025,
            semesterId: 12,
            sequence: 2,
            termNumber: 2,
          },
          {
            label: '2026-2027学年第一学期',
            schoolYear: 2026,
            semesterId: 13,
            sequence: 3,
            termNumber: 1,
          },
          {
            label: '2025-2026学年第一学期',
            schoolYear: 2025,
            semesterId: 11,
            sequence: 1,
            termNumber: 1,
          },
        ],
        onChange: () => undefined,
      }),
    );

    expect(html).toContain('26-27学年');
    expect(html).toContain('25-26学年');
    expect(html).toContain('第一学期');
    expect(html).toContain('第二学期');
    expect(html.indexOf('26-27学年')).toBeLessThan(html.indexOf('第二学期'));
    expect(html.indexOf('第二学期')).toBeLessThan(html.lastIndexOf('25-26学年'));
    expect(html).toMatch(/academic-term-tab-badge[^>]*>3<\/span>/);
    expect(html).toMatch(/academic-term-tab-badge[^>]*>2<\/span>/);
    expect(html).toMatch(/academic-term-tab-badge[^>]*>1<\/span>/);
  });
});
