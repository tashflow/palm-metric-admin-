import React, { useEffect, useState } from 'react';
import {
  FIRESTORE_MEDIA_PREFIX,
  resolveMediaUrl,
  resolvedMediaCache,
} from '../lib/firebase';

export function useResolvedMediaUrl(src?: string | null): {
  resolvedUrl: string;
  resolving: boolean;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!src) return '';
    if (!src.startsWith(FIRESTORE_MEDIA_PREFIX)) return src;
    return resolvedMediaCache.get(src) || '';
  });

  const [resolving, setResolving] = useState<boolean>(() => {
    if (!src) return false;
    if (!src.startsWith(FIRESTORE_MEDIA_PREFIX)) return false;
    return !resolvedMediaCache.has(src);
  });

  useEffect(() => {
    if (!src) {
      setResolvedUrl('');
      setResolving(false);
      return;
    }

    if (!src.startsWith(FIRESTORE_MEDIA_PREFIX)) {
      setResolvedUrl(src);
      setResolving(false);
      return;
    }

    const cached = resolvedMediaCache.get(src);
    if (cached) {
      setResolvedUrl(cached);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    void resolveMediaUrl(src).then((url) => {
      if (!cancelled) {
        setResolvedUrl(url);
        setResolving(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return { resolvedUrl, resolving };
}

interface ResolvedImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
}

export function ResolvedImage({ src, alt, className, onError, ...rest }: ResolvedImageProps) {
  const { resolvedUrl, resolving } = useResolvedMediaUrl(src);

  if (resolving || !resolvedUrl) {
    return <div className={`bg-[#E8EFEA] ${className || ''}`} aria-hidden="true" />;
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      onError={onError}
      className={className}
      {...rest}
    />
  );
}

interface ResolvedVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src?: string | null;
}

export function ResolvedVideo({ src, className, ...rest }: ResolvedVideoProps) {
  const { resolvedUrl } = useResolvedMediaUrl(src);

  if (!resolvedUrl) {
    return <div className={`bg-[#162019] ${className || ''}`} aria-hidden="true" />;
  }

  return <video src={resolvedUrl} className={className} {...rest} />;
}
