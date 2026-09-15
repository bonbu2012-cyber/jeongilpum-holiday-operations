import TodayLedgerApp from "./TodayLedgerApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/operator-fonts.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "오늘의 장부 - 정일품",
  description: "오늘의 방문수령 및 택배발송 주문을 큰 글씨로 확인하는 디지털 간편 장부",
};

export default async function TodayLedgerPage() {
  if (!(await hasOperatorSession())) {
    return <PasscodeGate />;
  }

  return <TodayLedgerApp />;
}
