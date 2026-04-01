import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  LoadingOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { CodeHighlighter } from '@ant-design/x';
import { Button, Card, Input, Switch, Tag, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

import { payloadCryptoLabAccess } from './access';
import { requestGraphQL } from './api';
import { payloadCryptoLabMeta } from './meta';

type SstsPayloadDebugResultDTO = {
  encryptedData: string;
  operation: string;
  plainTextData: unknown;
};

type CodeThemeMode = 'dark' | 'light';

const ENCRYPT_QUERY = `
  query DebugEncryptSstsPayload($input: DebugEncryptSstsPayloadInput!) {
    debugEncryptSstsPayload(input: $input) {
      encryptedData
      operation
      plainTextData
    }
  }
`;

const DECRYPT_QUERY = `
  query DebugDecryptSstsPayload($input: DebugDecryptSstsPayloadInput!) {
    debugDecryptSstsPayload(input: $input) {
      encryptedData
      operation
      plainTextData
    }
  }
`;

function normalizeInput(raw: string) {
  let str = raw.trim();

  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }

  return str.trim();
}

function isJsonInput(input: string) {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

async function apiEncrypt(payload: string): Promise<string> {
  try {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return 'Error encrypting payload: Invalid JSON input format';
    }

    const data = await requestGraphQL<
      { debugEncryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { plainTextData: unknown } }
    >(ENCRYPT_QUERY, { input: { plainTextData: parsedPayload } });
    return data.debugEncryptSstsPayload.encryptedData;
  } catch (err: unknown) {
    return `Error encrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function apiDecrypt(payload: string): Promise<string> {
  try {
    const data = await requestGraphQL<
      { debugDecryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { encryptedData: string } }
    >(DECRYPT_QUERY, { input: { encryptedData: payload } });
    return JSON.stringify(data.debugDecryptSstsPayload.plainTextData, null, 2);
  } catch (err: unknown) {
    return `Error decrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

export function PayloadCryptoLabPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [isPasteOverlayVisible, setIsPasteOverlayVisible] = useState(true);
  const [codeThemeMode, setCodeThemeMode] = useState<CodeThemeMode>('dark');
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
  const gridClassName = isInputExpanded
    ? 'grid gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.5fr)]'
    : isInputCompressed
      ? 'grid gap-4 xl:grid-cols-[minmax(220px,0.55fr)_minmax(0,2.05fr)]'
      : 'grid gap-4 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.75fr)]';
  const inputAutoSize = useMemo(() => {
    if (isInputExpanded) {
      return { maxRows: 18, minRows: 8 };
    }

    if (isInputCompressed) {
      return { maxRows: 7, minRows: 4 };
    }

    return { maxRows: 10, minRows: 5 };
  }, [isInputCompressed, isInputExpanded]);
  const codeHighlightProps = {
    codeTagProps: {
      style: {
        background: 'transparent',
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
      },
    },
    wrapLongLines: true,
    ...(codeThemeMode === 'dark'
      ? {
          style: {
            ...vscDarkPlus,
            'pre[class*="language-"]': {
              ...vscDarkPlus['pre[class*="language-"]'],
              margin: 0,
            },
          },
        }
      : null),
  };

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

  const processPayload = useCallback(async (rawInput: string) => {
    const normalizedPayload = normalizeInput(rawInput);
    if (!normalizedPayload) {
      return;
    }

    setLoading(true);

    try {
      const nextResult = isJsonInput(normalizedPayload)
        ? await apiEncrypt(normalizedPayload)
        : await apiDecrypt(normalizedPayload);

      setResult(nextResult);
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              载荷加解密工具
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {payloadCryptoLabMeta.purpose}
            </Typography.Paragraph>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tag color="blue">负责人：{payloadCryptoLabMeta.owner}</Tag>
            <Tag color="purple">复核时间：{payloadCryptoLabMeta.reviewAt}</Tag>
            <Tag color="green">环境：{payloadCryptoLabAccess.env.join(', ')}</Tag>
            <Tag color="gold">角色：{payloadCryptoLabAccess.roles.join(', ')}</Tag>
          </div>
        </div>
      </Card>

      <div className={gridClassName}>
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
                <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-black/10 bg-white/72 p-4 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <button
                      aria-label="点击粘贴载荷"
                      className="flex flex-col items-center gap-2 text-left text-(--ant-color-text-tertiary) transition hover:text-text-secondary"
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
          </div>
        </Card>

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
              <CodeHighlighter
                lang="json"
                highlightProps={codeHighlightProps}
                style={{ width: '100%' }}
                styles={{
                  code: {
                    fontSize: 'var(--ant-font-size-sm)',
                    lineHeight: 1.6,
                  },
                  root: {
                    overflow: 'hidden',
                  },
                }}
              >
                {result}
              </CodeHighlighter>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <Typography.Text type="secondary">暂无结果，请先执行加解密操作</Typography.Text>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
