import { env } from "cloudflare:workers";
import { requireOperatorApi } from "../../../lib/operator-session";
import {
  TRACKED_SET_PRODUCTS,
  aggregateDailySkinPackRequirements,
  type SetDemand,
} from "../../../lib/daily-skin-pack-requirements";

type DemandRow = {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
};

const runtimeEnv = env as typeof env & { DB: D1Database };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";
  if (!validDate(date)) {
    return Response.json({ error: "조회 날짜 형식을 확인해주세요." }, { status: 400 });
  }

  try {
    const productIds = TRACKED_SET_PRODUCTS.map((product) => product.id);
    const rows = await runtimeEnv.DB.prepare(`
      SELECT
        oi.product_id,
        oi.product_name_snapshot,
        SUM(oi.quantity) AS quantity
      FROM orders o
      JOIN fulfillments f ON f.order_id=o.id
      JOIN order_items oi ON oi.order_id=o.id
      WHERE o.order_status!='cancelled'
        AND oi.product_id IN (${productIds.map(() => "?").join(",")})
        AND (
          (f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?)
          OR (f.fulfillment_type='shipping' AND f.ship_date=?)
        )
      GROUP BY oi.product_id,oi.product_name_snapshot
      ORDER BY oi.product_name_snapshot COLLATE NOCASE,oi.product_id
    `).bind(...productIds, date, date).all<DemandRow>();
    const demands: SetDemand[] = rows.results.map((row) => ({
      productId: row.product_id,
      productName: row.product_name_snapshot,
      quantity: Number(row.quantity),
    }));

    return Response.json({ date, ...aggregateDailySkinPackRequirements(demands) }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "오늘 스킨팩 필요량을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
