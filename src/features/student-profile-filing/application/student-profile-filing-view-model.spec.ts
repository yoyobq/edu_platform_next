// src/features/student-profile-filing/application/student-profile-filing-view-model.spec.ts

import { describe, expect, it } from 'vitest';

import type { StudentProfileFilingStudent } from '../infrastructure/student-profile-filing-api';

import {
  countStudentProfileFilingCompleteness,
  isStudentProfileFilingDroppedStudent,
  listStudentProfileFilingRefreshableStudentIds,
  listVisibleMissingStudentProfileFilingCompletenessLabels,
  resolveStudentProfileFilingActionIntent,
  resolveStudentProfileFilingDroppedSemesterNotice,
  resolveStudentProfileFilingStatus,
  shouldShowStudentProfileFilingInitialClassEmptyState,
  summarizeStudentProfileFilingStudents,
} from './student-profile-filing-view-model';

const completeFlags = {
  educationObserved: true,
  familyObserved: true,
  personalObserved: true,
  photoObserved: true,
  recordObserved: true,
  sensitiveIdentifiersObserved: true,
};

function buildStudent(
  overrides: Partial<StudentProfileFilingStudent>,
): StudentProfileFilingStudent {
  return {
    activeMembershipClassCode: '2501',
    activeMembershipClassName: '25计算机1班',
    attentionLevel: 'READY',
    currentClassCode: '2501',
    currentClassId: 'class-1',
    droppedDecisionReasonCode: null,
    droppedEffectiveSemesterId: null,
    droppedEffectiveSemesterLabel: null,
    lastManualUpdatedAt: null,
    lastSyncedAt: '2026-06-25T01:00:00.000Z',
    manualOverrideActive: false,
    membershipLastObservedAt: '2026-06-24T01:00:00.000Z',
    profileCompletenessFlags: completeFlags,
    rosterScopeSource: 'ACTIVE_MEMBERSHIP',
    sectionStatuses: [],
    snapshotPresent: true,
    sourceObservedAt: '2026-06-25T01:00:00.000Z',
    studentId: 'S001',
    studentName: '张三',
    studentStatus: 'ENROLLED',
    upstreamChangedSinceManualPatch: false,
    upstreamIdPresent: true,
    warningCodes: [],
    ...overrides,
  };
}

describe('student profile filing view model', () => {
  it('classifies filing status from snapshot and upstream readiness', () => {
    expect(resolveStudentProfileFilingStatus(buildStudent({}))).toBe('FILED');
    expect(
      resolveStudentProfileFilingStatus(
        buildStudent({
          attentionLevel: 'MISSING_SNAPSHOT',
          snapshotPresent: false,
        }),
      ),
    ).toBe('PENDING');
    expect(
      resolveStudentProfileFilingStatus(
        buildStudent({
          attentionLevel: 'UPSTREAM_ID_MISSING',
          upstreamIdPresent: false,
        }),
      ),
    ).toBe('BLOCKED');
    expect(
      resolveStudentProfileFilingStatus(
        buildStudent({
          manualOverrideActive: true,
        }),
      ),
    ).toBe('WARNING');
  });

  it('splits row actions by filing status', () => {
    expect(resolveStudentProfileFilingActionIntent(buildStudent({}))).toBe('UPDATE');
    expect(
      resolveStudentProfileFilingActionIntent(
        buildStudent({
          attentionLevel: 'MISSING_SNAPSHOT',
          snapshotPresent: false,
        }),
      ),
    ).toBe('CREATE');
    expect(
      resolveStudentProfileFilingActionIntent(
        buildStudent({
          manualOverrideActive: true,
        }),
      ),
    ).toBe('UPDATE');
    expect(
      resolveStudentProfileFilingActionIntent(
        buildStudent({
          attentionLevel: 'UPSTREAM_ID_MISSING',
          upstreamIdPresent: false,
        }),
      ),
    ).toBe('UNAVAILABLE');
  });

  it('marks dropped students without using status for filing decisions', () => {
    expect(isStudentProfileFilingDroppedStudent(buildStudent({}))).toBe(false);
    expect(isStudentProfileFilingDroppedStudent(buildStudent({ studentStatus: 'DROPPED' }))).toBe(
      true,
    );
    expect(resolveStudentProfileFilingStatus(buildStudent({ studentStatus: 'DROPPED' }))).toBe(
      'FILED',
    );
  });

  it('formats dropped semester notice only from backend roster scope fields', () => {
    expect(
      resolveStudentProfileFilingDroppedSemesterNotice(
        buildStudent({
          droppedEffectiveSemesterLabel: '2024-2025 学年第二学期',
          rosterScopeSource: 'DROPPED_DECISION',
          studentStatus: 'DROPPED',
        }),
      ),
    ).toBe('自2024-2025 学年第二学期起退学');
    expect(
      resolveStudentProfileFilingDroppedSemesterNotice(
        buildStudent({
          droppedEffectiveSemesterLabel: '2024-2025 学年第二学期',
          studentStatus: 'DROPPED',
        }),
      ),
    ).toBeNull();
  });

  it('counts completeness flags and summarizes a class', () => {
    const students = [
      buildStudent({
        studentId: 'S001',
      }),
      buildStudent({
        attentionLevel: 'MISSING_SNAPSHOT',
        snapshotPresent: false,
        studentId: 'S002',
      }),
      buildStudent({
        attentionLevel: 'UPSTREAM_ID_MISSING',
        studentId: 'S003',
        upstreamIdPresent: false,
      }),
      buildStudent({
        profileCompletenessFlags: {
          ...completeFlags,
          familyObserved: false,
        },
        studentId: 'S004',
      }),
    ];

    expect(countStudentProfileFilingCompleteness(students[3].profileCompletenessFlags)).toBe(5);
    expect(summarizeStudentProfileFilingStudents(students)).toEqual({
      blockedCount: 1,
      filedCount: 1,
      pendingCount: 1,
      refreshableCount: 3,
      totalCount: 4,
      warningCount: 1,
    });
    expect(listStudentProfileFilingRefreshableStudentIds(students)).toEqual([
      'S001',
      'S002',
      'S004',
    ]);
  });

  it('does not show per-section missing reminders before the first local snapshot exists', () => {
    const missingFlags = {
      educationObserved: false,
      familyObserved: false,
      personalObserved: false,
      photoObserved: false,
      recordObserved: false,
      sensitiveIdentifiersObserved: false,
    };

    expect(
      listVisibleMissingStudentProfileFilingCompletenessLabels(
        buildStudent({
          attentionLevel: 'MISSING_SNAPSHOT',
          profileCompletenessFlags: missingFlags,
          snapshotPresent: false,
        }),
      ),
    ).toEqual([]);
    expect(
      listVisibleMissingStudentProfileFilingCompletenessLabels(
        buildStudent({
          profileCompletenessFlags: {
            ...completeFlags,
            familyObserved: false,
            photoObserved: false,
          },
        }),
      ),
    ).toEqual(['照片', '家庭']);
  });

  it('uses the class-level empty state only when every student is waiting for initial filing', () => {
    expect(
      shouldShowStudentProfileFilingInitialClassEmptyState({
        blockedCount: 0,
        filedCount: 0,
        pendingCount: 2,
        refreshableCount: 2,
        totalCount: 2,
        warningCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowStudentProfileFilingInitialClassEmptyState({
        blockedCount: 0,
        filedCount: 1,
        pendingCount: 1,
        refreshableCount: 2,
        totalCount: 2,
        warningCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowStudentProfileFilingInitialClassEmptyState({
        blockedCount: 1,
        filedCount: 0,
        pendingCount: 1,
        refreshableCount: 1,
        totalCount: 2,
        warningCount: 0,
      }),
    ).toBe(false);
  });
});
