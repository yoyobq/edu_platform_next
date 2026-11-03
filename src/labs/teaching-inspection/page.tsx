// src/labs/teaching-inspection/page.tsx
import { useEffect, useMemo, useState } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Select, Tabs, theme } from 'antd';
import { useLoaderData, useSearchParams } from 'react-router';

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

import * as api from './infrastructure/api';
import { readLocation, writeLocation } from './infrastructure/location';
import { LessonWorkbench } from './ui/lesson-workbench';
import { TimePlanWorkbench } from './ui/time-plan-workbench';
import { kinds } from './model';
type LoaderData = {
  currentAccount: UpstreamAccountIdentity;
  lockedUpstreamLoginUserId: string | null;
};
export function TeachingInspectionPage() {
  const data = useLoaderData() as LoaderData;
  return <InspectionPage key={data.currentAccount.accountId} data={data} />;
}
function InspectionPage({ data }: { data: LoaderData }) {
  const { token } = theme.useToken();
  const [params, setParams] = useSearchParams();
  const [promptedSemesters, setPromptedSemesters] = useState<Record<number, boolean>>({});
  const [semesters, setSemesters] = useState<AcademicSemesterSelectRecord[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [scope, setScope] = useState<api.InspectionScope | null>(null);
  const [pageBusy, setPageBusy] = useState(false);
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
  useEffect(() => {
    let active = true;
    setScope(null);
    if (location.semesterId)
      void api
        .loadScope(location.semesterId, location.departmentId)
        .then((value) => {
          if (active) setScope(value);
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : '工作范围读取失败');
        });
    return () => {
      active = false;
    };
  }, [location.semesterId, location.departmentId, attempt]);
  const session = useUpstreamLoginModalController({
    account: data.currentAccount,
    lockedUserId: data.lockedUpstreamLoginUserId,
    keepAlive: false,
    resolveLoginErrorMessage: (error) =>
      resolveUpstreamErrorMessage(error, '校园网连接失败，请重试。'),
  });
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-4 p-4">
      <DecoratedPageHeader
        title="教学检查"
        description="选择检查范围，准备并核对材料，批量完成检查。"
        aside={
          <Button
            disabled={pageBusy}
            type={session.session ? 'default' : 'primary'}
            onClick={() => session.openLoginModal()}
          >
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
      <Card title="工作范围" size="small">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <label>学期</label>{' '}
            <AcademicSemesterSelect
              disabled={pageBusy}
              aria-label="检查学期"
              records={semesters}
              value={location.semesterId}
              placeholder="选择学期"
              style={{ width: '100%', maxWidth: 340 }}
              onChange={(semesterId) =>
                setParams(writeLocation({ ...location, semesterId, teacherId: undefined, page: 1 }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <label>系部</label>
            <Select
              aria-label="检查所属系"
              style={{ width: 220 }}
              disabled={pageBusy || !scope?.canSelectDepartment}
              value={
                scope?.departmentId ??
                (location.departmentId === null ? 'all' : location.departmentId)
              }
              placeholder="正在读取工作范围"
              options={[
                ...(scope?.canSelectDepartment ? [{ value: 'all', label: '全校（全部系）' }] : []),
                ...(scope?.departments ?? []).map((row) => ({ value: row.id, label: row.name })),
              ]}
              onChange={(value) =>
                setParams(
                  writeLocation({
                    ...location,
                    departmentId: value === 'all' ? null : value,
                    teacherId: undefined,
                    resourceKey: undefined,
                    page: 1,
                  }),
                )
              }
            />
          </div>
        </div>
      </Card>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button
            icon={<SettingOutlined aria-hidden />}
            aria-label="检查时间"
            type={location.section === 'dates' ? 'primary' : 'default'}
            aria-pressed={location.section === 'dates'}
            disabled={pageBusy}
            onClick={() =>
              setParams(
                writeLocation({ ...location, section: 'dates', resourceKey: undefined, page: 1 }),
              )
            }
          >
            检查时间
          </Button>
          <div
            className="ml-auto min-w-0 max-w-full px-4"
            style={{
              background: location.section === 'checks' ? token.colorPrimaryBg : undefined,
              borderRadius: `${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0`,
            }}
          >
            <Tabs
              aria-label="检查类型"
              activeKey={location.section === 'checks' ? location.type.key : ''}
              styles={{ header: { margin: 0 } }}
              items={kinds.map((item) => ({
                key: item.key,
                label: item.label,
                disabled: pageBusy,
              }))}
              onChange={(key) =>
                setParams(
                  writeLocation({
                    ...location,
                    section: 'checks',
                    type: kinds.find((item) => item.key === key) ?? location.type,
                    resourceKey: undefined,
                    page: 1,
                  }),
                )
              }
            />
          </div>
        </div>
        <div className={location.section === 'checks' ? 'min-w-0' : 'min-w-0 pt-4'}>
          {location.semesterId ? (
            location.section === 'dates' ? (
              <TimePlanWorkbench
                key={`${data.currentAccount.accountId}:${location.semesterId}`}
                location={location}
                departmentId={scope?.departmentId}
                onBusyChange={setPageBusy}
                splitPromptDismissed={!!promptedSemesters[location.semesterId]}
                onDismissSplitPrompt={() =>
                  setPromptedSemesters((current) => ({ ...current, [location.semesterId!]: true }))
                }
                onLocation={(value) => setParams(writeLocation(value))}
              />
            ) : (
              <LessonWorkbench
                kind={location.type.kind}
                key={JSON.stringify([
                  data.currentAccount.accountId,
                  location.type.kind,
                  location.semesterId,
                  location.departmentId === undefined ? ['default'] : location.departmentId,
                ])}
                location={location}
                onLocation={(value) => setParams(writeLocation(value))}
                account={data.currentAccount}
                session={session}
                onBusyChange={setPageBusy}
              />
            )
          ) : (
            !error && <Empty description="暂无可用学期" />
          )}
        </div>
      </div>
      <UpstreamLoginModal {...session.modalProps} />
    </div>
  );
}
