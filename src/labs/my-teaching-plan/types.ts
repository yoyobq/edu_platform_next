export type MyTeachingPlanLabLoaderData = {
  canManage: boolean;
  currentStaff: {
    displayName: string;
    staffId: string;
  } | null;
};

export type TeachingPlanCalcEffect = 'CANCEL' | 'MAKEUP' | 'NORMAL' | 'SWAP_IN' | 'SWAP_OUT';

export type TeachingPlanOccurrence = {
  calcEffect: TeachingPlanCalcEffect;
  classroomName: string | null;
  coefficient: string;
  courseCategory: string | null;
  courseName: string | null;
  date: string;
  isEffective: boolean;
  logicalDayOfWeek: number;
  periodEnd: number;
  periodStart: number;
  physicalDayOfWeek: number;
  scheduleId: number;
  semesterId: number;
  slotId: number;
  staffId: string;
  staffName: string;
  teachingClassName: string;
  weekIndex: number;
};

export type TeachingPlanOccurrenceEnvelope = {
  invalidReason: string | null;
  isComplete: boolean;
  isValid: boolean;
  items: TeachingPlanOccurrence[];
  truncationReason: string | null;
};

export type TeachingPlanTeacherOption = {
  staffId: string;
  staffName: string;
};
