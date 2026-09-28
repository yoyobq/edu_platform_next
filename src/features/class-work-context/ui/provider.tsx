// src/features/class-work-context/ui/provider.tsx
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { ClassWorkContext, type ClassWorkOption } from '@/entities/class-work-context';

import { listWorkClasses } from '../infrastructure/api';
import {
  buildGovernancePath,
  classWorkSearch,
  isClassWorkPath,
  readClassWorkScope,
  readInspectionReturn,
} from '../infrastructure/navigation';
import { readWorkClass, writeWorkClass } from '../infrastructure/preferences';

export function ClassWorkProvider({
  accountId,
  enabled,
  children,
}: {
  accountId: number | null;
  enabled: boolean;
  children: ReactNode;
}) {
  // Account changes discard in-memory preferences and pending navigation immediately.
  return (
    <AccountClassWorkProvider key={accountId ?? 'guest'} accountId={accountId} enabled={enabled}>
      {children}
    </AccountClassWorkProvider>
  );
}

function AccountClassWorkProvider({
  accountId,
  enabled,
  children,
}: {
  accountId: number | null;
  enabled: boolean;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [options, setOptions] = useState<ClassWorkOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    accountId ? readWorkClass(accountId) : null,
  );
  const [loading, setLoading] = useState(enabled);
  const [loaded, setLoaded] = useState(!enabled);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const handledNavigation = useRef<string | null>(null);
  const pendingWorkClass = useRef<{ id: string; token: string } | null>(null);
  const nextNavigationId = useRef(0);

  const persist = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (accountId && !writeWorkClass(accountId, id))
        setNotice('本次选择已生效，浏览器暂时无法记住它。');
    },
    [accountId],
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listWorkClasses()
      .then((items) => {
        if (!active) return;
        setOptions(items);
        const saved = accountId ? readWorkClass(accountId) : null;
        if (saved && items.some((item) => item.id === saved)) setSelectedId(saved);
        else if (saved) {
          persist(null);
          setNotice('原工作班级已不可用，请重新选择。');
        } else if (items.length === 1) persist(items[0].id);
        else persist(null);
      })
      .catch(() => {
        if (active) setError('班级读取失败');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [accountId, enabled, persist, revision]);

  const explicitScope = readClassWorkScope(location.search);
  const workClass = options.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    const pending = pendingWorkClass.current;
    const state: unknown = location.state;
    if (
      !pending ||
      typeof state !== 'object' ||
      state === null ||
      !('classWorkToken' in state) ||
      state.classWorkToken !== pending.token ||
      handledNavigation.current === location.key
    )
      return;
    handledNavigation.current = location.key;
    pendingWorkClass.current = null;
    if (explicitScope.classId === pending.id && options.some((item) => item.id === pending.id)) {
      setNotice(null);
      persist(pending.id);
    }
  }, [explicitScope.classId, location.key, location.state, options, persist]);

  const goToClass = (id: string, token?: string) => {
    navigate(
      { pathname: location.pathname, search: classWorkSearch({ classId: id }) },
      { state: token ? { classWorkToken: token } : null },
    );
  };
  const returnPath = readInspectionReturn(location.search);
  return (
    <ClassWorkContext.Provider
      value={{
        ready: loaded,
        entryKey: location.key,
        scope: { ...explicitScope, classId: explicitScope.classId ?? workClass?.id },
        workClass,
        options,
        loading,
        error,
        notice,
        retry: () => setRevision((value) => value + 1),
        changeWorkClass: (id) => {
          if (!options.some((item) => item.id === id)) return;
          if (isClassWorkPath(location.pathname)) {
            const token = `${location.key}:${++nextNavigationId.current}`;
            pendingWorkClass.current = { id, token };
            goToClass(id, token);
          } else {
            setNotice(null);
            persist(id);
          }
        },
        returnToWorkClass: () => {
          if (workClass) goToClass(workClass.id);
        },
        returnToInspection: returnPath ? () => navigate(returnPath) : null,
        buildGovernancePath,
      }}
    >
      {children}
    </ClassWorkContext.Provider>
  );
}
