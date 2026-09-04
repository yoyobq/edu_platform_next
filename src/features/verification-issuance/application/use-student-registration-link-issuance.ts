// src/features/verification-issuance/application/use-student-registration-link-issuance.ts

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  issueVerificationStudentRegistrationLink,
  requestVerificationIssuanceClassOptions,
  type VerificationIssuanceClassOption,
  type VerificationStudentRegistrationLinkResult,
} from '../infrastructure/verification-issuance-api';

import {
  resolveResultMessage,
  type VerificationIssuanceFeedback,
} from './verification-issuance-feedback';

export type StudentRegistrationLinkIssuanceFormValues = {
  classCode: string;
};

export function buildVerificationIssuanceClassLabel(option: VerificationIssuanceClassOption) {
  return `${option.className}（${option.classCode}）`;
}

export function useStudentRegistrationLinkIssuance(input: {
  onFeedback: (feedback: VerificationIssuanceFeedback) => void;
}) {
  const { onFeedback } = input;
  const [classOptions, setClassOptions] = useState<VerificationIssuanceClassOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [result, setResult] = useState<VerificationStudentRegistrationLinkResult | null>(null);

  const selectOptions = useMemo(
    () =>
      classOptions.map((option) => ({
        label: buildVerificationIssuanceClassLabel(option),
        value: option.classCode,
      })),
    [classOptions],
  );

  const loadClassOptions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      setClassOptions(await requestVerificationIssuanceClassOptions());
    } catch (error) {
      setLoadError(resolveResultMessage(error, '暂时无法加载班级列表。'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClassOptions();
  }, [loadClassOptions]);

  const issueLink = useCallback(
    async (values: StudentRegistrationLinkIssuanceFormValues) => {
      setIsIssuing(true);
      setSubmitError(null);
      setResult(null);
      onFeedback(null);

      try {
        const issued = await issueVerificationStudentRegistrationLink({
          classCode: values.classCode,
        });
        setResult(issued);
        onFeedback({
          detail: `${issued.classCode} -> ${issued.link}`,
          message: '已签发班级共享链接，学生注册后仍需完成邮箱验证。',
          title: '学生注册链接已签发',
          type: 'student-registration-link',
        });
        return true;
      } catch (error) {
        setSubmitError(resolveResultMessage(error, '暂时无法签发班级共享注册链接。'));
        return false;
      } finally {
        setIsIssuing(false);
      }
    },
    [onFeedback],
  );

  return {
    isIssuing,
    isLoading,
    issueLink,
    loadClassOptions,
    loadError,
    result,
    selectOptions,
    submitError,
  };
}
