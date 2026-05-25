// src/entities/upstream-session/application/upstream-session-format.spec.ts

import { describe, expect, it } from 'vitest';

import { formatUpstreamSessionDateTime } from './upstream-session-format';

describe('formatUpstreamSessionDateTime', () => {
  it('renders missing timestamps as an upstream empty value', () => {
    expect(formatUpstreamSessionDateTime(null)).toBe('未返回');
    expect(formatUpstreamSessionDateTime(undefined)).toBe('未返回');
  });

  it('preserves invalid timestamp strings', () => {
    expect(formatUpstreamSessionDateTime('not-a-date')).toBe('not-a-date');
  });

  it('formats valid timestamp strings for Chinese locale display', () => {
    const formattedValue = formatUpstreamSessionDateTime('2026-05-25T12:34:56.000Z');

    expect(formattedValue).toContain('2026');
    expect(formattedValue).toContain('34');
    expect(formattedValue).toContain('56');
  });
});
