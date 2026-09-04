// src/features/academic-split-joint-teaching/ui/split-joint-teaching-confirmation-page-content.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReconciliationOutlined } from '@ant-design/icons';
import { Alert, App as AntApp, Card, Empty, Skeleton, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import {
  AcademicSemesterSelect,
  pickAcademicSemesterId,
  sortAcademicSemestersForDisplay,
} from '@/entities/academic-semester';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import {
  type AcademicSplitJointTeachingCandidate,
  requestAcademicSplitJointTeachingCandidates,
  requestAcademicSplitJointTeachingSemesters,
  setAcademicSplitJointTeachingConfirmation,
} from '../infrastructure/academic-split-joint-teaching-api';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function formatWeeks(weekIndexes: readonly number[]) {
  if (weekIndexes.length === 0) {
    return '无';
  }

  const ranges: string[] = [];
  let start = weekIndexes[0];
  let end = start;

  for (const weekIndex of weekIndexes.slice(1)) {
    if (weekIndex === end + 1) {
      end = weekIndex;
      continue;
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
    start = weekIndex;
    end = weekIndex;
  }
  ranges.push(start === end ? String(start) : `${start}-${end}`);

  return ranges.join('、');
}

function renderCandidateStatus(candidate: AcademicSplitJointTeachingCandidate) {
  if (candidate.confirmed && !candidate.isActiveCandidate) {
    return <Tag color="warning">确认已失效</Tag>;
  }
  if (candidate.confirmed) {
    return <Tag color="success">按实际授课</Tag>;
  }
  if (candidate.invalidReason) {
    return <Tag color="error">存在冲突</Tag>;
  }
  return <Tag>校园网口径</Tag>;
}

export function SplitJointTeachingConfirmationPageContent() {
  const { message, modal } = AntApp.useApp();
  const [semesters, setSemesters] = useState<
    Awaited<ReturnType<typeof requestAcademicSplitJointTeachingSemesters>>
  >([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<AcademicSplitJointTeachingCandidate[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCandidates = useCallback(async (semesterId: number) => {
    setLoadingCandidates(true);
    setError(null);
    try {
      setCandidates(await requestAcademicSplitJointTeachingCandidates(semesterId));
    } catch (loadError) {
      setCandidates([]);
      setError(loadError instanceof Error ? loadError.message : '暂时无法加载拆分合班候选。');
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    requestAcademicSplitJointTeachingSemesters()
      .then((records) => {
        if (cancelled) {
          return;
        }
        const sorted = sortAcademicSemestersForDisplay(records);
        setSemesters(sorted);
        setSelectedSemesterId((current) => pickAcademicSemesterId(sorted, current));
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '暂时无法加载学期列表。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSemesters(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSemesterId !== null) {
      void loadCandidates(selectedSemesterId);
    }
  }, [loadCandidates, selectedSemesterId]);

  const handleConfirmationChange = useCallback(
    (candidate: AcademicSplitJointTeachingCandidate, confirmed: boolean) => {
      modal.confirm({
        cancelText: '取消',
        content: confirmed
          ? '确认后，教师课表、工作量预报、扣课统计和外聘兼课金将按每周实际参与班级重新计算；教学日志和授课计划仍保留校园网原始班级口径。'
          : '取消后，上述课表与工作量统计将恢复校园网原始口径。',
        okText: confirmed ? '确认采用' : '确认取消',
        title: confirmed ? '采用实际授课语义？' : '恢复校园网口径？',
        onOk: async () => {
          const key = `${candidate.staffId}:${candidate.sstsCourseId}`;
          setPendingKey(key);
          try {
            await setAcademicSplitJointTeachingConfirmation({
              confirmed,
              semesterId: candidate.semesterId,
              staffId: candidate.staffId,
              sstsCourseId: candidate.sstsCourseId,
            });
            await loadCandidates(candidate.semesterId);
            void message.success(confirmed ? '已采用实际授课语义' : '已恢复校园网口径');
          } catch (updateError) {
            void message.error(
              updateError instanceof Error ? updateError.message : '更新确认状态失败。',
            );
            throw updateError;
          } finally {
            setPendingKey(null);
          }
        },
      });
    },
    [loadCandidates, message, modal],
  );

  const columns = useMemo<ColumnsType<AcademicSplitJointTeachingCandidate>>(
    () => [
      {
        key: 'teacher',
        render: (_, candidate) => (
          <span>
            <strong>{candidate.staffName}</strong>
            <br />
            <span>{candidate.staffId}</span>
          </span>
        ),
        title: '教师',
        width: 112,
      },
      {
        key: 'course',
        render: (_, candidate) => (
          <span>
            <strong>{candidate.courseName || '未命名课程'}</strong>
            <br />
            <span>{candidate.sstsCourseId}</span>
          </span>
        ),
        title: '课程',
        width: 220,
      },
      {
        key: 'cohorts',
        render: (_, candidate) => (
          <div className="flex flex-col gap-2">
            {candidate.cohorts.map((cohort) => (
              <div key={`${cohort.dayOfWeek}-${cohort.periodStart}-${cohort.periodEnd}`}>
                <strong>
                  {WEEKDAY_LABELS[cohort.dayOfWeek - 1] ?? `星期${cohort.dayOfWeek}`} 第
                  {cohort.periodStart}-{cohort.periodEnd}节
                </strong>
                <div>{cohort.teachingClassNames.join('、')}</div>
                <div>
                  合班第 {formatWeeks(cohort.sharedWeekIndexes)} 周；单班第{' '}
                  {formatWeeks(cohort.exceptionalWeekIndexes)} 周
                </div>
              </div>
            ))}
          </div>
        ),
        title: '识别依据',
        width: 360,
      },
      {
        key: 'budget',
        render: (_, candidate) => (
          <span>
            {candidate.originalBudgetHours} → <strong>{candidate.semanticBudgetHours}</strong>
          </span>
        ),
        title: '预算课时',
        width: 128,
      },
      {
        key: 'effective',
        render: (_, candidate) => (
          <span>
            {candidate.originalEffectiveHours} → <strong>{candidate.semanticEffectiveHours}</strong>
          </span>
        ),
        title: '校历后课时',
        width: 136,
      },
      {
        key: 'status',
        render: (_, candidate) => renderCandidateStatus(candidate),
        title: '当前口径',
        width: 112,
      },
      {
        align: 'center',
        fixed: 'right',
        key: 'confirmed',
        render: (_, candidate) => {
          const key = `${candidate.staffId}:${candidate.sstsCourseId}`;
          return (
            <Switch
              checked={candidate.confirmed}
              disabled={
                (!candidate.confirmed &&
                  (!candidate.isActiveCandidate || Boolean(candidate.invalidReason))) ||
                (pendingKey !== null && pendingKey !== key)
              }
              loading={pendingKey === key}
              onChange={(checked) => handleConfirmationChange(candidate, checked)}
            />
          );
        },
        title: '确认',
        width: 88,
      },
    ],
    [handleConfirmationChange, pendingKey],
  );

  return (
    <div className="flex flex-col gap-6">
      <DecoratedPageHeader
        description="识别校园网拆分记录中的真实合班授课，并由教务人工确认计算口径。"
        icon={<ReconciliationOutlined />}
        title="拆分合班确认"
      />

      <Alert
        description="系统只把同一学期、同一教师、同一校园网课程，且在完全相同节次存在重叠周的多班记录列为候选。确认记录只保存选择，班级组合、周次、系数与校历影响均实时推导。"
        showIcon
        title="确认不会改写校园网原始排课"
        type="info"
      />

      <Card title="确认范围">
        {loadingSemesters ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : semesters.length === 0 ? (
          <Empty description="当前没有可用学期" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <AcademicSemesterSelect
            records={semesters}
            value={selectedSemesterId ?? undefined}
            onChange={setSelectedSemesterId}
          />
        )}
      </Card>

      {error ? <Alert showIcon title={error} type="error" /> : null}

      <Card title="候选课程">
        {loadingCandidates ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<AcademicSplitJointTeachingCandidate>
            columns={columns}
            dataSource={candidates}
            locale={{ emptyText: '当前学期没有识别到拆分合班候选' }}
            pagination={false}
            rowKey={(candidate) =>
              `${candidate.semesterId}:${candidate.staffId}:${candidate.sstsCourseId}`
            }
            scroll={{ x: 1160 }}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
}
