// src/labs/student-registration-cards/ui/use-card-batch.ts
import { useEffect, useRef, useState } from 'react';

import { type BatchRow, createBatch, runCardBatch } from '../application/card-batch';
import type { BatchStudent } from '../application/card-batch.types';
import { saveCardBlob } from '../infrastructure/api';
import { buildBatchArchive } from '../infrastructure/batch-archive';
import { cardBatchOperations } from '../infrastructure/card-batch-adapter';

export function useCardBatch(
  classId: string | undefined,
  className: string,
  label: (code: string) => string,
) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef<BatchRow[]>([]);
  const stopRef = useRef(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRef.current = true;
    };
  }, []);
  useEffect(() => {
    rowsRef.current = [];
    setRows([]);
    setError(null);
  }, [classId]);

  async function pack(current: BatchRow[]) {
    if (!current.some((row) => row.status === 'success')) return;
    try {
      const archive = await buildBatchArchive(current, className, label);
      if (mounted.current) saveCardBlob(archive.blob, archive.fileName);
    } catch {
      if (mounted.current) setError('ZIP 打包或下载失败，请点击“下载 ZIP”重试。');
    }
  }
  async function execute(students?: BatchStudent[], retry = false) {
    if (locked.current) return;
    locked.current = true;
    stopRef.current = false;
    setStopping(false);
    setError(null);
    setRunning(true);
    const current = students ? createBatch(students) : rowsRef.current;
    rowsRef.current = current;
    const publish = () => {
      if (mounted.current) setRows(current.map((row) => ({ ...row })));
    };
    publish();
    try {
      await runCardBatch(current, () => stopRef.current, publish, retry, cardBatchOperations);
      if (mounted.current) await pack(current);
    } finally {
      locked.current = false;
      if (mounted.current) {
        setRunning(false);
        setStopping(false);
      }
    }
  }
  return {
    rows,
    running,
    stopping,
    error,
    start: (students: BatchStudent[]) => execute(students),
    resume: () => execute(),
    retry: () => execute(undefined, true),
    stop: () => {
      stopRef.current = true;
      setStopping(true);
    },
    download: async () => {
      if (locked.current) return;
      locked.current = true;
      setRunning(true);
      setError(null);
      try {
        await pack(rowsRef.current);
      } finally {
        locked.current = false;
        if (mounted.current) setRunning(false);
      }
    },
  };
}
