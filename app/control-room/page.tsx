import Image from "next/image";
import { requireChatGPTUser } from "../chatgpt-auth";
import ControlRoomApp from "../components/ControlRoomApp";
import AppNav from "../components/AppNav";
import { hasControlRoomPageAccess } from "../lib/control-room-auth";
import "../control-room-flow.css";

export const dynamic = "force-dynamic";

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ControlRoomPage() {
  const user = await requireChatGPTUser("/control-room");
  if (!hasControlRoomPageAccess(user)) {
    return <div className="control-room-denied">
      <Image src="/jeongilpum-logo.png" width={64} height={64} alt="정일품 정육식당 로고" />
      <small>ADMINISTRATOR ONLY</small>
      <h1>종합통제실 관리자 권한이 필요합니다</h1>
      <p>현재 로그인 계정이 운영자와 통제실 관리자 목록에 모두 등록되어야 합니다.</p>
      <a href="/sales">판매장으로 돌아가기</a>
      <AppNav current="control-room" />
    </div>;
  }
  return <ControlRoomApp initialDate={todayInSeoul()} />;
}

