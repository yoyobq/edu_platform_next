import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  isExpiredUpstreamSessionError,
  populateStaffDirectory,
  readStaffDirectory,
  resolveUpstreamErrorMessage,
  type StaffDirectoryEntry,
  type StaffDirectoryResult,
  type StoredUpstreamSession,
  type UpstreamLoginCredentials,
  useUpstreamSession,
} from '@/entities/upstream-session';

import {
  fetchVerificationIssuanceCurrentAccount,
  issueVerificationStaffInvite,
  type VerificationIssuanceCurrentAccount,
} from '../infrastructure/verification-issuance-api';

import { resolveStaffInviteFailureMessage } from './staff-invite-feedback';
import {
  resolveResultMessage,
  type VerificationIssuanceFeedback,
} from './verification-issuance-feedback';

export type StaffInviteFormValues = {
  invitedEmail: string;
  staffId: string;
  staffName: string;
};

export type TeacherSearchOption = {
  key: string;
  label: string;
  name: string;
  staffId: string;
  value: string;
};

export function buildTeacherLabel(teacher: StaffDirectoryEntry) {
  return `${teacher.name} (${teacher.staffId})`;
}

function buildTeacherOption(teacher: StaffDirectoryEntry, value: string): TeacherSearchOption {
  return {
    key: teacher.staffId,
    label: buildTeacherLabel(teacher),
    name: teacher.name,
    staffId: teacher.staffId,
    value,
  };
}

export function filterTeacherOption(inputValue: string, option?: TeacherSearchOption) {
  const keyword = inputValue.trim().toLowerCase();

  if (!keyword || !option) {
    return true;
  }

  return (
    option.staffId.toLowerCase().includes(keyword) ||
    option.name.toLowerCase().includes(keyword) ||
    option.label.toLowerCase().includes(keyword)
  );
}

export function useStaffInviteFlow(input: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const { onFeedback } = input;
  const [account, setAccount] = useState<VerificationIssuanceCurrentAccount | null>(null);
  const {
    clear,
    clearRememberedCredentials,
    keepAliveFailure,
    login,
    persistSessionFromResult,
    rememberedCredentials,
    session,
  } = useUpstreamSession({
    account,
    keepAlive: true,
  });
  const [directory, setDirectory] = useState<StaffDirectoryResult | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [staffInviteError, setStaffInviteError] = useState<string | null>(null);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [isRefreshingDirectory, setIsRefreshingDirectory] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [suggestedUpstreamLoginId, setSuggestedUpstreamLoginId] = useState('');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [requiresUpstreamSession, setRequiresUpstreamSession] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  const selectedTeacher = useMemo(
    () => directory?.teachers.find((teacher) => teacher.staffId === selectedStaffId) ?? null,
    [directory?.teachers, selectedStaffId],
  );

  const staffIdOptions = useMemo<TeacherSearchOption[]>(
    () =>
      (directory?.teachers ?? []).map((teacher) => buildTeacherOption(teacher, teacher.staffId)),
    [directory?.teachers],
  );

  const staffNameOptions = useMemo<TeacherSearchOption[]>(
    () => (directory?.teachers ?? []).map((teacher) => buildTeacherOption(teacher, teacher.name)),
    [directory?.teachers],
  );

  const selectTeacher = useCallback((teacher: StaffDirectoryEntry) => {
    setSelectedStaffId(teacher.staffId);
    return teacher;
  }, []);

  const refreshDirectory = useCallback(
    async (
      upstreamSessionToken: string,
      options: { forceRefresh?: boolean; sourceSession?: StoredUpstreamSession } = {},
    ) => {
      setIsRefreshingDirectory(true);
      setDirectoryError(null);
      setStaffInviteError(null);
      setRequiresUpstreamSession(false);

      try {
        const result = await populateStaffDirectory({
          forceRefresh: options.forceRefresh,
          upstreamSessionToken,
        });

        const sourceSession = options.sourceSession ?? session;

        if (sourceSession) {
          persistSessionFromResult(sourceSession, result);
        }

        setDirectory(result);
      } catch (error) {
        if (isExpiredUpstreamSessionError(error)) {
          clear();
          setRequiresUpstreamSession(true);
          setIsLoginOpen(true);
          setSuggestedUpstreamLoginId(
            options.sourceSession?.upstreamLoginId ?? session?.upstreamLoginId ?? '',
          );
        }

        setDirectoryError(resolveUpstreamErrorMessage(error, '暂时无法刷新教师字典。'));
      } finally {
        setIsRefreshingDirectory(false);
      }
    },
    [clear, persistSessionFromResult, session],
  );

  const loadDirectory = useCallback(async () => {
    setIsLoadingDirectory(true);
    setDirectoryError(null);

    try {
      const currentDirectory = await readStaffDirectory();

      setDirectory(currentDirectory);

      if (currentDirectory.cacheStatus !== 'MISS') {
        setRequiresUpstreamSession(false);
        return;
      }

      if (!session?.upstreamSessionToken) {
        setRequiresUpstreamSession(true);
        return;
      }

      await refreshDirectory(session.upstreamSessionToken);
    } catch (error) {
      setDirectoryError(resolveResultMessage(error, '暂时无法读取教师字典。'));
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [refreshDirectory, session?.upstreamSessionToken]);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentAccount() {
      try {
        const nextAccount = await fetchVerificationIssuanceCurrentAccount();

        if (isActive) {
          setAccount(nextAccount);
          setAccountError(null);
        }
      } catch (error) {
        if (isActive) {
          setAccountError(resolveResultMessage(error, '暂时无法读取当前账号。'));
        }
      }
    }

    void loadCurrentAccount();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!keepAliveFailure) {
      return;
    }

    setRequiresUpstreamSession(true);
    setDirectoryError(keepAliveFailure.message);
    setIsLoginOpen(true);
    setSuggestedUpstreamLoginId(keepAliveFailure.upstreamLoginId ?? '');
  }, [keepAliveFailure]);

  const openUpstreamLogin = useCallback(() => {
    setLoginError(null);
    setStaffInviteError(null);
    setIsLoginOpen(true);
    setSuggestedUpstreamLoginId(session?.upstreamLoginId ?? '');
  }, [session?.upstreamLoginId]);

  const refreshDirectoryFromAction = useCallback(() => {
    if (session?.upstreamSessionToken) {
      void refreshDirectory(session.upstreamSessionToken, { forceRefresh: true });
      return;
    }

    setRequiresUpstreamSession(true);
    openUpstreamLogin();
  }, [openUpstreamLogin, refreshDirectory, session?.upstreamSessionToken]);

  const resolveTeacherByStaffIdValue = useCallback(
    (value: string) => {
      const nextTeacher = directory?.teachers.find((teacher) => teacher.staffId === value.trim());

      if (nextTeacher) {
        return selectTeacher(nextTeacher);
      }

      setSelectedStaffId(null);
      return null;
    },
    [directory?.teachers, selectTeacher],
  );

  const resolveTeacherByStaffNameValue = useCallback(
    (value: string) => {
      const nextTeacher = directory?.teachers.find((teacher) => teacher.name === value.trim());

      if (nextTeacher) {
        return selectTeacher(nextTeacher);
      }

      setSelectedStaffId(null);
      return null;
    },
    [directory?.teachers, selectTeacher],
  );

  const selectTeacherOption = useCallback(
    (option: TeacherSearchOption) => {
      return selectTeacher({
        name: option.name,
        staffId: option.staffId,
      });
    },
    [selectTeacher],
  );

  const issueStaffInvite = useCallback(
    async (values: StaffInviteFormValues) => {
      setIsIssuing(true);
      onFeedback(null);
      setStaffInviteError(null);

      try {
        const result = await issueVerificationStaffInvite({
          invitedEmail: values.invitedEmail.trim(),
          staffId: values.staffId.trim(),
        });

        onFeedback({
          detail: `${selectedTeacher ? buildTeacherLabel(selectedTeacher) : values.staffId} -> ${
            values.invitedEmail
          }`,
          message: result.message || '教职工邀请已签发。',
          title: '教职工邀请已发送',
          type: 'staff-invite',
        });
      } catch (error) {
        setStaffInviteError(
          resolveStaffInviteFailureMessage({
            email: values.invitedEmail.trim(),
            error,
            fallback: '暂时无法发送教职工邀请。',
            teacher: selectedTeacher,
          }),
        );
        onFeedback(null);
      } finally {
        setIsIssuing(false);
      }
    },
    [onFeedback, selectedTeacher],
  );

  const submitUpstreamLogin = useCallback(
    async (values: UpstreamLoginCredentials) => {
      setIsSubmittingLogin(true);
      setLoginError(null);

      try {
        const nextSession = await login(values);

        setIsLoginOpen(false);
        setRequiresUpstreamSession(false);
        await refreshDirectory(nextSession.upstreamSessionToken, {
          sourceSession: nextSession,
        });
      } catch (error) {
        setLoginError(resolveUpstreamErrorMessage(error, '暂时无法登录校园网。'));
      } finally {
        setIsSubmittingLogin(false);
      }
    },
    [login, refreshDirectory],
  );

  return {
    accountError,
    directory,
    directoryError,
    filterTeacherOption,
    isIssuing,
    isLoadingDirectory,
    isLoginOpen,
    isRefreshingDirectory,
    isSubmittingLogin,
    loginError,
    openUpstreamLogin,
    clearRememberedCredentials,
    refreshDirectoryFromAction,
    requiresUpstreamSession,
    rememberedCredentials,
    resolveTeacherByStaffIdValue,
    resolveTeacherByStaffNameValue,
    selectTeacherOption,
    selectedTeacher,
    setIsLoginOpen,
    staffIdOptions,
    staffInviteError,
    staffNameOptions,
    suggestedUpstreamLoginId,
    submitUpstreamLogin,
    issueStaffInvite,
  };
}
