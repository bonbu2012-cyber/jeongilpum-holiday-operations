/// <reference types="vite/client" />
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isLocalPreviewActor } from "../../lib/local-preview-auth";

const runtimeEnv = env as typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};

function configured(value: string | undefined) {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}
function isOperator(user: { userId: string; email: string }) {
  return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)
    || configured(runtimeEnv.OPERATOR_EMAILS)
      .map((value) => value.toLowerCase())
      .includes(user.email.toLowerCase());
}
function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isOperator(user) && !isLocalPreviewActor(user.userId, request.url, import.meta.env.DEV)) {
    return Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 });
  }
  const requestedDate = new URL(request.url).searchParams.get("date") ?? todayInSeoul();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
  }
  const result = await runtimeEnv.DB.prepare(`
    SELECT
      p.id AS productId,
      p.name AS productName,
      limits.daily_limit AS dailyLimit,
      COALESCE(SUM(CASE WHEN reservations.status='active' THEN reservations.quantity ELSE 0 END), 0) AS reservedQuantity
    FROM product_daily_limits AS limits
    JOIN products AS p ON p.id=limits.product_id
    LEFT JOIN product_daily_reservations AS reservations
      ON reservations.product_id=limits.product_id
      AND reservations.reserve_date=?
    WHERE limits.active=1
    GROUP BY p.id,p.name,limits.daily_limit,p.display_order
    ORDER BY p.display_order
  `).bind(requestedDate).all<{
    productId: string;
    productName: string;
    dailyLimit: number;
    reservedQuantity: number;
  }>();
  return Response.json({
    date: requestedDate,
    products: result.results.map((row) => ({
      ...row,
      remainingQuantity: Math.max(0, row.dailyLimit - row.reservedQuantity),
    })),
  }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
