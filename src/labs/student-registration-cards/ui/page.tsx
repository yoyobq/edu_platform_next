// src/labs/student-registration-cards/ui/page.tsx
import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, Empty, Select, Space, Table, Tag } from 'antd';
import { Link, useBeforeUnload, useBlocker } from 'react-router';

import {
  ClassWorkEntry,
  type ClassWorkScope,
  ClassWorkScopeBar,
  useClassWorkContext,
} from '@/entities/class-work-context';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';

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
  return (
    <ClassWorkEntry>
      {({ key, scope }) => <StudentRegistrationCardsContent key={key} initialScope={scope} />}
    </ClassWorkEntry>
  );
}

function StudentRegistrationCardsContent({ initialScope }: { initialScope: ClassWorkScope }) {
  const workContext = useClassWorkContext();
  const { message, modal } = App.useApp();
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState<string | undefined>(initialScope.classId);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState<string>();
  const [preflight, setPreflight] = useState<CardPreflight | null>(null);
  const [generated, setGenerated] = useState<GeneratedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const blocker = useBlocker(isGenerating);
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!isGenerating) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [isGenerating],
    ),
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const dialog = modal.confirm({
      title: isGenerating ? '正在生成，请稍后离开' : '生成请求已结束，是否继续离开？',
      content: isGenerating
        ? '请等待生成结果，切换后将无法在当前页面接收下载入口。'
        : '留在当前页可查看生成结果或错误，也可以继续之前的导航。',
      okText: '继续离开',
      cancelText: '留在当前页',
      okButtonProps: { disabled: isGenerating },
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker, isGenerating, modal]);
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
    setStudentId(undefined);
    setPreflight(null);
    setGenerated(null);
    setError(null);
    if (!classId) return;
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
    setPreflight(null);
    setGenerated(null);
    setError(null);
  }, [studentId]);

  useEffect(() => {
    if (!initialScope.inspect || !studentId || studentId !== initialScope.studentId) return;
    let active = true;
    setBusy(true);
    void preflightCard(studentId)
      .then((result) => {
        if (active) setPreflight(result);
      })
      .catch(() => {
        if (active) setError('材料预检失败，请重新检查。');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [initialScope.inspect, initialScope.studentId, studentId]);

  const governancePath = (
    target: 'profile' | 'conduct' | 'results' | 'comments',
    fallback: string,
    semesterId?: number,
    commentKind?: 'TERM' | 'GRADUATION',
  ) =>
    workContext?.buildGovernancePath(target, { classId, studentId, semesterId, commentKind }) ??
    fallback;

  async function inspect() {
    if (!studentId) return;
    setBusy(true);
    setError(null);
    setGenerated(null);
    setPreflight(null);
    try {
      setPreflight(await preflightCard(studentId));
    } catch {
      setError('材料预检失败，未生成文档。请检查权限或稍后重试。');
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!studentId || isGenerating) return;
    setIsGenerating(true);
    setBusy(true);
    setGenerated(null);
    setError(null);
    try {
      const result = await generateCard(studentId);
      setPreflight(result);
      setGenerated(result.downloadToken ? result : null);
    } catch {
      setError('文档生成失败，请重新预检后重试。');
    } finally {
      setIsGenerating(false);
      setBusy(false);
    }
  }
  async function download() {
    if (!generated) return;
    setBusy(true);
    try {
      await downloadCard(generated);
    } catch {
      message.error('下载失败：请检查会话、权限及有效期，必要时重新生成。');
    } finally {
      setBusy(false);
    }
  }

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
        description="此处只做材料验收和单卡出卡，不重复提供建档、操行或评语编辑。当前逐人预检，不将基础建档进度当作最终材料齐备率。"
      />
      <section className="rounded-card bg-bg-container p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Select
            showSearch
            optionFilterProp="label"
            aria-label="学籍卡学生"
            placeholder="选择学生"
            style={{ width: 260 }}
            loading={loading}
            disabled={busy || !classId}
            value={studentId}
            onChange={setStudentId}
            options={students.map((item) => ({
              value: item.studentId,
              label: `${item.studentName} · ${item.studentId}`,
            }))}
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              disabled={!studentId || busy}
              onClick={() => {
                void inspect();
              }}
            >
              检查最终材料
            </Button>
          </div>
        </div>
      </section>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {!preflight ? (
        <Empty description="请选择学生并检查最终材料" />
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
              <Link to={governancePath('comments', '/class-affairs/student-evaluation-comments')}>
                评语治理
              </Link>
              <Link to={governancePath('results', '/class-affairs/course-results-summary')}>
                成绩治理
              </Link>
            </Space>
            <span>处理后点击“返回学籍卡检查”，继续查看该学生的最新材料状态。</span>
            {preflight.canGenerate ? (
              <Button
                type="primary"
                disabled={busy || preflight.status === 'BLOCKED'}
                loading={busy}
                onClick={() => {
                  void generate();
                }}
              >
                生成本学生 DOCX
              </Button>
            ) : (
              <span>只读材料状态，请由教务员生成文档。</span>
            )}
            {generated ? (
              <Button
                disabled={busy}
                onClick={() => {
                  void download();
                }}
              >
                下载学籍卡 DOCX
              </Button>
            ) : null}
          </Space>
        </Card>
      )}
    </div>
  );
}
