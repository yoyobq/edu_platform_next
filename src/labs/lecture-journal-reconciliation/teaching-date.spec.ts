import { describe, expect, it } from 'vitest';

import { formatLocalBusinessDate, isFutureTeachingDate } from './teaching-date';

describe('lecture-journal-reconciliation teaching date policy', () => {
  it('formats local business dates without UTC conversion', () => {
    expect(formatLocalBusinessDate(new Date(2026, 3, 30, 23, 59, 59))).toBe('2026-04-30');
  });

  it('treats only later business dates as future teaching dates', () => {
    expect(isFutureTeachingDate('2026-05-01', '2026-04-30')).toBe(true);
    expect(isFutureTeachingDate('2026-04-30', '2026-04-30')).toBe(false);
    expect(isFutureTeachingDate('2026-04-29', '2026-04-30')).toBe(false);
  });

  it('does not block missing or malformed dates', () => {
    expect(isFutureTeachingDate(null, '2026-04-30')).toBe(false);
    expect(isFutureTeachingDate('', '2026-04-30')).toBe(false);
    expect(isFutureTeachingDate('2026/05/01', '2026-04-30')).toBe(false);
  });
});
