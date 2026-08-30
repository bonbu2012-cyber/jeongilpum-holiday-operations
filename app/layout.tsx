import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://jeongilpum-chuseok-mvp.bonbu2012.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "정일품 정육식당 | 선물 주문·운영",
  description: "정일품 정육식당의 선물 주문부터 판매장·작업장 운영까지 안전하게 연결합니다.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "정일품 정육식당",
    description: "선물 주문부터 수령까지 정성스럽게",
    url: siteUrl,
    siteName: "정일품 정육식당",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/jeongilpum-social.png", width: 1200, height: 630, alt: "정일품 정육식당" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "정일품 정육식당",
    description: "선물 주문부터 수령까지 정성스럽게",
    images: ["/jeongilpum-social.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}