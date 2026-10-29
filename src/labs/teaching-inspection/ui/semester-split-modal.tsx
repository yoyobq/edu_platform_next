// src/labs/teaching-inspection/ui/semester-split-modal.tsx
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Space } from 'antd';

import { isGraphQLIngressError } from '@/shared/graphql';

import * as api from '../infrastructure/api';
import type { GroupingStatus, TimeWorkspace } from '../model';

export function SemesterSplitModal({
  semesterId,
  grouping,
  onClose,
  onDirty,
  onBusy,
  onRefresh,
  onSaved,
}: {
  semesterId: number;
  grouping: GroupingStatus;
  onClose: () => void;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onRefresh: () => Promise<TimeWorkspace>;
  onSaved: () => void;
}) {
  const [baseline, setBaseline] = useState(grouping);
  const [adjusting, setAdjusting] = useState(grouping.confirmed);
  const [split, setSplit] = useState(
    grouping.confirmed ? grouping.split : grouping.recommendedSplit,
  );
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState('');
  const gate = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const invalid = !Number.isInteger(split) || split < 1 || split >= baseline.weeks;
  async function confirm() {
    if (gate.current || invalid || needsRefresh) return;
    gate.current = true;
    setBusy(true);
    onBusy(true);
    onDirty(true);
    setError('');
    try {
      const input = {
        semesterId,
        expectedVersion: baseline.version,
        expectedSourceVersion: baseline.sourceVersion,
        split,
      };
      const preview = await api.grouping(input, false);
      if (!mounted.current) return;
      await api.grouping({ ...input, previewToken: preview.previewToken }, true);
      await onRefresh();
      onDirty(false);
      onSaved();
    } catch (cause) {
      setNeedsRefresh(true);
      setError(
        isGraphQLIngressError(cause) ? cause.userMessage : '确认结果需要核对，请重新读取学期安排。',
      );
    } finally {
      gate.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function reread() {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const fresh = await onRefresh();
      if (!fresh.grouping) throw new Error('missing grouping');
      setBaseline(fresh.grouping);
      setSplit(fresh.grouping.confirmed ? fresh.grouping.split : fresh.grouping.recommendedSplit);
      setAdjusting(fresh.grouping.confirmed);
      setNeedsRefresh(false);
      setError('');
      onDirty(false);
      if (fresh.grouping.confirmed) onSaved();
    } catch (cause) {
      setError(isGraphQLIngressError(cause) ? cause.userMessage : '读取失败，请稍后重试');
    } finally {
      gate.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <Modal
      open
      title="确认本学期教学分段"
      width={560}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      mask={{ closable: false }}
      footer={null}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <p>
          本学期共 <strong>{baseline.weeks}</strong> 个教学周。根据排课，推荐前半学期 1–
          {baseline.recommendedSplit} 周、后半学期 {baseline.recommendedSplit + 1}–{baseline.weeks}{' '}
          周。
        </p>
        <Alert
          type="info"
          showIcon
          title={`前半学期：1–${split} 周；后半学期：${split + 1}–${baseline.weeks} 周`}
          description="确认后，课程会自动匹配对应安排，接下来再确认三次检查日期。"
        />
        {baseline.confirmed && (
          <Alert
            type="warning"
            showIcon
            title="修改分段后，前、后半学期检查日期需要重新确认。已有独立课程安排保留。"
          />
        )}
        {adjusting && (
          <label>
            前半学期结束周{' '}
            <InputNumber
              aria-label="前半学期结束周"
              min={1}
              max={baseline.weeks - 1}
              value={split}
              disabled={busy || needsRefresh}
              onChange={(value) => {
                if (value !== null) {
                  setSplit(value);
                  onDirty(true);
                }
              }}
            />
          </label>
        )}
        {error && <Alert type="error" showIcon title={error} />}
        <Space wrap>
          <Button
            type="primary"
            loading={busy}
            disabled={busy || invalid || needsRefresh}
            onClick={() => void confirm()}
          >
            {adjusting ? '确认教学分段' : '采用推荐分段'}
          </Button>
          {!adjusting && (
            <Button disabled={busy || needsRefresh} onClick={() => setAdjusting(true)}>
              调整分段
            </Button>
          )}
          <Button disabled={busy} onClick={onClose}>
            稍后处理
          </Button>
          {needsRefresh && (
            <Button disabled={busy} onClick={() => void reread()}>
              重新读取学期安排
            </Button>
          )}
        </Space>
      </Space>
    </Modal>
  );
}
