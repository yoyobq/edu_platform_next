// src/features/academic-calendar-management/application/calendar-event-query-state.ts

import type { AcademicCalendarEventRecord } from './types';

export type CalendarEventQueryState = {
  requestId: number;
} & (
  | { status: 'idle' | 'loading'; records: []; error: null }
  | { status: 'ready'; records: AcademicCalendarEventRecord[]; error: null }
  | { status: 'failed'; records: []; error: string }
);

type QueryAction =
  | { type: 'start'; requestId: number }
  | { type: 'clear'; requestId: number }
  | { type: 'success'; requestId: number; records: AcademicCalendarEventRecord[] }
  | { type: 'failure'; requestId: number; error: string };

export const initialCalendarEventQueryState: CalendarEventQueryState = {
  requestId: 0,
  status: 'idle',
  records: [],
  error: null,
};

export function calendarEventQueryReducer(
  state: CalendarEventQueryState,
  action: QueryAction,
): CalendarEventQueryState {
  if (action.type === 'start' || action.type === 'clear') {
    return {
      requestId: action.requestId,
      status: action.type === 'start' ? 'loading' : 'idle',
      records: [],
      error: null,
    };
  }
  if (action.requestId !== state.requestId) return state;
  if (action.type === 'success') {
    return { requestId: action.requestId, status: 'ready', records: action.records, error: null };
  }
  return { requestId: action.requestId, status: 'failed', records: [], error: action.error };
}
