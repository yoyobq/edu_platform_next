const AUTH_REFRESH_FEEDBACK_FLASH_KEY = 'platform_next.auth_refresh_feedback_flash';
const REFRESH_FAILED_MESSAGE = '登录状态已失效，请重新登录';
const REFRESH_RECOVERED_MESSAGE = '已为你更新登录状态';

type AuthRefreshFeedbackFlash = {
  content: string;
  type: 'error' | 'success';
};

export function readAuthRefreshFeedbackFlash(): AuthRefreshFeedbackFlash | null {
  const raw = window.sessionStorage.getItem(AUTH_REFRESH_FEEDBACK_FLASH_KEY);

  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(AUTH_REFRESH_FEEDBACK_FLASH_KEY);

  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.content === 'string' &&
      (parsed.type === 'error' || parsed.type === 'success')
    ) {
      return {
        content: parsed.content,
        type: parsed.type,
      };
    }
  } catch {
    // Ignore malformed flash payloads and fall back to null.
  }

  return null;
}

export function queueAuthRefreshFailureMessage(content = REFRESH_FAILED_MESSAGE) {
  window.sessionStorage.setItem(
    AUTH_REFRESH_FEEDBACK_FLASH_KEY,
    JSON.stringify({
      content,
      type: 'error',
    } satisfies AuthRefreshFeedbackFlash),
  );
}

export function queueAuthRefreshRecoveredMessage(content = REFRESH_RECOVERED_MESSAGE) {
  window.sessionStorage.setItem(
    AUTH_REFRESH_FEEDBACK_FLASH_KEY,
    JSON.stringify({
      content,
      type: 'success',
    } satisfies AuthRefreshFeedbackFlash),
  );
}
