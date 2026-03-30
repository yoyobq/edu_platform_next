// src/app/layout/use-media-query.ts

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);

    // 使用 setTimeout 或者 requestAnimationFrame 来避免同步调用 setState
    if (media.matches !== matches) {
      const timeoutId = setTimeout(() => {
        setMatches(media.matches);
      }, 0);

      const listener = () => setMatches(media.matches);
      media.addEventListener('change', listener);

      return () => {
        clearTimeout(timeoutId);
        media.removeEventListener('change', listener);
      };
    }

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query, matches]);

  return matches;
}
