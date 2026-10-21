// src/labs/teaching-inspection/ui/date-editor.tsx
import { useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space } from 'antd';

import * as api from '../infrastructure/api';
import type { DateChange, InspectionKind, Resource } from '../model';
export function DateEditor({
  resources: initialResources,
  semesterId,
  kind,
  onClose,
  onCancel,
  onRefresh,
  onDirty,
}: {
  resources: Resource[];
  semesterId: number;
  kind: InspectionKind;
  onClose: () => void;
  onCancel: () => void;
  onRefresh: () => Promise<Resource[]>;
  onDirty: (value: boolean) => void;
}) {
  const [resources, setResources] = useState(initialResources);
  const initial = resources.map((resource) => ({
    resourceKey: resource.resourceKey,
    expectedVersion: resource.schedule.version,
    expectedObservationVersion: resource.status.observationVersion,
    expectedSourceVersion: resource.sourceVersion,
    dates: [
      ...(resource.schedule.dates.length === 3
        ? resource.schedule.dates
        : resource.suggestedDates
      ).map((date, index) =>
        kind === 'PROGRESS' ? (resource.schedule.records?.[index]?.checkDate ?? date) : date,
      ),
    ],
  }));
  const [changes, setChanges] = useState<DateChange[]>(initial);
  const [before, setBefore] = useState(resources.map((resource) => resource.schedule.dates));
  const [common, setCommon] = useState(['', '', '']);
  const [confirmed, setConfirmed] = useState<DateChange[] | null>(null);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  function edit(next: DateChange[]) {
    setChanges(next);
    setConfirmed(null);
    onDirty(true);
  }
  async function run(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setConfirmed(null);
      setError(cause instanceof Error ? cause.message : '日期处理失败，请刷新核对。');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <Card
      title={`确认检查时间 · ${resources.length} 门课程`}
      extra={
        <Button disabled={busy} onClick={onCancel}>
          取消编辑
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p>仅调整本次所选课程。预览后核对修改前后日期，再确认保存。</p>
        {error && <Alert type="error" showIcon title={error} />}
        {uncertain && (
          <Alert type="warning" title="上次保存结果未确认，请先刷新安排，再核对是否已经保存。" />
        )}
        <Space wrap>
          {common.map((date, index) => (
            <Input
              key={index}
              type="date"
              aria-label={`统一第${index + 1}轮日期`}
              value={date}
              disabled={busy}
              onChange={(event) =>
                setCommon(common.map((old, i) => (i === index ? event.target.value : old)))
              }
            />
          ))}
          <Button
            disabled={busy || common.some((date) => !date)}
            onClick={() =>
              edit(
                changes.map((change, index) => ({
                  ...change,
                  dates: common.map((date, round) =>
                    resources[index].status.rounds[round]?.dateEditable &&
                    !(kind === 'PROGRESS' && resources[index].schedule.records?.[round])
                      ? date
                      : change.dates[round],
                  ),
                })),
              )
            }
          >
            应用到所选课程
          </Button>
        </Space>
        {changes.map((change, index) => (
          <Card size="small" key={change.resourceKey} title={resources[index].courseName}>
            <div className="flex flex-col gap-2">
              <span>原安排：{before[index].join(' / ') || '尚未保存'}</span>
              {resources[index].schedule.records?.map((record) => (
                <span key={record.recordKey}>
                  上游实际检查：{record.checkDate} · {record.score}分
                </span>
              ))}
              {kind === 'ASSIGNMENT' &&
                resources[index].schedule.rounds
                  .filter((round) => round.savedOperationId)
                  .map((round) => (
                    <span key={round.round}>
                      第 {round.round} 轮本地提交：{round.date}（上游日期未核实）
                    </span>
                  ))}
              {kind === 'ASSIGNMENT' && (
                <span>上游未提供可核实的历史日期；这里确认的是本地提交日期。</span>
              )}
              <Space wrap>
                {[0, 1, 2].map((round) => (
                  <label key={round}>
                    第 {round + 1} 轮
                    <Input
                      type="date"
                      aria-label={`${resources[index].courseName}第${round + 1}轮日期`}
                      min={resources[index].earliestDate ?? undefined}
                      max={resources[index].latestDate ?? undefined}
                      value={change.dates[round] ?? ''}
                      disabled={
                        busy ||
                        !resources[index].status.rounds[round]?.dateEditable ||
                        Boolean(kind === 'PROGRESS' && resources[index].schedule.records?.[round])
                      }
                      onChange={(event) =>
                        edit(
                          changes.map((old, i) =>
                            i === index
                              ? {
                                  ...old,
                                  dates: [0, 1, 2].map((r) =>
                                    r === round ? event.target.value : (old.dates[r] ?? ''),
                                  ),
                                }
                              : old,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </Space>
              {confirmed && <span>待保存：{confirmed[index].dates.join(' / ')}</span>}
            </div>
          </Card>
        ))}
        <Space wrap>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const fresh = await onRefresh();
                const next = changes.map((change) => {
                  const resource = fresh.find((item) => item.resourceKey === change.resourceKey);
                  if (!resource) throw new Error('所选课程已不在当前范围，请关闭后重新选择。');
                  return {
                    ...change,
                    dates: change.dates.map((date, index) =>
                      kind === 'PROGRESS' && resource.schedule.records[index]
                        ? resource.schedule.records[index].checkDate
                        : !resource.status.rounds[index]?.dateEditable
                          ? (resource.schedule.dates[index] ?? date)
                          : date,
                    ),
                    expectedVersion: resource.schedule.version,
                    expectedObservationVersion: resource.status.observationVersion,
                    expectedSourceVersion: resource.sourceVersion,
                  };
                });
                setBefore(
                  changes.map(
                    (change) =>
                      fresh.find((item) => item.resourceKey === change.resourceKey)!.schedule.dates,
                  ),
                );
                setResources(
                  changes.map(
                    (change) => fresh.find((item) => item.resourceKey === change.resourceKey)!,
                  ),
                );
                setChanges(next);
                setConfirmed(null);
                setUncertain(false);
              })
            }
          >
            刷新依据并重新核对
          </Button>
          <Button
            disabled={busy || uncertain}
            onClick={() =>
              void run(async () => {
                const snapshot = structuredClone(changes);
                await api.dates({ semesterId, kind, changes: snapshot }, false);
                setConfirmed(snapshot);
              })
            }
          >
            预览日期
          </Button>
          <Button
            type="primary"
            disabled={!confirmed || busy || uncertain}
            loading={busy}
            onClick={() =>
              void run(async () => {
                if (!confirmed) return;
                try {
                  await api.dates({ semesterId, kind, changes: confirmed }, true);
                } catch (cause) {
                  setUncertain(true);
                  throw cause;
                }
                onDirty(false);
                onClose();
                await onRefresh();
              })
            }
          >
            确认保存日期
          </Button>
        </Space>
      </div>
    </Card>
  );
}
