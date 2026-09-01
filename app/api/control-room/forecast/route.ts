import { requireControlRoomApiAccess, controlRoomEnv, controlRoomNoStoreHeaders } from "../../../lib/control-room-auth";
import { loadControlRoomForecast } from "../../../lib/control-room-data";
import { isValidOperationalDate } from "../../../lib/operational-date";

export async function GET(request: Request) {
  const access = await requireControlRoomApiAccess(request);
  if ("response" in access) return access.response;
  const params = new URL(request.url).searchParams;
  const startDate = params.get("startDate")?.trim() ?? "";
  const days = Number(params.get("days") ?? "7");
  if (!isValidOperationalDate(startDate) || !Number.isInteger(days) || days < 1 || days > 7) {
    return Response.json({ error: "전망 시작일과 조회기간을 확인해주세요." }, { status: 400, headers: controlRoomNoStoreHeaders });
  }
  try {
    return Response.json(await loadControlRoomForecast(controlRoomEnv.DB, startDate, days), { headers: controlRoomNoStoreHeaders });
  } catch {
    return Response.json({ error: "7일 운영전망을 불러오지 못했습니다." }, { status: 500, headers: controlRoomNoStoreHeaders });
  }
}

