declare module "next" {
  export type Metadata = {
    metadataBase?: URL;
    title?: string;
    description?: string;
    icons?: unknown;
    openGraph?: unknown;
    twitter?: unknown;
  };
}

declare module "next/headers" {
  export function headers(): Promise<Headers>;
}

declare module "next/navigation" {
  export function redirect(url: string): never;
}

declare module "next/image" {
  import type { ComponentType, ImgHTMLAttributes } from "react";

  const Image: ComponentType<ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    width?: number;
    height?: number;
    unoptimized?: boolean;
  }>;

  export default Image;
}
