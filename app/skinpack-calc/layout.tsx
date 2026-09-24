import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "정일품 스킨팩 생산 계산기 | 모바일 작업지시서",
  description: "봉황, 팔영, 오미트 시그니처, 오미트 프레스티지 세트 수량 입력 기반 실시간 162202/241702 스킨팩 필요 팩수 산출기",
};

export default function SkinpackCalcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="skinpack-calc-root">
      {children}
    </div>
  );
}
