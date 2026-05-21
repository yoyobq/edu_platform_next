import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  HistoryOutlined,
  LoadingOutlined,
  MoonOutlined,
  PlayCircleOutlined,
  SunOutlined,
} from '@ant-design/icons';
import CodeHighlighter from '@ant-design/x/es/code-highlighter';
import { Button, Card, Input, Modal, Popconfirm, Switch, Tag, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';

import {
  type CodeHighlightThemeMode,
  createCodeHighlighterProps,
} from '@/shared/ui/code-highlighter';
import { ResponsiveGrid, ResponsiveGridItem } from '@/shared/ui/responsive-layout';

import {
  buildPayloadCryptoHistoryItem,
  getPayloadOperation,
  type PayloadCryptoHistoryItem,
  upsertPayloadCryptoHistoryItem,
} from '../application/history';

const PAYLOAD_CRYPTO_APP_ENVS = ['dev', 'prod'] as const;
const PAYLOAD_CRYPTO_ACCESS_LEVELS = ['admin'] as const;
const PAYLOAD_CRYPTO_PURPOSE = '提供载荷加密/解密工具界面的快速验证';

function normalizeInput(raw: string) {
  let str = raw.trim();

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }

  return str.trim();
}

function formatHistoryTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hour}:${minute}`;
}

function summarizeHistoryInput(value: string) {
  const compactValue = value.replace(/\s+/g, ' ').trim();

  if (compactValue.length <= 96) {
    return compactValue;
  }

  return `${compactValue.slice(0, 96)}...`;
}

function getDefaultHistoryName(operation: PayloadCryptoHistoryItem['operation']) {
  return operation === 'encrypt' ? '加密载荷' : '解密载荷';
}

function getHistoryDisplayName(item: PayloadCryptoHistoryItem) {
  const normalizedName = item.name?.trim();

  return (
    normalizedName || summarizeHistoryInput(item.input) || getDefaultHistoryName(item.operation)
  );
}

type PayloadCryptoPageContentProps = {
  clearHistory: () => void;
  currentAccountId: number | null;
  decryptPayload: (payload: string) => Promise<string>;
  encryptPayload: (payload: string) => Promise<string>;
  readHistory: () => PayloadCryptoHistoryItem[];
  writeHistory: (items: readonly PayloadCryptoHistoryItem[]) => void;
};

export function PayloadCryptoPageContent({
  clearHistory,
  currentAccountId,
  decryptPayload,
  encryptPayload,
  readHistory,
  writeHistory,
}: PayloadCryptoPageContentProps) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [historyItems, setHistoryItems] = useState<PayloadCryptoHistoryItem[]>(() => readHistory());
  const [renamingHistoryItem, setRenamingHistoryItem] = useState<PayloadCryptoHistoryItem | null>(
    null,
  );
  const [renameDraft, setRenameDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [isPasteOverlayVisible, setIsPasteOverlayVisible] = useState(true);
  const [codeThemeMode, setCodeThemeMode] = useState<CodeHighlightThemeMode>('dark');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : false,
  );
  const inputRef = useRef<TextAreaRef | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const normalizedInput = normalizeInput(input);
  const canProcess = Boolean(normalizedInput) && !loading;
  const showPasteOverlay = !normalizedInput && isPasteOverlayVisible;
  const isInputCompressed = Boolean(result) && !isInputExpanded;
  const gridColumns = isInputExpanded
    ? { compact: 1, wide: 'minmax(0, 1.5fr) minmax(300px, 1fr)' }
    : isInputCompressed
      ? { compact: 1, wide: 'minmax(0, 2.05fr) minmax(220px, 0.55fr)' }
      : { compact: 1, wide: 'minmax(0, 1.75fr) minmax(240px, 0.75fr)' };
  const inputAutoSize = useMemo(() => {
    if (isInputExpanded) {
      return { maxRows: 18, minRows: 8 };
    }

    if (isInputCompressed) {
      return { maxRows: 7, minRows: 4 };
    }

    return { maxRows: 10, minRows: 5 };
  }, [isInputCompressed, isInputExpanded]);
  const codeHighlightProps = useMemo(
    () => createCodeHighlighterProps(codeThemeMode),
    [codeThemeMode],
  );
  useEffect(() => {
    function syncPageFocus() {
      setShowShortcutHint(document.hasFocus() && document.visibilityState === 'visible');
    }

    syncPageFocus();
    window.addEventListener('focus', syncPageFocus);
    window.addEventListener('blur', syncPageFocus);
    document.addEventListener('visibilitychange', syncPageFocus);

    return () => {
      window.removeEventListener('focus', syncPageFocus);
      window.removeEventListener('blur', syncPageFocus);
      document.removeEventListener('visibilitychange', syncPageFocus);
    };
  }, []);

  const saveHistoryItem = useCallback(
    (payload: string) => {
      setHistoryItems((currentItems) => {
        const nextItem = buildPayloadCryptoHistoryItem({
          existingItem: currentItems.find(
            (item) => item.id === `${getPayloadOperation(payload)}:${payload}`,
          ),
          payload,
        });
        const nextItems = upsertPayloadCryptoHistoryItem(currentItems, nextItem);

        writeHistory(nextItems);
        return nextItems;
      });
    },
    [writeHistory],
  );

  const processPayload = useCallback(
    async (rawInput: string) => {
      const normalizedPayload = normalizeInput(rawInput);
      if (!normalizedPayload) {
        return;
      }

      setLoading(true);

      try {
        const nextResult =
          getPayloadOperation(normalizedPayload) === 'encrypt'
            ? await encryptPayload(normalizedPayload)
            : await decryptPayload(normalizedPayload);

        setResult(nextResult);
        saveHistoryItem(normalizedPayload);
      } finally {
        setLoading(false);
      }
    },
    [decryptPayload, encryptPayload, saveHistoryItem],
  );

  const handleProcess = useCallback(async () => {
    await processPayload(input);
  }, [input, processPayload]);

  const scrollToResult = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const handlePasteInput = useCallback(async () => {
    inputRef.current?.focus();

    if (
      typeof navigator === 'undefined' ||
      !window.isSecureContext ||
      typeof navigator.clipboard?.readText !== 'function'
    ) {
      return;
    }

    setIsPasting(true);

    try {
      const clipboardText = await navigator.clipboard.readText();

      if (!clipboardText.trim()) {
        return;
      }

      setIsPasteOverlayVisible(false);
      setInput(clipboardText);
      await processPayload(clipboardText);
      scrollToResult();
    } catch {
      inputRef.current?.focus();
    } finally {
      setIsPasting(false);
    }
  }, [processPayload, scrollToResult]);

  const handleManualInput = useCallback(() => {
    setIsPasteOverlayVisible(false);
    inputRef.current?.focus();
  }, []);

  const handleRenameHistoryItem = useCallback((item: PayloadCryptoHistoryItem) => {
    setRenamingHistoryItem(item);
    setRenameDraft(item.name?.trim() || '');
  }, []);

  const handleConfirmRenameHistoryItem = useCallback(() => {
    if (!renamingHistoryItem) {
      return;
    }

    const normalizedName = renameDraft.trim();
    setHistoryItems((currentItems) => {
      const nextItems = currentItems.map((currentItem) =>
        currentItem.id === renamingHistoryItem.id
          ? {
              ...currentItem,
              name: normalizedName || undefined,
            }
          : currentItem,
      );

      writeHistory(nextItems);
      return nextItems;
    });
    setRenamingHistoryItem(null);
    setRenameDraft('');
  }, [renameDraft, renamingHistoryItem, writeHistory]);

  const handleCancelRenameHistoryItem = useCallback(() => {
    setRenamingHistoryItem(null);
    setRenameDraft('');
  }, []);

  const handleDeleteHistoryItem = useCallback(
    (item: PayloadCryptoHistoryItem) => {
      setHistoryItems((currentItems) => {
        const nextItems = currentItems.filter((currentItem) => currentItem.id !== item.id);

        writeHistory(nextItems);
        return nextItems;
      });
    },
    [writeHistory],
  );

  const handleClearHistory = useCallback(() => {
    setHistoryItems([]);
    clearHistory();
  }, [clearHistory]);

  const handleUseHistoryItem = useCallback(
    async (historyInput: string) => {
      setInput(historyInput);
      setResult('');
      setIsPasteOverlayVisible(false);
      inputRef.current?.focus();
      await processPayload(historyInput);
      scrollToResult();
    },
    [processPayload, scrollToResult],
  );

  const handlePrimaryAction = useCallback(async () => {
    if (!normalizedInput) {
      handleManualInput();
      return;
    }

    await handleProcess();
    scrollToResult();
  }, [handleManualInput, handleProcess, normalizedInput, scrollToResult]);

  useEffect(() => {
    if (!canProcess) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || !event.ctrlKey) {
        return;
      }

      event.preventDefault();
      void handlePrimaryAction();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canProcess, handlePrimaryAction]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography.Title level={3} style={{ marginBottom: 0 }}>
                载荷加解密工具
              </Typography.Title>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Tag color="green">环境：{PAYLOAD_CRYPTO_APP_ENVS.join(', ')}</Tag>
                <Tag color="gold">访问级别：{PAYLOAD_CRYPTO_ACCESS_LEVELS.join(', ')}</Tag>
                <Tag color="blue">当前 ID：{currentAccountId ?? '未恢复'}</Tag>
                <Tag color="default">仅 ID 1 / 2 可访问</Tag>
              </div>
            </div>
            <div>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {PAYLOAD_CRYPTO_PURPOSE}
              </Typography.Paragraph>
            </div>
          </div>
        </Card>

        <ResponsiveGrid className="gap-4" columns={gridColumns}>
          <ResponsiveGridItem order={{ wide: 2 }}>
            <Card
              title="输入载荷"
              extra={
                <div className="flex items-center gap-1">
                  <Button
                    aria-label="清空输入载荷"
                    disabled={!normalizedInput}
                    icon={<DeleteOutlined />}
                    size="small"
                    title="清空输入载荷"
                    type="text"
                    onClick={() => {
                      setInput('');
                      setResult('');
                      setIsPasteOverlayVisible(true);
                    }}
                  />
                  <Button
                    aria-label={isInputExpanded ? '恢复紧凑输入区' : '展开输入区'}
                    icon={isInputExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                    size="small"
                    title={isInputExpanded ? '恢复紧凑输入区' : '展开输入区'}
                    type="text"
                    onClick={() => setIsInputExpanded((currentValue) => !currentValue)}
                  />
                </div>
              }
            >
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Input.TextArea
                    ref={inputRef}
                    autoSize={inputAutoSize}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setIsPasteOverlayVisible(!e.target.value);
                    }}
                    style={{ fontFamily: 'monospace' }}
                  />
                  {showPasteOverlay ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-card border border-dashed border-border bg-bg-container/72 p-4 backdrop-blur-[1px]">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <button
                          aria-label="点击粘贴载荷"
                          className="flex flex-col items-center gap-2 text-left text-sidebar-affordance-ink transition hover:text-text-secondary"
                          type="button"
                          onClick={() => void handlePasteInput()}
                        >
                          {isPasting ? (
                            <LoadingOutlined style={{ fontSize: 18 }} />
                          ) : (
                            <CopyOutlined
                              style={{
                                color: 'var(--ant-color-text-tertiary)',
                                fontSize: 18,
                              }}
                            />
                          )}
                          <Typography.Text type="secondary">
                            {isPasting ? '正在读取剪贴板' : '点击粘贴载荷'}
                          </Typography.Text>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  type={normalizedInput ? 'primary' : 'dashed'}
                  icon={normalizedInput ? undefined : <EditOutlined />}
                  aria-keyshortcuts="Control+Enter"
                  loading={loading}
                  onClick={() => void handlePrimaryAction()}
                >
                  <div className="flex items-center gap-2">
                    <span>{normalizedInput ? '查看结果' : '手动输入'}</span>
                    {showShortcutHint && normalizedInput ? (
                      <span className="rounded-full border border-current/15 px-2 py-0.5 text-xs text-current/75">
                        Ctrl+Enter
                      </span>
                    ) : null}
                  </div>
                </Button>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <HistoryOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />
                      <Typography.Text strong>加解密历史</Typography.Text>
                    </div>
                    <Popconfirm
                      cancelText="取消"
                      disabled={historyItems.length === 0}
                      okButtonProps={{ danger: true }}
                      okText="清空"
                      title="清空全部加解密历史？"
                      onConfirm={handleClearHistory}
                    >
                      <Button disabled={historyItems.length === 0} size="small" type="text">
                        清空
                      </Button>
                    </Popconfirm>
                  </div>
                  {historyItems.length > 0 ? (
                    <div className="flex max-h-72 flex-col overflow-y-auto">
                      {historyItems.map((item, index) => (
                        <div
                          className="@container border-t border-border py-2 first:border-t-0"
                          key={item.id}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <Tag color={item.operation === 'encrypt' ? 'blue' : 'purple'}>
                                {item.operation === 'encrypt' ? '加密' : '解密'}
                              </Tag>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                aria-label={`重命名历史 ${index + 1}`}
                                icon={<EditOutlined />}
                                size="small"
                                style={{ color: 'var(--ant-color-warning)' }}
                                title="重命名历史"
                                type="text"
                                onClick={() => handleRenameHistoryItem(item)}
                              />
                              <Popconfirm
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                okText="删除"
                                title={`删除历史“${getHistoryDisplayName(item)}”？`}
                                onConfirm={() => handleDeleteHistoryItem(item)}
                              >
                                <Button
                                  aria-label={`删除历史 ${index + 1}`}
                                  danger
                                  icon={<DeleteOutlined />}
                                  size="small"
                                  title="删除历史"
                                  type="text"
                                />
                              </Popconfirm>
                              <Button
                                aria-label={`调用历史 ${index + 1}`}
                                data-testid={`payload-history-use-${index}`}
                                icon={<PlayCircleOutlined />}
                                loading={loading}
                                size="small"
                                style={{ color: 'var(--ant-color-primary)' }}
                                title="调用历史"
                                type="text"
                                onClick={() => void handleUseHistoryItem(item.input)}
                              />
                            </div>
                          </div>
                          <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
                            <div className="min-w-0 truncate">
                              <Typography.Text strong title={getHistoryDisplayName(item)}>
                                {getHistoryDisplayName(item)}
                              </Typography.Text>
                            </div>
                            <div className="shrink-0 whitespace-nowrap text-right text-xs">
                              <Typography.Text type="secondary">
                                {formatHistoryTime(item.updatedAt)}
                              </Typography.Text>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <Typography.Text type="secondary">暂无历史记录</Typography.Text>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </ResponsiveGridItem>

          <ResponsiveGridItem order={{ wide: 1 }}>
            <div ref={resultRef}>
              <Card
                title="结果"
                extra={
                  <div className="flex items-center gap-2">
                    <SunOutlined
                      style={{
                        color:
                          codeThemeMode === 'light'
                            ? 'var(--ant-color-warning)'
                            : 'var(--ant-color-text-tertiary)',
                        fontSize: 14,
                      }}
                    />
                    <Switch
                      aria-label="切换结果区明暗主题"
                      checked={codeThemeMode === 'dark'}
                      size="small"
                      onChange={(checked) => setCodeThemeMode(checked ? 'dark' : 'light')}
                    />
                    <MoonOutlined
                      style={{
                        color:
                          codeThemeMode === 'dark'
                            ? 'var(--ant-color-text)'
                            : 'var(--ant-color-text-tertiary)',
                        fontSize: 14,
                      }}
                    />
                  </div>
                }
                styles={{
                  body: {
                    padding: 8,
                  },
                }}
              >
                {result ? (
                  <CodeHighlighter lang="json" {...codeHighlightProps}>
                    {result}
                  </CodeHighlighter>
                ) : (
                  <div className="flex h-full min-h-75 items-center justify-center">
                    <Typography.Text type="secondary">暂无结果，请先执行加解密操作</Typography.Text>
                  </div>
                )}
              </Card>
            </div>
          </ResponsiveGridItem>
        </ResponsiveGrid>
      </div>
      <Modal
        cancelText="取消"
        okText="保存"
        open={Boolean(renamingHistoryItem)}
        title="重命名历史"
        onCancel={handleCancelRenameHistoryItem}
        onOk={handleConfirmRenameHistoryItem}
      >
        <Input
          autoFocus
          placeholder="输入历史名称"
          value={renameDraft}
          onChange={(event) => setRenameDraft(event.target.value)}
          onPressEnter={handleConfirmRenameHistoryItem}
        />
      </Modal>
    </>
  );
}
