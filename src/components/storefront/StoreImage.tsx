"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

const STUDIO_BLUR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F8F4F2"/><stop offset="100%" stop-color="#EDE4E0"/></linearGradient></defs><rect width="8" height="10" fill="url(#g)"/></svg>';

const STUDIO_BLUR_DATA_URL = `data:image/svg+xml;base64,${
  typeof Buffer !== "undefined"
    ? Buffer.from(STUDIO_BLUR_SVG).toString("base64")
    : btoa(STUDIO_BLUR_SVG)
}`;

type StoreImageProps = {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  fallback: ReactNode;
};

export function StoreImage({
  src,
  alt,
  sizes,
  className,
  loading = "lazy",
  fallback,
}: StoreImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading={loading}
      placeholder="blur"
      blurDataURL={STUDIO_BLUR_DATA_URL}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
