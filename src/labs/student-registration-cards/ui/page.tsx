// src/labs/student-registration-cards/ui/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Input, Progress, Space, Table, Tag } from 'antd';
import { Link, useBeforeUnload, useBlocker, useLoaderData } from 'react-router';

import {
  ClassWorkEntry,
  type ClassWorkScope,
  ClassWorkScopeBar,
  useClassWorkContext,
} from '@/entities/class-work-context';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

import { BATCH_STATUS } from '../application/card-batch';
import {
  type CardPreflight,
  type ClassOption,
  downloadCard,
  generateCard,
  type GeneratedCard,
  listClasses,
  listStudents,
  preflightCard,
  type StudentOption,
} from '../infrastructure/api';

import { useCardBatch } from './use-card-batch';

const LABELS: Record<string, string> = {
  READY: '齐备',
  MISSING: '缺失',
  UNAVAILABLE: '暂不可判定',
  NOT_REQUIRED: '不要求',
  UPSTREAM_ID_MISSING: '未关联上游学生',
  PRIVATE_PROFILE_SNAPSHOT_MISSING: '缺主档案快照',
  COURSE_RESULT_SNAPSHOT_MISSING: '缺成绩快照',
  COURSE_GRADE_CAPABILITY_UNAVAILABLE: '成绩能力不可用',
  COURSE_RESULT_TERM_CLASS_UNRESOLVED: '历史成绩班级归属存在歧义',
  COURSE_RESULT_GRADUATION_CLASS_FALLBACK_USED: '已使用毕业班兜底',
  COURSE_SCORE_TEMPLATE_CAPACITY_EXCEEDED: '课程超出模板容量',
  COURSE_SCORE_HIGHER_VALUES_SELECTED: '高分优先选取，展示保持原序',
  GRADUATION_FIELD_MISSING: '毕业信息尚未补齐',
  GRADUATION_UPSTREAM_VALUE_INVALID: '上游毕业字段无法识别，需上游更正',
  GRADUATION_LOCAL_VALUE_SHADOWED: '上游已覆盖本地毕业候选，可由治理人员清理',
  GRADUATION_EVALUATION_COMMENT_MISSING: '缺正式毕业评语',
  TERM_EVALUATION_COMMENT_MISSING: '缺学期评语',
  TERM_CONDUCT_GRADE_MISSING: '缺学期操行',
  TERM_MATERIAL_READINESS_UNAVAILABLE: '学期材料暂不可判定',
  FAMILY_MISSING: '缺家庭信息',
  RECORD_MISSING: '缺学籍异动',
  EDUCATION_CALCULATED_FALLBACK_USED: '教育经历使用入学信息兜底',
  SCORE_FALLBACK_TO_PASSING: '无效成绩按 60 展示',
  SCORE_BELOW_PASSING_RAISED_TO_60: '低于 60 的成绩按 60 展示',
};

export function StudentRegistrationCardsLabPage() {
  const { canBatchExport } = useLoaderData<{ canBatchExport: boolean }>();
  return (
    <ClassWorkEntry>
      {({ key, scope }) => (
        <StudentRegistrationCardsContent
          key={key}
          initialScope={scope}
          canBatchExport={canBatchExport}
        />
      )}
    </ClassWorkEntry>
  );
}

function StudentRegistrationCardsContent({
  initialScope,
  canBatchExport,
}: {
  initialScope: ClassWorkScope;
  canBatchExport: boolean;
}) {
  const workContext = useClassWorkContext();
  const { message, modal } = App.useApp();
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState<string | undefined>(initialScope.classId);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState<string>();
  const [inspectionVersion, setInspectionVersion] = useState(0);
  const [preflight, setPreflight] = useState<CardPreflight | null>(null);
  const [generated, setGenerated] = useState<GeneratedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [singleBusy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const batch = useCardBatch(
    classId,
    classes.find((item) => item.id === classId)?.className ?? '班级',
    (code) => LABELS[code] ?? code,
  );
  const busy = singleBusy || batch.running;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const exporting = isGenerating || batch.running;
  const blocker = useBlocker(exporting);
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!exporting) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [exporting],
    ),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const dialog = modal.confirm({
      title: exporting ? '正在生成，请稍后离开' : '生成请求已结束，是否继续离开？',
      content: exporting
        ? '请等待生成结果，切换后将无法在当前页面接收下载入口。'
        : '留在当前页可查看生成结果或错误，也可以继续之前的导航。',
      okText: '继续离开',
      cancelText: '留在当前页',
      okButtonProps: { disabled: exporting },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, exporting, modal]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void listClasses()
      .then((items) => {
        if (active) setClasses(items);
      })
      .catch(() => {
        if (active) setError('班级读取失败，请刷新重试。');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setStudents([]);
    setSelectedIds([]);
    setSearch('');
    setStudentId(undefined);
    setPreflight(null);
    setGenerated(null);
    setError(null);
    if (!classId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void listStudents(classId)
      .then((items) => {
        if (active) {
          setStudents(items);
          if (
            classId === initialScope.classId &&
            items.some((item) => item.studentId === initialScope.studentId)
          )
            setStudentId(initialScope.studentId);
        }
      })
      .catch(() => {
        if (active) setError('名单读取失败，请重新选择班级。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, initialScope.classId, initialScope.studentId]);
  useEffect(() => {
    let active = true;
    setPreflight(null);
    setGenerated(null);
    setError(null);
    if (!studentId) {
      setBusy(false);
      return;
    }
    setBusy(true);
    void preflightCard(studentId)
      .then((result) => {
        if (active) setPreflight(result);
      })
      .catch(() => {
        if (active) setError('材料检查失败，请点击“重新检查材料”重试。');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [inspectionVersion, studentId]);

  const governancePath = (
    target: 'profile' | 'conduct' | 'results' | 'comments',
    fallback: string,
    semesterId?: number,
    commentKind?: 'TERM' | 'GRADUATION',
  ) =>
    workContext?.buildGovernancePath(target, { classId, studentId, semesterId, commentKind }) ??
    fallback;

  async function generate() {
    if (
      !studentId ||
      busy ||
      !preflight?.canGenerate ||
      preflight.studentId !== studentId ||
      preflight.status === 'BLOCKED'
    )
      return;
    setIsGenerating(true);
    setBusy(true);
    setGenerated(null);
    setError(null);
    try {
      const result = await generateCard(studentId);
      setPreflight(result);
      setGenerated(result.downloadToken ? result : null);
      if (result.downloadToken) {
        setIsDownloading(true);
        try {
          await downloadCard(result);
          message.success('学籍卡已生成，已开始下载。');
        } catch {
          setError('文档已生成，自动下载失败。请点击“重新下载”重试。');
        }
      }
    } catch {
      setError('文档生成失败，请重试或重新检查材料。');
    } finally {
      setIsGenerating(false);
      setIsDownloading(false);
      setBusy(false);
    }
  }
  async function download() {
    if (!generated) return;
    setBusy(true);
    setIsDownloading(true);
    setError(null);
    try {
      await downloadCard(generated);
    } catch {
      message.error('下载失败：请检查会话、权限及有效期，必要时重新生成。');
    } finally {
      setIsDownloading(false);
      setBusy(false);
    }
  }

  const selectedStudent = students.find((student) => student.studentId === studentId);
  const query = search.trim().toLowerCase();
  const visibleStudents = students.filter((student) =>
    `${student.studentName} ${student.studentId}`.toLowerCase().includes(query),
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <DecoratedPageHeader
        title="学籍卡材料与出卡 · Lab"
        aside={
          <ClassWorkScopeBar
            classId={classId}
            options={classes}
            loading={loadingClasses}
            disabled={busy}
            onChange={setClassId}
          />
        }
      />
      <Alert
        type="info"
        showIcon
        title="班主任、辅导员可检查本班材料；管理员和教务员负责生成、下载。"
        description="点击学生自动检查材料，可单人生成并下载，也可勾选多人批量导出 ZIP。"
      />
      {batch.rows.length ? (
        <Card title="批量导出进度">
          <Space orientation="vertical" style={{ width: '100%' }}>
            <span>
              已处理{' '}
              {
                batch.rows.filter((row) => ['success', 'blocked', 'failed'].includes(row.status))
                  .length
              }
              /{batch.rows.length}，成功{' '}
              {batch.rows.filter((row) => row.status === 'success').length}，阻塞{' '}
              {batch.rows.filter((row) => row.status === 'blocked').length}，失败{' '}
              {batch.rows.filter((row) => row.status === 'failed').length}
            </span>
            <span>
              {batch.rows.find((row) => row.status === 'generating' || row.status === 'fetching')
                ?.studentName ?? (batch.running ? '正在打包' : '本次处理已结束')}
            </span>
            <Progress
              percent={Math.round(
                (batch.rows.filter((row) => ['success', 'blocked', 'failed'].includes(row.status))
                  .length /
                  batch.rows.length) *
                  100,
              )}
            />
            <Space wrap>
              {batch.running ? (
                <Button disabled={batch.stopping} onClick={batch.stop}>
                  {batch.stopping ? '正在停止' : '停止后续导出'}
                </Button>
              ) : (
                <>
                  {batch.rows.some((row) => row.status === 'pending') ? (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void batch.resume();
                      }}
                    >
                      继续导出
                    </Button>
                  ) : null}
                  {batch.rows.some((row) => row.status === 'failed' || row.status === 'blocked') ? (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void batch.retry();
                      }}
                    >
                      重试未完成项
                    </Button>
                  ) : null}
                  {batch.rows.some((row) => row.status === 'success') ? (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        void batch.download();
                      }}
                    >
                      下载 ZIP
                    </Button>
                  ) : null}
                </>
              )}
            </Space>
            {batch.error ? <Alert type="error" title={batch.error} /> : null}
            <Table
              size="small"
              rowKey="studentId"
              pagination={false}
              scroll={{ x: 600, y: 240 }}
              dataSource={batch.rows}
              columns={[
                { title: '学号', dataIndex: 'studentId' },
                { title: '姓名', dataIndex: 'studentName' },
                { title: '状态', render: (_, row) => BATCH_STATUS[row.status] },
                {
                  title: '材料提醒 / 失败原因',
                  render: (_, row) =>
                    [...row.warnings, ...row.reason.split('、')]
                      .filter(Boolean)
                      .map((code) => LABELS[code] ?? code)
                      .join('、') || '—',
                },
              ]}
            />
            <span>请保持页面打开；刷新或离开后，本次批量结果不会保留。</span>
          </Space>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-start gap-4">
        <section className="min-w-0 flex-1 basis-72 rounded-card bg-bg-container p-4 shadow-card">
          <div className="mb-4 flex flex-col gap-3">
            <span>班级学生 · {students.length} 人</span>
            {canBatchExport ? (
              <Space wrap>
                <Button
                  disabled={busy || loading || !students.length}
                  onClick={() => setSelectedIds(students.map((item) => item.studentId))}
                >
                  全选当前班级
                </Button>
                <Button disabled={busy || !selectedIds.length} onClick={() => setSelectedIds([])}>
                  清空选择
                </Button>
                <Button
                  type="primary"
                  disabled={busy || !selectedIds.length}
                  onClick={() => {
                    void batch.start(
                      students.filter((item) => selectedIds.includes(item.studentId)),
                    );
                  }}
                >
                  批量导出（{selectedIds.length} 人）
                </Button>
              </Space>
            ) : null}
            <Input.Search
              aria-label="搜索学籍卡学生"
              placeholder="搜索姓名或学号"
              disabled={busy || !classId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
          </div>
          <Table
            rowSelection={
              canBatchExport
                ? {
                    selectedRowKeys: selectedIds,
                    preserveSelectedRowKeys: true,
                    onChange: (keys) => setSelectedIds(keys),
                    getCheckboxProps: () => ({ disabled: busy }),
                  }
                : undefined
            }
            rowKey="studentId"
            loading={loading}
            pagination={false}
            size="small"
            scroll={{ y: 480 }}
            dataSource={visibleStudents}
            rowClassName={(student) =>
              student.studentId === studentId ? 'ant-table-row-selected' : ''
            }
            locale={{ emptyText: classId ? '暂无匹配学生' : '请先选择班级' }}
            columns={[
              {
                title: '学生',
                dataIndex: 'studentName',
                render: (name: string, student) => (
                  <Button
                    type="link"
                    disabled={busy}
                    aria-pressed={student.studentId === studentId}
                    onClick={() => setStudentId(student.studentId)}
                  >
                    {name}
                  </Button>
                ),
              },
              { title: '学号', dataIndex: 'studentId' },
              ...(canBatchExport
                ? [
                    {
                      title: '出卡',
                      key: 'batch',
                      render: (_: unknown, student: StudentOption) => {
                        const row = batch.rows.find((item) => item.studentId === student.studentId);
                        return row ? BATCH_STATUS[row.status] : '—';
                      },
                    },
                  ]
                : []),
            ]}
          />
        </section>
        <section className="min-w-0 flex-[2] basis-96">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>
              {selectedStudent
                ? `${selectedStudent.studentName} · ${selectedStudent.studentId}`
                : '学籍卡材料'}
            </span>
            <Space wrap>
              <Button
                disabled={!studentId || busy}
                onClick={() => setInspectionVersion((value) => value + 1)}
              >
                重新检查材料
              </Button>
              {generated ? (
                <Button
                  disabled={busy}
                  onClick={() => {
                    void download();
                  }}
                >
                  重新下载
                </Button>
              ) : null}
              {preflight?.canGenerate ? (
                <Button
                  type="primary"
                  disabled={
                    busy || preflight.studentId !== studentId || preflight.status === 'BLOCKED'
                  }
                  loading={isGenerating || isDownloading}
                  onClick={() => {
                    void generate();
                  }}
                >
                  {isDownloading
                    ? '正在下载'
                    : isGenerating
                      ? '正在生成'
                      : generated
                        ? '重新生成并下载'
                        : '生成并下载'}
                </Button>
              ) : null}
            </Space>
          </div>
          {error ? <Alert type="error" showIcon title={error} /> : null}
          {!preflight ? (
            <Empty description={busy ? '正在检查材料…' : '点击左侧学生，自动检查材料'} />
          ) : (
            <Card
              title={
                preflight.status === 'BLOCKED'
                  ? '材料阻塞'
                  : preflight.status === 'WARNING'
                    ? '可以出卡，但有材料提醒'
                    : '材料齐备'
              }
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  {preflight.issueCodes.map((code) => (
                    <Tag color="error" key={code}>
                      {LABELS[code] ?? code}
                    </Tag>
                  ))}
                  {preflight.warningCodes.map((code) => (
                    <Tag color="warning" key={code}>
                      {LABELS[code] ?? code}
                    </Tag>
                  ))}
                </Space>
                {preflight.scoreOverflows.map((item) => (
                  <Alert
                    key={item.sequence}
                    type="warning"
                    title={`第 ${item.sequence} 学期：${item.availableCount} 门可展示，选取 ${item.displayedCount} 门，省略 ${item.omittedCount} 门`}
                    description="按最终展示分数选取高分课程，入选后不按分数重排。"
                  />
                ))}
                <Table
                  rowKey="semesterId"
                  pagination={false}
                  size="small"
                  dataSource={preflight.termMaterialReadiness.terms}
                  columns={[
                    { title: '学期', dataIndex: 'label' },
                    {
                      title: '正式评语',
                      dataIndex: 'evaluationCommentStatus',
                      render: (value: string, term) =>
                        value === 'MISSING' ? (
                          <Link
                            to={governancePath(
                              'comments',
                              '/class-affairs/student-evaluation-comments',
                              term.semesterId,
                            )}
                          >
                            缺失 · 去补齐
                          </Link>
                        ) : (
                          (LABELS[value] ?? value)
                        ),
                    },
                    {
                      title: '确认操行',
                      dataIndex: 'conductGradeStatus',
                      render: (value: string, term) =>
                        value === 'MISSING' ? (
                          <Link
                            to={governancePath(
                              'conduct',
                              '/class-affairs/student-conduct-alignment',
                              term.semesterId,
                            )}
                          >
                            缺失 · 去补齐
                          </Link>
                        ) : (
                          (LABELS[value] ?? value)
                        ),
                    },
                  ]}
                />
                <Space wrap>
                  {preflight.warningCodes.includes('GRADUATION_EVALUATION_COMMENT_MISSING') ||
                  preflight.issueCodes.includes('GRADUATION_EVALUATION_COMMENT_MISSING') ? (
                    <Link
                      to={governancePath(
                        'comments',
                        '/class-affairs/student-evaluation-comments',
                        undefined,
                        'GRADUATION',
                      )}
                    >
                      补齐毕业鉴定
                    </Link>
                  ) : null}
                  <Link to={governancePath('profile', '/class-affairs/student-profile-filing')}>
                    建档 / 毕业信息（班主任、辅导员）
                  </Link>
                  <Link to={governancePath('conduct', '/class-affairs/student-conduct-alignment')}>
                    操行治理
                  </Link>
                  <Link
                    to={governancePath('comments', '/class-affairs/student-evaluation-comments')}
                  >
                    评语治理
                  </Link>
                  <Link to={governancePath('results', '/class-affairs/course-results-summary')}>
                    成绩治理
                  </Link>
                </Space>
                <span>处理后点击“返回学籍卡检查”，继续查看该学生的最新材料状态。</span>
                {!preflight.canGenerate ? <span>只读材料状态，请由教务员生成文档。</span> : null}
              </Space>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
