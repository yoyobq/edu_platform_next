// src/features/academic-calendar-management/application/calendar-event-query-state.spec.ts

import { describe, expect, it } from 'vitest';

import {
  calendarEventQueryReducer,
  initialCalendarEventQueryState,
} from './calendar-event-query-state';

describe('calendar event query concurrency', () => {
  it('ignores stale success and failure after changing semester or clearing selection', () => {
    const loading = calendarEventQueryReducer(initialCalendarEventQueryState, {
      type: 'start',
      requestId: 2,
    });
    expect(calendarEventQueryReducer(loading, { type: 'success', requestId: 1, records: [] })).toBe(
      loading,
    );
    expect(
      calendarEventQueryReducer(loading, { type: 'failure', requestId: 1, error: '旧学期错误' }),
    ).toBe(loading);
    const cleared = calendarEventQueryReducer(loading, { type: 'clear', requestId: 3 });
    expect(calendarEventQueryReducer(cleared, { type: 'success', requestId: 2, records: [] })).toBe(
      cleared,
    );
  });
});
