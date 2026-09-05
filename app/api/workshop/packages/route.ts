import { env } from "cloudflare:workers";
import { requireOperatorApi } from "../../../lib/operator-session";

type PackageRow = {
  id: string;
  package_code: string;
  product_name_snapshot: string;
  package_status: string;
  work_item_id: string | null;
  order_no: string | null;
  delivery_method: "onsite_reservation" | "onsite_sale" | "delivery" | null;
  due_at: string | null;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

export async function GET() {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const result = await runtimeEnv.DB.prepare(`
      SELECT
        p.id,p.package_code,p.product_name_snapshot,p.package_status,p.work_item_id,
        o.order_no,w.delivery_method,w.due_at
      FROM packages p
      LEFT JOIN work_items w ON w.id=p.work_item_id
      LEFT JOIN orders o ON o.id=w.order_id
      ORDER BY p.updated_at DESC,p.id DESC
      LIMIT 500
    `).all<PackageRow>();
    return Response.json({
      packages: result.results.map((row) => ({
        id: row.id,
        packageCode: row.package_code,
        productName: row.product_name_snapshot,
        packageStatus: row.package_status,
        workItemId: row.work_item_id,
        orderNo: row.order_no,
        schedule: row.due_at
          ? row.delivery_method === "delivery"
            ? `${row.due_at.slice(0, 10)} 택배`
            : `${row.due_at.slice(0, 10)} ${row.due_at.slice(11, 16)} 현장`
          : "수동 패키지",
      })),
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "패키지 목록을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
