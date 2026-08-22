import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "정일품 | 명절 선물 예약·운영",
  description: "정일품 명절 선물세트 주문부터 작업, 수령까지 한 번에 관리합니다.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}