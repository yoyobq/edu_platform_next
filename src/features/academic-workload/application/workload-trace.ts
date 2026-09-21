// src/features/academic-workload/application/workload-trace.ts

type WorkloadOccurrenceTrace = {
  exclusionReason: string | null;
  exclusionTargetAdmissionCategory: 'HIGH_SCHOOL_ORIGIN' | 'JUNIOR_HIGH_ORIGIN' | null;
  isEffective: boolean;
};

const ADMISSION_CATEGORY_LABELS = {
  HIGH_SCHOOL_ORIGIN: '高中起点',
  JUNIOR_HIGH_ORIGIN: '初中起点',
} as const;

export function resolveOccurrenceStatusLabel(item: WorkloadOccurrenceTrace) {
  if (item.exclusionReason === 'MILITARY_TRAINING') {
    return '军训不计入';
  }

  return item.isEffective ? '计入' : '扣减';
}

export function formatOccurrenceExclusionReason(item: WorkloadOccurrenceTrace) {
  if (item.exclusionReason !== 'MILITARY_TRAINING') {
    return null;
  }

  const admissionCategory = item.exclusionTargetAdmissionCategory;

  return admissionCategory ? `军训 · ${ADMISSION_CATEGORY_LABELS[admissionCategory]}` : '军训';
}
