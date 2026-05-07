import { describe, expect, it } from 'vitest';

import {
  buildCourseCategoryFilterOptions,
  buildResultViewScopeOptions,
  filterItemsByCourseCategory,
  filterItemsByFutureCourseVisibility,
  pickJournalItemsByResultViewScope,
  resolveCourseCategoryFilter,
  resolveResultViewScope,
} from './view-filter-policy';

function buildItem(overrides: { courseCategory?: string | null; teachingDate?: string | null }) {
  return {
    courseCategory: overrides.courseCategory ?? '1',
    teachingDate: overrides.teachingDate ?? '2026-04-29',
  };
}

describe('lecture journal view filter policy', () => {
  it('counts result scopes from the currently date-visible items', () => {
    const visibleItems = [
      buildItem({ teachingDate: '2026-04-29' }),
      buildItem({ teachingDate: '2026-04-30' }),
    ];
    const hiddenFutureItems = [...visibleItems, buildItem({ teachingDate: '9999-12-31' })];

    expect(filterItemsByFutureCourseVisibility(hiddenFutureItems, 'hide')).toEqual(visibleItems);
    expect(
      buildResultViewScopeOptions({
        complete: filterItemsByFutureCourseVisibility(hiddenFutureItems, 'hide').length,
        missing: 0,
        unmatched: 1,
      }),
    ).toEqual([
      {
        count: 2,
        label: '全部',
        value: 'complete',
      },
      {
        count: 0,
        label: '待补日志',
        value: 'missing',
      },
      {
        count: 1,
        label: '需核对',
        value: 'unmatched',
      },
    ]);
  });

  it('keeps the missing scope visible after all missing logs are filled', () => {
    const options = buildResultViewScopeOptions({
      complete: 3,
      missing: 0,
      unmatched: 0,
    });

    expect(options).toEqual([
      {
        count: 3,
        label: '全部',
        value: 'complete',
      },
      {
        count: 0,
        label: '待补日志',
        value: 'missing',
      },
    ]);
    expect(resolveResultViewScope(options, 'missing')).toBe('missing');
  });

  it('falls back to missing scope when the active scope is unavailable', () => {
    const options = buildResultViewScopeOptions({
      complete: 0,
      missing: 3,
      unmatched: 0,
    });

    expect(resolveResultViewScope(options, 'unmatched')).toBe('missing');
  });

  it('hides category filter all option when only one category exists', () => {
    expect(
      buildCourseCategoryFilterOptions([
        buildItem({ courseCategory: '2' }),
        buildItem({ courseCategory: '2' }),
      ]),
    ).toEqual([
      {
        count: 2,
        key: '2',
        label: '实训课',
      },
    ]);
  });

  it('includes all option when multiple non-empty categories exist', () => {
    expect(
      buildCourseCategoryFilterOptions([
        buildItem({ courseCategory: '1' }),
        buildItem({ courseCategory: '3' }),
      ]),
    ).toEqual([
      {
        count: 2,
        key: 'ALL',
        label: '所有类型',
      },
      {
        count: 1,
        key: '1',
        label: '理论课',
      },
      {
        count: 1,
        key: '3',
        label: '一体化',
      },
    ]);
  });

  it('resolves stale category filters and filters category items', () => {
    const options = buildCourseCategoryFilterOptions([
      buildItem({ courseCategory: '1' }),
      buildItem({ courseCategory: '2' }),
    ]);
    const items = [buildItem({ courseCategory: '1' }), buildItem({ courseCategory: '2' })];

    expect(resolveCourseCategoryFilter(options, '3')).toBe('ALL');
    expect(filterItemsByCourseCategory(items, '2')).toEqual([items[1]]);
  });

  it('picks items by result view scope', () => {
    const complete = [buildItem({ courseCategory: '1' })];
    const missing = [buildItem({ courseCategory: '2' })];
    const unmatched = [buildItem({ courseCategory: '3' })];

    expect(
      pickJournalItemsByResultViewScope({
        editableItems: complete,
        presentedMissingEditableItems: missing,
        resultViewScope: 'unmatched',
        unmatchedEditableItems: unmatched,
      }),
    ).toBe(unmatched);
  });
});
