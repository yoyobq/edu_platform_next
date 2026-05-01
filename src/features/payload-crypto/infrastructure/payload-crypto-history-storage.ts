import {
  PAYLOAD_CRYPTO_HISTORY_LIMIT,
  type PayloadCryptoHistoryItem,
} from '../application/history';

const PAYLOAD_CRYPTO_HISTORY_STORAGE_KEY = 'aigc-friendly-frontend.payload-crypto.history.v1';

function isPayloadCryptoHistoryItem(value: unknown): value is PayloadCryptoHistoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PayloadCryptoHistoryItem>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.input === 'string' &&
    (candidate.name === undefined || typeof candidate.name === 'string') &&
    (candidate.operation === 'decrypt' || candidate.operation === 'encrypt') &&
    typeof candidate.updatedAt === 'string'
  );
}

export function readPayloadCryptoHistory(): PayloadCryptoHistoryItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(PAYLOAD_CRYPTO_HISTORY_STORAGE_KEY);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue.filter(isPayloadCryptoHistoryItem).slice(0, PAYLOAD_CRYPTO_HISTORY_LIMIT)
      : [];
  } catch {
    window.localStorage.removeItem(PAYLOAD_CRYPTO_HISTORY_STORAGE_KEY);
    return [];
  }
}

export function writePayloadCryptoHistory(items: readonly PayloadCryptoHistoryItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    PAYLOAD_CRYPTO_HISTORY_STORAGE_KEY,
    JSON.stringify(items.slice(0, PAYLOAD_CRYPTO_HISTORY_LIMIT)),
  );
}

export function clearPayloadCryptoHistory() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PAYLOAD_CRYPTO_HISTORY_STORAGE_KEY);
}
