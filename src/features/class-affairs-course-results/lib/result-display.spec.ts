// src/features/class-affairs-course-results/lib/result-display.spec.ts

import { describe, expect, it } from 'vitest';

import type { ManagedCourseResultsItem } from '../api';

import { splitCourseResultsItemsForDisplay } from './result-display';

function buildItem(
  input: Pick<
    ManagedCourseResultsItem,
    | 'resultDisplayDecisionOutcome'
    | 'resultDisplayEffectiveSemesterId'
    | 'resultDisplayReasonCode'
    | 'resultDisplayStatus'
    | 'studentNumber'
    | 'studentStatus'
  >,
): ManagedCourseResultsItem {
  return {
    fetchedAt: null,
    resultDisplayMessage: null,
    results: [],
    source: 'CACHE',
    studentName: input.studentNumber,
    ...input,
  };
}

describe('course results display split', () => {
  const semesters = [
    { id: 1, schoolYear: 2024, termNumber: 1 },
    { id: 2, schoolYear: 2024, termNumber: 2 },
    { id: 3, schoolYear: 2025, termNumber: 1 },
  ];

  it('keeps normal and confirmed in-class special cases in the regular table', () => {
    const { regularItems, specialItems } = splitCourseResultsItemsForDisplay(
      [
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: null,
          resultDisplayReasonCode: null,
          resultDisplayStatus: 'NORMAL',
          studentNumber: 'normal',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: 'INCLUDE',
          resultDisplayEffectiveSemesterId: 2,
          resultDisplayReasonCode: 'TRANSFERRED_IN_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'transferred-in',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: 2,
          resultDisplayReasonCode: 'REENROLLED_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'reenrolled',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: 2,
          resultDisplayReasonCode: 'RETAINED_GRADE_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'retained',
          studentStatus: 'ENROLLED',
        }),
      ],
      {
        activeSemesterId: 2,
        semesters,
      },
    );

    expect(regularItems.map((item) => item.studentNumber)).toEqual([
      'normal',
      'transferred-in',
      'reenrolled',
      'retained',
    ]);
    expect(specialItems).toEqual([]);
  });

  it('moves excluded, transferred-out, dropped and suspended students to the special table', () => {
    const { regularItems, specialItems } = splitCourseResultsItemsForDisplay(
      [
        buildItem({
          resultDisplayDecisionOutcome: 'EXCLUDE',
          resultDisplayEffectiveSemesterId: null,
          resultDisplayReasonCode: 'CLASS_MEMBERSHIP_CORRECTION',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'excluded',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: null,
          resultDisplayReasonCode: 'TRANSFERRED_OUT_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'transferred-out',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: 'EXCLUDE',
          resultDisplayEffectiveSemesterId: 2,
          resultDisplayReasonCode: 'DROPPED_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'dropped-decision',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: null,
          resultDisplayReasonCode: null,
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'suspended-status',
          studentStatus: 'SUSPENDED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: null,
          resultDisplayEffectiveSemesterId: null,
          resultDisplayReasonCode: null,
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'dropped-status',
          studentStatus: 'DROPPED',
        }),
      ],
      {
        activeSemesterId: 2,
        semesters,
      },
    );

    expect(regularItems).toEqual([]);
    expect(specialItems.map((item) => item.studentNumber)).toEqual([
      'excluded',
      'transferred-out',
      'dropped-decision',
      'suspended-status',
      'dropped-status',
    ]);
  });

  it('keeps dropped students in the regular table before the dropped effective semester', () => {
    const { regularItems, specialItems } = splitCourseResultsItemsForDisplay(
      [
        buildItem({
          resultDisplayDecisionOutcome: 'EXCLUDE',
          resultDisplayEffectiveSemesterId: 3,
          resultDisplayReasonCode: 'DROPPED_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'dropped-next-term',
          studentStatus: 'ENROLLED',
        }),
      ],
      {
        activeSemesterId: 2,
        semesters,
      },
    );

    expect(regularItems.map((item) => item.studentNumber)).toEqual(['dropped-next-term']);
    expect(specialItems).toEqual([]);
  });

  it('moves transfer-in, reenrolled and retained students to the special table before entry', () => {
    const { regularItems, specialItems } = splitCourseResultsItemsForDisplay(
      [
        buildItem({
          resultDisplayDecisionOutcome: 'INCLUDE',
          resultDisplayEffectiveSemesterId: 3,
          resultDisplayReasonCode: 'TRANSFERRED_IN_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'transferred-in-before-entry',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: 'INCLUDE',
          resultDisplayEffectiveSemesterId: 3,
          resultDisplayReasonCode: 'REENROLLED_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'reenrolled-before-entry',
          studentStatus: 'ENROLLED',
        }),
        buildItem({
          resultDisplayDecisionOutcome: 'INCLUDE',
          resultDisplayEffectiveSemesterId: 3,
          resultDisplayReasonCode: 'RETAINED_GRADE_CONFIRMED',
          resultDisplayStatus: 'SPECIAL_CASE',
          studentNumber: 'retained-before-entry',
          studentStatus: 'ENROLLED',
        }),
      ],
      {
        activeSemesterId: 2,
        semesters,
      },
    );

    expect(regularItems).toEqual([]);
    expect(specialItems.map((item) => item.studentNumber)).toEqual([
      'transferred-in-before-entry',
      'reenrolled-before-entry',
      'retained-before-entry',
    ]);
  });
});
