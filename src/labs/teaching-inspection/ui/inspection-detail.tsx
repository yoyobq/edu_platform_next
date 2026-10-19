// src/labs/teaching-inspection/ui/inspection-detail.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Divider, Radio, Space, Tag } from 'antd';

import type {
  UpstreamAccountIdentity,
  useUpstreamLoginModalController,
} from '@/entities/upstream-session';

import { hasGraphQLCategory } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import {
  closureDetails,
  putRecovery,
  readRecovery,
  type RecoveryEntry,
  removeRecovery,
} from '../infrastructure/recovery';
import {
  basisText,
  blockerText,
  isSaved,
  type Operation,
  operationText,
  type Prepared,
  type Resource,
  statusText,
  type Target,
} from '../model';

import { MaterialView } from './material';
type SessionController = ReturnType<typeof useUpstreamLoginModalController<never>>;
function initialRecovery(accountId: number, target: Target) {
  try {
    return {
      entries: readRecovery(accountId).filter(
        (entry) =>
          entry.kind === target.kind &&
          entry.semesterId === target.semesterId &&
          entry.resourceKey === target.resourceKey,
      ),
      error: '',
    };
  } catch {
    return { entries: [], error: '无法读取恢复记录。为避免重复提交，暂不能创建新操作。' };
  }
}
export function InspectionDetail({
  resource,
  target,
  account,
  session,
  onRefresh,
  onDirty,
  onArrange,
}: {
  resource: Resource;
  target: Target;
  account: UpstreamAccountIdentity;
  session: SessionController;
  onRefresh: () => Promise<Resource[]>;
  onDirty: (dirty: boolean) => void;
  onArrange: () => void;
}) {
  const { modal } = App.useApp();
  const [initial] = useState(() => initialRecovery(account.accountId, target));
  const [entries, setEntries] = useState(initial.entries);
  const [operations, setOperations] = useState<Record<string, Operation>>({});
  const [storageError, setStorageError] = useState(initial.error);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Operation | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [prepareEntry, setPrepareEntry] = useState<RecoveryEntry | null>(null);
  const [scores, setScores] = useState<(number | null)[]>([]);
  const [checked, setChecked] = useState(false);
  const [expiredId, setExpiredId] = useState<string | null>(null);
  const activePreview = prepared?.preview;
  useEffect(() => {
    if (!activePreview) return;
    const timer = window.setTimeout(
      () => setExpiredId(activePreview.id),
      Math.max(0, Date.parse(activePreview.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [activePreview]);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [round, setRound] = useState(
    () =>
      resource.status.rounds.find((item) => item.canPrepare || item.retryWarningOperationId)
        ?.round ?? 1,
  );
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    for (const entry of initial.entries) {
      void api
        .operation({
          semesterId: entry.semesterId,
          kind: entry.kind,
          resourceKey: entry.resourceKey,
          clientRequestId: entry.clientRequestId,
        })
        .then((op) => {
          if (!cancelled) setOperations((old) => ({ ...old, [entry.clientRequestId]: op }));
        })
        .catch(() => {
          if (!cancelled) setError('部分操作暂未查到结果，请继续查询；查不到不代表没有提交。');
        });
    }
    return () => {
      cancelled = true;
    };
  }, [initial.entries]);
  function syncEntries() {
    setEntries(
      readRecovery(account.accountId).filter(
        (entry) =>
          entry.kind === target.kind &&
          entry.resourceKey === target.resourceKey &&
          entry.semesterId === target.semesterId,
      ),
    );
  }
  function track(entry: RecoveryEntry) {
    try {
      putRecovery(entry);
      syncEntries();
    } catch {
      setStorageError('无法保存恢复标识，已停止新操作。请保留本标签页。');
      throw new Error('恢复标识保存失败');
    }
  }
  function forget(ids: string[]) {
    try {
      removeRecovery(account.accountId, ids);
      syncEntries();
    } catch {
      setStorageError('恢复记录清理失败，请保留本标签页；已知成功结果仍有效。');
    }
  }
  async function run(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (alive.current) {
        setError(cause instanceof Error ? cause.message : '请求未完成，请先查询操作结果。');
        if (hasGraphQLCategory(cause, 'UNAUTHENTICATED') && session.session)
          session.openLoginModalForExpiredSession({
            session: session.session,
            loginError: '会话已失效。重新连接后，请先查询操作结果；不会自动重新提交。',
          });
      }
    } finally {
      gate.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function currentSession() {
    if (!session.session) {
      session.openLoginModal();
      return null;
    }
    return session.session;
  }
  async function updateWorkspace() {
    try {
      await onRefresh();
    } catch {
      if (alive.current) setError('操作结果已保留，但列表刷新失败，请重新读取工作区。');
    }
  }
  async function executePrepare(entry: RecoveryEntry) {
    const current = currentSession();
    if (!current || !entry.prepare) return;
    track(entry); // Must finish synchronously before sending.
    const data = await api.prepare(entry.prepare, current.upstreamSessionToken);
    if (alive.current) session.persistSessionFromResult(current, data);
    if (data.operation) track({ ...entry, operationId: data.operation.id });
    else forget([entry.clientRequestId]);
    await updateWorkspace();
    if (!alive.current) return;
    setPrepared(data);
    setPrepareEntry(data.operation ? entry : null);
    setScores(data.material.lesson?.scores ?? []);
    setChecked(false);
    if (data.operation)
      setOperations((old) => ({ ...old, [entry.clientRequestId]: data.operation! }));
    onDirty(Boolean(data.preview && data.blockers.length === 0));
  }
  async function queryEntry(entry: RecoveryEntry) {
    const op = await api.operation({
      semesterId: entry.semesterId,
      kind: entry.kind,
      resourceKey: entry.resourceKey,
      clientRequestId: entry.clientRequestId,
    });
    setOperations((old) => ({ ...old, [entry.clientRequestId]: op }));
    setResult(op);
    if (isSaved(op)) {
      forget([entry.clientRequestId, ...(entry.parentRequestId ? [entry.parentRequestId] : [])]);
      onDirty(false);
    }
    if (op.state === 'REJECTED') forget([entry.clientRequestId]);
    await updateWorkspace();
  }
  async function closeEntry(entry: RecoveryEntry) {
    const details = closureDetails(entry, entries);
    if (!details) return;
    const op = await api.closeUnstartedRequest({
      ...target,
      ...details,
      action: entry.action,
      clientRequestId: entry.clientRequestId,
    });
    if (alive.current) {
      setOperations((old) => ({ ...old, [entry.clientRequestId]: op }));
      setResult(op);
    }
    if (op.state === 'REJECTED') forget([entry.clientRequestId]);
    else if (isSaved(op)) {
      forget([entry.clientRequestId, ...(entry.parentRequestId ? [entry.parentRequestId] : [])]);
      if (alive.current) onDirty(false);
    }
    await updateWorkspace();
  }
  const status = resource.status.rounds.find((item) => item.round === round)!;
  const retryId = status.retryWarningOperationId;
  const blockers = status.blockers.filter(
    (value) => value !== 'RETRY_CONFIRMATION_REQUIRED' || acknowledged !== retryId,
  );
  // Once an operation is known, retry admission belongs to the current server round status.
  // Unresolved requests (including NOT_FOUND) must keep blocking new request IDs.
  const unresolved = entries.some((entry) => !operations[entry.clientRequestId]);
  const preview = prepared?.preview;
  const stale = Boolean(
    preview &&
    (preview.observationVersion !== resource.status.observationVersion ||
      preview.scheduleVersion !== resource.schedule.version ||
      resource.status.state !== 'TRUSTED' ||
      resource.status.rounds.find((item) => item.round === preview.round)?.covered ||
      expiredId === preview.id),
  );
  const validScores =
    !prepared?.material.lesson ||
    prepared.material.lesson.scoreItems.every(
      (item, index) =>
        typeof scores[index] === 'number' && scores[index]! >= 0 && scores[index]! <= item.maximum,
    );
  const ready =
    preview &&
    !stale &&
    blockers.length === 0 &&
    preview.round === round &&
    !prepared?.blockers.length &&
    checked &&
    validScores &&
    !unresolved &&
    !isSaved(result);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <strong>{resource.courseName}</strong>
        <p>{resource.teacherNames.join('、')}</p>
      </div>
      {storageError && <Alert type="error" title={storageError} showIcon />}
      {error && <Alert type="warning" title={error} showIcon />}
      <Space wrap>
        <Tag>{statusText(resource.status)}</Tag>
        <span>有效覆盖 {resource.status.effectiveCoveredCount} / 3 轮</span>
      </Space>
      <span>
        最近观察：
        {resource.status.observedAt
          ? new Date(resource.status.observedAt).toLocaleString()
          : '尚未刷新'}
      </span>
      <Space wrap>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const current = currentSession();
              if (!current) return;
              const data = await api.refreshStatus(target, current.upstreamSessionToken);
              if (alive.current) session.persistSessionFromResult(current, data);
              setChecked(false);
              await updateWorkspace();
            })
          }
        >
          刷新检查状态
        </Button>
        <Button disabled={busy} onClick={onArrange}>
          安排日期
        </Button>
      </Space>
      <Divider titlePlacement="start">安排与轮次</Divider>
      <Radio.Group
        value={round}
        disabled={busy}
        onChange={(event) => {
          setRound(event.target.value as number);
          setAcknowledged(null);
        }}
        options={resource.status.rounds.map((item) => ({
          value: item.round,
          label: `第 ${item.round} 轮`,
        }))}
      />
      <p>
        检查日期：
        {resource.schedule.version
          ? (resource.schedule.dates[round - 1] ?? '尚未安排')
          : '尚未保存'}
      </p>
      {resource.status.rounds.map((item) => (
        <div key={item.round}>
          <span>
            第 {item.round} 轮：
            {item.covered ? item.coverageBasis.map(basisText).join('、') : '未覆盖'}
          </span>
          {resource.schedule.rounds.find((row) => row.round === item.round)?.operationState && (
            <span>
              {' '}
              · 操作
              {operationText(
                resource.schedule.rounds.find((row) => row.round === item.round)!.operationState!,
              )}
            </span>
          )}
          {resource.schedule.rounds.find((row) => row.round === item.round)?.operationId && (
            <Button
              type="link"
              size="small"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const op = await api.operation({
                    ...target,
                    operationId: resource.schedule.rounds.find((row) => row.round === item.round)!
                      .operationId!,
                  });
                  setResult(op);
                  await updateWorkspace();
                })
              }
            >
              查询本轮操作
            </Button>
          )}
        </div>
      ))}
      {status.retryAfter && (
        <span>
          等待期限：{new Date(status.retryAfter).toLocaleString()}；期限到达后刷新状态确认资格。
        </span>
      )}
      {retryId && !status.covered && (
        <Checkbox
          checked={acknowledged === retryId}
          disabled={busy}
          onChange={(event) => setAcknowledged(event.target.checked ? retryId : null)}
        >
          上次结果未确认，继续可能重复；我确认承担本次重试风险
        </Checkbox>
      )}
      {blockers.length > 0 && <Alert type="info" title={blockers.map(blockerText).join('；')} />}
      {entries.length > 0 && (
        <Card title="待核对操作" size="small">
          <div className="flex flex-col gap-3">
            {entries.map((entry) => {
              const op = operations[entry.clientRequestId];
              return (
                <div key={entry.clientRequestId} className="flex flex-col gap-2">
                  <span>
                    {entry.action === 'PREPARE' ? '准备材料' : '保存检查'} ·{' '}
                    {op ? operationText(op.state) : '结果待查询'}
                  </span>
                  {entry.upstreamLoginId && <span>原检查人：{entry.upstreamLoginId}</span>}
                  {entry.upstreamLoginId &&
                    entry.upstreamLoginId !== session.session?.upstreamLoginId && (
                      <Alert type="info" title="请切回原检查人后恢复材料；操作结果仍可查询。" />
                    )}
                  <Space wrap>
                    <Button disabled={busy} onClick={() => void run(() => queryEntry(entry))}>
                      查询操作结果
                    </Button>
                    {!op && closureDetails(entry, entries) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          modal.confirm({
                            title: '核对并关闭未执行请求？',
                            content:
                              '服务端会保留已经开始的操作及结果；只有尚未开始的请求会被关闭。关闭后需要重新核对并手动提交，不会自动重发。',
                            onOk: () => run(() => closeEntry(entry)),
                          })
                        }
                      >
                        核对并关闭未执行请求
                      </Button>
                    )}
                    {op?.state === 'PREPARED' && entry.prepare && (
                      <>
                        <Button
                          disabled={
                            busy ||
                            unresolved ||
                            Boolean(
                              entry.upstreamLoginId &&
                              entry.upstreamLoginId !== session.session?.upstreamLoginId,
                            )
                          }
                          onClick={() => void run(() => executePrepare(entry))}
                        >
                          恢复材料
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            modal.confirm({
                              title: '放弃这份未提交的预览？',
                              content: '此操作只清除本地恢复入口，不改变已发送的保存结果。',
                              onOk: () => {
                                forget([entry.clientRequestId]);
                                if (prepareEntry?.clientRequestId === entry.clientRequestId) {
                                  setPrepared(null);
                                  setPrepareEntry(null);
                                  onDirty(false);
                                }
                              },
                            })
                          }
                        >
                          放弃预览
                        </Button>
                      </>
                    )}
                  </Space>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <Button
        type="primary"
        disabled={
          busy ||
          Boolean(storageError) ||
          blockers.length > 0 ||
          unresolved ||
          entries.some(
            (entry) =>
              operations[entry.clientRequestId]?.state === 'PREPARED' &&
              !entries.some(
                (saved) =>
                  saved.parentRequestId === entry.clientRequestId &&
                  Boolean(operations[saved.clientRequestId]),
              ),
          )
        }
        onClick={() =>
          void run(async () => {
            if (!currentSession()) return;
            const clientRequestId = crypto.randomUUID();
            setResult(null);
            await executePrepare({
              ...target,
              accountId: account.accountId,
              action: 'PREPARE',
              upstreamLoginId: session.session?.upstreamLoginId,
              clientRequestId,
              prepare: {
                ...target,
                clientRequestId,
                round,
                checkDate: resource.schedule.dates[round - 1],
                scheduleVersion: resource.schedule.version,
                ...(retryId ? { retryOfOperationId: acknowledged ?? undefined } : {}),
              },
            });
          })
        }
      >
        准备材料
      </Button>
      {prepared && (
        <>
          <Divider titlePlacement="start">材料核对</Divider>
          {preview && (
            <p>
              第 {preview.round} 轮 · {preview.checkDate} · 有效至{' '}
              {new Date(preview.expiresAt).toLocaleString()}
            </p>
          )}
          {(stale || prepared.blockers.length > 0) && (
            <Alert
              type="warning"
              title={
                stale
                  ? '材料依据已失效，请放弃本预览后重新准备。'
                  : prepared.blockers.map(blockerText).join('；')
              }
            />
          )}
          <MaterialView
            material={prepared.material}
            scores={scores}
            disabled={busy || stale || isSaved(result)}
            onScores={(value) => {
              setScores(value);
              setChecked(false);
              onDirty(true);
            }}
          />
          <Checkbox
            disabled={busy || stale || !preview || isSaved(result)}
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          >
            我已核对课程、日期及上述材料
          </Checkbox>
          <Button
            type="primary"
            disabled={busy || !ready || Boolean(storageError)}
            loading={busy}
            onClick={() =>
              void run(async () => {
                const current = currentSession();
                if (!current || !preview || !prepareEntry || !ready) return;
                const entry: RecoveryEntry = {
                  ...target,
                  accountId: account.accountId,
                  action: 'SAVE',
                  upstreamLoginId: current.upstreamLoginId,
                  clientRequestId: crypto.randomUUID(),
                  parentRequestId: prepareEntry.clientRequestId,
                  round: preview.round,
                  checkDate: preview.checkDate,
                };
                track(entry);
                setChecked(false);
                const data = await api.save(
                  {
                    ...target,
                    previewId: preview.id,
                    clientRequestId: entry.clientRequestId,
                    retryOfOperationId: prepareEntry.prepare?.retryOfOperationId,
                    ...(prepared.material.lesson ? { scores: scores as number[] } : {}),
                  },
                  current.upstreamSessionToken,
                );
                if (alive.current) session.persistSessionFromResult(current, data);
                if (alive.current) {
                  setResult(data.operation);
                  setOperations((old) => ({ ...old, [entry.clientRequestId]: data.operation }));
                  onDirty(false);
                }
                if (isSaved(data.operation))
                  forget([entry.clientRequestId, prepareEntry.clientRequestId]);
                else track({ ...entry, operationId: data.operation.id });
                await updateWorkspace();
              })
            }
          >
            确认并保存本条检查
          </Button>
        </>
      )}
      {result && (
        <Alert
          showIcon
          type={isSaved(result) ? 'success' : 'warning'}
          title={operationText(result.state)}
          description={
            isSaved(result)
              ? '已收到保存成功结果，数量尚未增加也无需再次提交。'
              : result.state === 'REJECTED'
                ? '服务端已确认原请求未执行并关闭其入口。请刷新状态，重新核对后手动继续。'
                : '操作结果与数量覆盖分别保留。请查询核对，不要自动重复提交。'
          }
        />
      )}
    </div>
  );
}
