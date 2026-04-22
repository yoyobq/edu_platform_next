export const ACADEMIC_CALENDAR_EVENT_DAY_PERIODS = ['AFTERNOON', 'ALL_DAY', 'MORNING'] as const;
export const ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES = ['ACTIVE', 'EXPIRED', 'TENTATIVE'] as const;
export const ACADEMIC_CALENDAR_EVENT_TYPES = [
  'ACTIVITY',
  'EXAM',
  'HOLIDAY',
  'HOLIDAY_MAKEUP',
  'SPORTS_MEET',
  'WEEKDAY_SWAP',
] as const;
export const ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS = [
  'CANCEL',
  'MAKEUP',
  'NO_CHANGE',
  'SWAP',
] as const;

export type AcademicCalendarEventDayPeriod = (typeof ACADEMIC_CALENDAR_EVENT_DAY_PERIODS)[number];
export type AcademicCalendarEventRecordStatus =
  (typeof ACADEMIC_CALENDAR_EVENT_RECORD_STATUSES)[number];
export type AcademicCalendarEventType = (typeof ACADEMIC_CALENDAR_EVENT_TYPES)[number];
export type AcademicCalendarTeachingCalcEffect =
  (typeof ACADEMIC_CALENDAR_TEACHING_CALC_EFFECTS)[number];

export type AcademicSemesterRecord = {
  createdAt: string;
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  id: number;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
  updatedAt: string;
};

export type AcademicCalendarEventRecord = {
  createdAt: string;
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  id: number;
  originalDate: string | null;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote: string | null;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  updatedAt: string;
  updatedByAccountId: number | null;
  version: number;
};

export type ListAcademicSemestersInput = {
  isCurrent?: boolean;
  limit?: number;
  schoolYear?: number;
  termNumber?: number;
};

export type CreateAcademicSemesterInput = {
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
};

export type UpdateAcademicSemesterInput = Partial<CreateAcademicSemesterInput> & {
  id: number;
};

export type ListAcademicCalendarEventsInput = {
  eventDate?: string;
  eventType?: AcademicCalendarEventType;
  limit?: number;
  recordStatus?: AcademicCalendarEventRecordStatus;
  semesterId?: number;
};

export type CreateAcademicCalendarEventInput = {
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  originalDate?: string;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote?: string;
  semesterId: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  version: number;
};

export type UpdateAcademicCalendarEventInput = Partial<CreateAcademicCalendarEventInput> & {
  id: number;
};

export type SemesterFormValues = {
  endDate: string;
  examStartDate: string;
  firstTeachingDate: string;
  isCurrent: boolean;
  name: string;
  schoolYear: number;
  startDate: string;
  termNumber: number;
};

export type CalendarEventFormValues = {
  dayPeriod: AcademicCalendarEventDayPeriod;
  eventDate: string;
  eventType: AcademicCalendarEventType;
  originalDate?: string;
  recordStatus: AcademicCalendarEventRecordStatus;
  ruleNote?: string;
  semesterId?: number;
  teachingCalcEffect: AcademicCalendarTeachingCalcEffect;
  topic: string;
  version: number;
};

export type EventFilters = {
  eventDate?: string;
  eventType?: AcademicCalendarEventType;
  recordStatus?: AcademicCalendarEventRecordStatus;
};
