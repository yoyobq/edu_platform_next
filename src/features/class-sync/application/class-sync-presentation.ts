// src/features/class-sync/application/class-sync-presentation.ts

type ClassAdmissionCategory = 'HIGH_SCHOOL_ORIGIN' | 'JUNIOR_HIGH_ORIGIN';

const ADMISSION_CATEGORY_LABELS: Record<ClassAdmissionCategory, string> = {
  HIGH_SCHOOL_ORIGIN: '高中起点',
  JUNIOR_HIGH_ORIGIN: '初中起点',
};

export function formatClassAdmissionCategory(value: ClassAdmissionCategory | null) {
  return value ? ADMISSION_CATEGORY_LABELS[value] : '—';
}
