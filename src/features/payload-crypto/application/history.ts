export type PayloadCryptoOperation = 'decrypt' | 'encrypt';

export type PayloadCryptoHistoryItem = {
  id: string;
  input: string;
  name?: string;
  operation: PayloadCryptoOperation;
  updatedAt: string;
};

export const PAYLOAD_CRYPTO_HISTORY_LIMIT = 8;

export function getPayloadOperation(input: string): PayloadCryptoOperation {
  try {
    JSON.parse(input);
    return 'encrypt';
  } catch {
    return 'decrypt';
  }
}

export function buildPayloadCryptoHistoryItem(input: {
  existingItem?: PayloadCryptoHistoryItem;
  payload: string;
}): PayloadCryptoHistoryItem {
  const operation = getPayloadOperation(input.payload);

  return {
    id: `${operation}:${input.payload}`,
    input: input.payload,
    name: input.existingItem?.name,
    operation,
    updatedAt: new Date().toISOString(),
  };
}

export function upsertPayloadCryptoHistoryItem(
  items: readonly PayloadCryptoHistoryItem[],
  item: PayloadCryptoHistoryItem,
) {
  return [item, ...items.filter((currentItem) => currentItem.id !== item.id)].slice(
    0,
    PAYLOAD_CRYPTO_HISTORY_LIMIT,
  );
}
