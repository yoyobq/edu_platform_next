import { executeGraphQL } from '@/shared/graphql';

type SstsPayloadDebugResultDTO = {
  encryptedData: string;
  operation: string;
  plainTextData: unknown;
};

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

export async function requestPayloadEncryption(payload: string): Promise<string> {
  try {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return 'Error encrypting payload: Invalid JSON input format';
    }

    const data = await executeGraphQL<
      { debugEncryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { plainTextData: unknown } }
    >(ENCRYPT_QUERY, { input: { plainTextData: parsedPayload } });

    return data.debugEncryptSstsPayload.encryptedData;
  } catch (err: unknown) {
    return `Error encrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

export async function requestPayloadDecryption(payload: string): Promise<string> {
  try {
    const data = await executeGraphQL<
      { debugDecryptSstsPayload: SstsPayloadDebugResultDTO },
      { input: { encryptedData: string } }
    >(DECRYPT_QUERY, { input: { encryptedData: payload } });

    return JSON.stringify(data.debugDecryptSstsPayload.plainTextData, null, 2);
  } catch (err: unknown) {
    return `Error decrypting payload: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}
