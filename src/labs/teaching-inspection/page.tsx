// src/labs/teaching-inspection/page.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { useBeforeUnload, useBlocker, useLoaderData, useSearchParams } from 'react-router';

import {
  AcademicSemesterSelect,
  type AcademicSemesterSelectRecord,
} from '@/entities/academic-semester';
import {
  resolveUpstreamErrorMessage,
  type UpstreamAccountIdentity,
  UpstreamLoginModal,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { DecoratedPageHeader } from '@/shared/ui/decorated-page-header';
import { useWidthBand } from '@/shared/ui/responsive-layout';

import * as api from './infrastructure/api';
import { readLocation, writeLocation } from './infrastructure/location';
import { InspectionDetail } from './ui/inspection-detail';
import { LessonWorkbench } from './ui/lesson-workbench';
import { TimePlanWorkbench } from './ui/time-plan-workbench';
import { blockerText, kinds, type Resource, statusText } from './model';
import { syncText, useInspectionWorkspace } from './use-workspace';
type LoaderData = {
  currentAccount: UpstreamAccountIdentity;
  lockedUpstreamLoginUserId: string | null;
};
export function TeachingInspectionPage() {
  const data = useLoaderData() as LoaderData;
  return <InspectionPage key={data.currentAccount.accountId} data={data} />;
}
function InspectionPage({ data }: { data: LoaderData }) {
  const [params, setParams] = useSearchParams();
  const [promptedSemesters, setPromptedSemesters] = useState<Record<number, boolean>>({});
  const [semesters, setSemesters] = useState<AcademicSemesterSelectRecord[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const location = useMemo(() => readLocation(params), [params]);
  useEffect(() => {
    let current = true;
    void api
      .loadSemesters()
      .then((records) => {
        if (!current) return;
        setSemesters(records);
        setError('');
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : '学期读取失败');
      });
    return () => {
      current = false;
    };
  }, [attempt]);
  useEffect(() => {
    const value = readLocation(params);
    if (!value.semesterId)
      value.semesterId = (semesters.find((record) => record.isCurrent) ?? semesters[0])?.id;
    const canonical = writeLocation(value);
    if (canonical.toString() !== params.toString()) setParams(canonical, { replace: true });
  }, [params, setParams, semesters]);
  const session = useUpstreamLoginModalController({
    account: data.currentAccount,
    lockedUserId: data.lockedUpstreamLoginUserId,
    keepAlive: false,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '校园网连接失败，请重试。'),
  });
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 p-4">
      <DecoratedPageHeader
        title="教学检查"
        badge={<Tag>Lab</Tag>}
        description="安排检查日期，核对材料，再逐条提交。"
        aside={
          <Button onClick={() => session.openLoginModal()}>
            {data.lockedUpstreamLoginUserId
              ? session.session
                ? '管理本人校园网连接'
                : '连接本人校园网'
              : session.session
                ? '切换校园网教职工'
                : '连接校园网教职工'}
          </Button>
        }
      />
      <span>
        操作账号：{data.currentAccount.displayName} · 检查人：
        {session.session?.upstreamLoginId ?? '尚未连接校园网'}
      </span>
      {error && (
        <Alert
          type="error"
          title={error}
          action={<Button onClick={() => setAttempt((value) => value + 1)}>重试学期读取</Button>}
        />
      )}
      <Tabs
        activeKey={location.section === 'dates' ? 'dates' : location.type.key}
        items={[
          { key: 'dates', label: '检查时间' },
          ...kinds.map((item) => ({ key: item.key, label: item.label })),
        ]}
        onChange={(key) =>
          setParams(
            writeLocation({
              ...location,
              section: key === 'dates' ? 'dates' : 'checks',
              type: kinds.find((item) => item.key === key) ?? location.type,
              resourceKey: undefined,
              page: 1,
            }),
          )
        }
      />
      <AcademicSemesterSelect
        aria-label="检查学期"
        records={semesters}
        value={location.semesterId}
        placeholder="选择学期"
        style={{ width: '100%', maxWidth: 340 }}
        onChange={(semesterId) =>
          setParams(writeLocation({ ...location, semesterId, teacherId: undefined, page: 1 }))
        }
      />
      {location.semesterId ? (
        location.section === 'dates' ? (
          <TimePlanWorkbench
            key={`${data.currentAccount.accountId}:${location.semesterId}`}
            location={location}
            splitPromptDismissed={!!promptedSemesters[location.semesterId]}
            onDismissSplitPrompt={() =>
              setPromptedSemesters((current) => ({ ...current, [location.semesterId!]: true }))
            }
            onLocation={(value) => setParams(writeLocation(value))}
          />
        ) : location.type.kind === 'LESSON_PLAN' ? (
          <LessonWorkbench
            key={JSON.stringify([
              data.currentAccount.accountId,
              location.semesterId,
              location.departmentId === undefined ? ['default'] : location.departmentId,
            ])}
            location={location}
            onLocation={(value) => setParams(writeLocation(value))}
            account={data.currentAccount}
            session={session}
          />
        ) : (
          <Workbench
            key={`${data.currentAccount.accountId}:${session.session?.upstreamLoginId ?? 'unconnected'}:${params.toString()}`}
            data={data}
            location={location}
            session={session}
            onLocation={(value) => setParams(writeLocation(value))}
          />
        )
      ) : (
        !error && <Empty description="暂无可用学期" />
      )}
      <UpstreamLoginModal {...session.modalProps} />
    </div>
  );
}
function Workbench({
  data,
  location,
  session,
  onLocation,
}: {
  data: LoaderData;
  location: ReturnType<typeof readLocation>;
  session: ReturnType<typeof useUpstreamLoginModalController<never>>;
  onLocation: (value: ReturnType<typeof readLocation>) => void;
}) {
  const { modal } = App.useApp();
  const { workspace, error, loading, refresh, syncStates, markSynced } = useInspectionWorkspace(
    location,
    session,
  );
  const [detailKey, setDetailKey] = useState<string | null>(location.resourceKey ?? null);
  const [materialDirty, setMaterialDirty] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { band } = useWidthBand(container, [{ max: 767, value: 'compact' }], 'wide');
  const compact = band === 'compact';
  const dirty = materialDirty;
  const blocker = useBlocker(dirty);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty],
    ),
  );
  function closeDetail() {
    const close = () => {
      setDetailKey(null);
      setMaterialDirty(false);
    };
    if (materialDirty)
      modal.confirm({
        title: '离开材料核对？',
        content: '未保存评分会丢弃。准备请求的恢复入口会保留，之后可恢复原材料。',
        onOk: close,
      });
    else close();
  }
  const detail = workspace?.resources.find((resource) => resource.resourceKey === detailKey);
  return (
    <div ref={container} className="flex min-w-0 flex-col gap-4">
      <Space wrap>
        {workspace?.departments && (
          <Select
            aria-label="检查所属系"
            style={{ width: 200 }}
            showSearch
            optionFilterProp="label"
            disabled={!workspace.canSelectDepartment}
            value={workspace.departmentId ?? 'all'}
            options={[
              ...(workspace.canSelectDepartment ? [{ value: 'all', label: '全校（全部系）' }] : []),
              ...workspace.departments.map((department) => ({
                value: department.id,
                label: department.name,
              })),
            ]}
            onChange={(value) =>
              onLocation({
                ...location,
                departmentId: value === 'all' ? null : value,
                teacherId: undefined,
                resourceKey: undefined,
                page: 1,
              })
            }
          />
        )}
        <Select
          aria-label="筛选教师"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="全部教师"
          style={{ width: 200 }}
          value={location.teacherId}
          options={workspace?.teachers.map((teacher) => ({
            value: teacher.staffId,
            label: teacher.name,
          }))}
          onChange={(teacherId) => onLocation({ ...location, teacherId, page: 1 })}
        />
        <Input.Search
          aria-label="搜索课程"
          placeholder="搜索课程"
          defaultValue={location.keyword}
          allowClear
          onSearch={(keyword) =>
            onLocation({ ...location, keyword: keyword.trim() || undefined, page: 1 })
          }
          style={{ width: compact ? 240 : 280 }}
        />
        <Button disabled={loading} onClick={() => void refresh(true).catch(() => undefined)}>
          重新读取工作区
        </Button>
      </Space>
      {error && <Alert type="error" showIcon title={error} />}
      {!session.session && (
        <Alert
          type="info"
          showIcon
          title="尚未连接校园网，当前显示本地记录；连接后自动同步上游检查状态。"
        />
      )}
      <Card
        title={`${location.type.label} · 课程清单`}
        styles={{ body: { padding: compact ? 0 : 16 } }}
      >
        <Table<Resource>
          rowKey="resourceKey"
          size="middle"
          loading={loading}
          dataSource={workspace?.resources ?? []}
          pagination={{
            current: location.page,
            pageSize: 20,
            total: workspace?.total ?? 0,
            showSizeChanger: false,
            simple: compact,
            onChange: (page) => onLocation({ ...location, page }),
          }}
          columns={[
            {
              title: '课程 / 教师',
              key: 'course',
              render: (_, resource) => (
                <div className="flex flex-col gap-1">
                  <strong>{resource.courseName}</strong>
                  <span>{resource.teacherNames.join('、')}</span>
                  {compact && (
                    <>
                      <span>
                        {resource.schedule.version
                          ? resource.schedule.dates.map((date) => (
                              <span key={date} className="block whitespace-nowrap">
                                {date}
                              </span>
                            ))
                          : '日期尚未保存'}
                      </span>
                      <span>
                        {syncText(syncStates[resource.resourceKey] ?? 'pending')} ·{' '}
                        {statusText(resource.status)} · 覆盖 {resource.status.effectiveCoveredCount}
                        /3 轮
                      </span>
                    </>
                  )}
                  {compact && (
                    <Button
                      type="link"
                      disabled={loading}
                      onClick={() => setDetailKey(resource.resourceKey)}
                    >
                      查看检查
                    </Button>
                  )}
                  {resource.blockers.length > 0 && (
                    <span>{resource.blockers.map(blockerText).join('；')}</span>
                  )}
                </div>
              ),
            },
            ...(!compact
              ? [
                  {
                    title: '三轮检查时间',
                    key: 'dates',
                    render: (_: unknown, resource: Resource) => (
                      <div>
                        {[0, 1, 2].map((index) => {
                          const actual =
                            location.type.kind === 'PROGRESS'
                              ? resource.schedule.records[index]?.checkDate
                              : resource.schedule.records.find(
                                  (record) =>
                                    record.recordKey === resource.schedule.rounds[index]?.recordKey,
                                )?.checkDate;
                          return (
                            <div key={index} className="mb-2">
                              <strong>第 {index + 1} 轮</strong>
                              <div>建议 · {resource.suggestedDates[index] ?? '暂无'}</div>
                              <div>
                                已确认 ·{' '}
                                {resource.schedule.version
                                  ? (resource.schedule.dates[index] ?? '未安排')
                                  : '待确认'}
                              </div>
                              <div>
                                上游实际 ·{' '}
                                {location.type.kind === 'ASSIGNMENT'
                                  ? '不可核实'
                                  : (actual ?? '暂无关联记录')}
                              </div>
                            </div>
                          );
                        })}
                        {location.type.kind === 'ASSIGNMENT' && (
                          <small>上游实际日期不可核实；安排和提交日期仅为本地记录</small>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: '覆盖概况',
                    key: 'status',
                    render: (_: unknown, resource: Resource) => (
                      <div>
                        <span>{syncText(syncStates[resource.resourceKey] ?? 'pending')}</span>
                        <div>{statusText(resource.status)}</div>
                        {resource.status.observedAt && (
                          <small>
                            最近同步：{new Date(resource.status.observedAt).toLocaleString()}
                          </small>
                        )}
                        <p>有效覆盖 {resource.status.effectiveCoveredCount} / 3 轮</p>
                      </div>
                    ),
                  },
                ]
              : []),
            ...(!compact
              ? [
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    render: (_: unknown, resource: Resource) => (
                      <Button
                        type="link"
                        disabled={loading}
                        onClick={() => setDetailKey(resource.resourceKey)}
                      >
                        查看检查
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Drawer
        title={`${location.type.label} · 查看检查`}
        open={Boolean(detailKey)}
        size={compact ? '100%' : 640}
        onClose={closeDetail}
        destroyOnHidden
      >
        {detail ? (
          <InspectionDetail
            key={detail.resourceKey}
            resource={detail}
            syncing={loading}
            syncState={syncStates[detail.resourceKey] ?? 'pending'}
            onSynced={(status) => markSynced(detail.resourceKey, status)}
            target={{
              semesterId: location.semesterId!,
              kind: location.type.kind,
              resourceKey: detail.resourceKey,
            }}
            account={data.currentAccount}
            session={session}
            onDirty={setMaterialDirty}
            onRefresh={refresh}
            onArrange={() =>
              onLocation({ ...location, section: 'dates', resourceKey: detail.resourceKey })
            }
          />
        ) : (
          <Empty description="课程已不在当前列表，请刷新后重新选择" />
        )}
      </Drawer>
      <Modal
        open={blocker.state === 'blocked'}
        title="离开当前检查？"
        onCancel={() => blocker.state === 'blocked' && blocker.reset()}
        onOk={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
        okText="放弃编辑并离开"
        cancelText="继续核对"
      >
        <p>未保存的日期和评分编辑会丢弃。已发送操作的恢复记录会保留。</p>
      </Modal>
    </div>
  );
}
