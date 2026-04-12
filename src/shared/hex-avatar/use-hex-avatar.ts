import { useEffect, useState } from 'react';

import { generateHexAvatarSvg } from './index';

const cache = new Map<string, string>();

export function useHexAvatar(accountId: number | string | null | undefined): {
  svgDataUri: string | null;
  loading: boolean;
} {
  const key = accountId != null ? String(accountId) : null;
  const [generatedUris, setGeneratedUris] = useState<Record<string, string>>({});

  useEffect(() => {
    if (key == null || cache.has(key)) return;

    let cancelled = false;
    generateHexAvatarSvg(key).then((svg) => {
      const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      cache.set(key, uri);
      if (!cancelled) {
        setGeneratedUris((prev) => ({ ...prev, [key]: uri }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const svgDataUri = key != null ? (cache.get(key) ?? generatedUris[key] ?? null) : null;
  const loading = key != null && svgDataUri == null;

  return { svgDataUri, loading };
}
