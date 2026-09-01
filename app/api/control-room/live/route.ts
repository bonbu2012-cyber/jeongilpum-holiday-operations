import { requireControlRoomApiAccess, controlRoomEnv, controlRoomNoStoreHeaders } from "../../../lib/control-room-auth";
import { loadControlRoomLive } from "../../../lib/control-room-data";
import { isValidOperationalDate } from "../../../lib/operational-date";

export async function GET(request: Request) {
  const access = await requireControlRoomApiAccess(request);
  if ("response" in access) return access.response;
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!isValidOperationalDate(date)) {
    return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400, headers: controlRoomNoStoreHeaders });
  }
  try {
    return Response.json(await loadControlRoomLive(controlRoomEnv.DB, date, access.user.userId), { headers: controlRoomNoStoreHeaders });
  } catch {
    return Response.json({ error: "종합 운영현황을 불러오지 못했습니다." }, { status: 500, headers: controlRoomNoStoreHeaders });
  }
}

