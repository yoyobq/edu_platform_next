import { describe, expect, it } from 'vitest';

import {
  buildJournalDrafts,
  DEFAULT_DISCIPLINE_SITUATION,
  DEFAULT_INTEGRATED_SHIFT,
  DEFAULT_INTEGRATED_SHIFT_NAME,
  DEFAULT_SECURITY_AND_MAINTAIN,
  type JournalDraftSourceItem,
  reuseJournalDraftMapReferences,
} from './journal-draft-policy';

function buildItem(overrides: Partial<JournalDraftSourceItem>): JournalDraftSourceItem {
  return {
    courseCategory: '1',
    journal: null,
    key: 'item-1',
    status: 'MISSING',
    ...overrides,
  };
}

function buildJournal(overrides: Partial<NonNullable<JournalDraftSourceItem['journal']>>) {
  return {
    courseContent: null,
    homeworkAssignment: null,
    lectureJournalDetailId: null,
    lectureJournalId: null,
    rawJournal: null,
    statusCode: null,
    statusName: null,
    topicRecord: null,
    ...overrides,
  };
}

describe('journal draft policy', () => {
  it('prefills missing practice logs with default discipline and security text', () => {
    const drafts = buildJournalDrafts([
      buildItem({
        courseCategory: '2',
        key: 'practice-missing',
        practiceTeachingChapterContent: '车工基础',
        practiceTopicName: '量具使用',
      }),
    ]);

    expect(drafts['practice-missing']).toMatchObject({
      courseContent: '量具使用',
      disciplineSituation: DEFAULT_DISCIPLINE_SITUATION,
      productionProjectTitle: '车工基础',
      securityAndMaintain: DEFAULT_SECURITY_AND_MAINTAIN,
    });
  });

  it('keeps upstream practice discipline when it is already present', () => {
    const drafts = buildJournalDrafts([
      buildItem({
        courseCategory: '2',
        disciplineSituation: '课堂纪律良好',
        key: 'practice-with-upstream-discipline',
      }),
    ]);

    expect(drafts['practice-with-upstream-discipline']?.disciplineSituation).toBe('课堂纪律良好');
  });

  it('does not apply missing-log defaults to filled practice logs', () => {
    const drafts = buildJournalDrafts([
      buildItem({
        courseCategory: '2',
        journal: buildJournal({
          courseContent: '已填课程内容',
          homeworkAssignment: '已填作业',
          topicRecord: '良',
        }),
        key: 'practice-filled',
        status: 'FILLED',
      }),
    ]);

    expect(drafts['practice-filled']).toMatchObject({
      courseContent: '已填课程内容',
      disciplineSituation: '',
      homeworkAssignment: '已填作业',
      securityAndMaintain: '',
      topicRecord: '良',
    });
  });

  it('keeps integrated draft defaults independent from practice defaults', () => {
    const drafts = buildJournalDrafts([
      buildItem({
        completeAndSummary: '完成情况',
        courseCategory: '3',
        disciplineSituation: '已守纪',
        key: 'integrated-missing',
        problemAndSolve: '暂无问题',
        securityAndMaintain: '已检查',
      }),
    ]);

    expect(drafts['integrated-missing']).toMatchObject({
      completeAndSummary: '完成情况',
      disciplineSituation: '已守纪',
      problemAndSolve: '暂无问题',
      securityAndMaintain: '已检查',
      shift: DEFAULT_INTEGRATED_SHIFT,
      shiftName: DEFAULT_INTEGRATED_SHIFT_NAME,
    });
  });

  it('reuses unchanged draft references', () => {
    const previous = buildJournalDrafts([
      buildItem({
        courseCategory: '2',
        key: 'practice-missing',
      }),
    ]);
    const next = buildJournalDrafts([
      buildItem({
        courseCategory: '2',
        key: 'practice-missing',
      }),
    ]);

    const reused = reuseJournalDraftMapReferences(previous, next);

    expect(reused).toBe(previous);
    expect(reused['practice-missing']).toBe(previous['practice-missing']);
  });
});
