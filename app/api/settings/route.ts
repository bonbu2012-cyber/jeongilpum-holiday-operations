import { env } from "cloudflare:workers";
import { resolveCatalogProductImageUrl } from "../../lib/catalog-product-images";
import { requireOperatorApi } from "../../lib/operator-session";

const PRODUCT_CATEGORIES = ["진공세트", "프리미엄", "O'meat", "LA갈비", "뼈세트", "맞춤주문"] as const;

type ProductRevisionRow = {
  id: string;
  active: number;
  image_url: string | null;
  sort_order: number;
  updated_at: string;
};

type InactiveProductRow = {
  id: string;
  category: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  display_weight: string | null;
  image_url: string | null;
  badge: string | null;
  daily_limit: number | null;
  sort_order: number;
  active: number;
  updated_at: string;
  reserved_quantity: number;
};

type ProductPatchPayload = Record<string, unknown>;

const runtimeEnv = env as typeof env & { DB: D1Database };

function todayInSeoul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nullableText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim() || null;
}

function isNonnegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function inactiveProduct(row: InactiveProductRow) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    subtitle: row.subtitle,
    description: row.description,
    price: row.price,
    displayWeight: row.display_weight,
    imageUrl: row.image_url,
    previewImageUrl: resolveCatalogProductImageUrl(row.id, row.image_url),
    badge: row.badge,
    dailyLimit: row.daily_limit,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    version: row.updated_at,
    reservedQuantity: row.reserved_quantity,
  };
}

export async function GET() {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const today = todayInSeoul();
    const [revisions, inactiveProducts] = await Promise.all([
      runtimeEnv.DB.prepare(`
        SELECT id, active, image_url, sort_order, updated_at
        FROM products
        ORDER BY sort_order, id
      `).all<ProductRevisionRow>(),
      runtimeEnv.DB.prepare(`
        SELECT
          p.id, p.category, p.name, p.subtitle, p.description, p.price,
          p.display_weight, p.image_url, p.badge, p.daily_limit, p.sort_order,
          p.active, p.updated_at, COALESCE(SUM(w.quantity), 0) AS reserved_quantity
        FROM products p
        LEFT JOIN work_items w
          ON w.product_id = p.id
          AND date(w.due_at) = ?
          AND w.work_status != 'cancelled'
        WHERE p.active = 0
        GROUP BY p.id
        ORDER BY p.sort_order, p.id
      `).bind(today).all<InactiveProductRow>(),
    ]);

    return Response.json(
      {
        productRevisions: revisions.results.map((row) => ({
          id: row.id,
          active: Boolean(row.active),
          imageUrl: row.image_url,
          sortOrder: row.sort_order,
          version: row.updated_at,
        })),
        inactiveProducts: inactiveProducts.results.map(inactiveProduct),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "상품 수정 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = await request.json().catch(() => null) as ProductPatchPayload | null;
    if (!payload || typeof payload !== "object") {
      return Response.json({ error: "상품 입력값을 확인해주세요." }, { status: 400 });
    }
    const id = text(payload.id);
    const expectedVersion = text(payload.expectedVersion);
    const category = text(payload.category);
    const name = text(payload.name);
    const subtitle = text(payload.subtitle);
    const description = text(payload.description);
    const displayWeight = nullableText(payload.displayWeight);
    const imageUrl = nullableText(payload.imageUrl);
    const badge = nullableText(payload.badge);
    const dailyLimit = payload.dailyLimit;

    if (
      payload.type !== "product"
      || !id
      || !expectedVersion
      || !category
      || !PRODUCT_CATEGORIES.includes(category as typeof PRODUCT_CATEGORIES[number])
      || !name
      || subtitle === undefined
      || description === undefined
      || displayWeight === undefined
      || imageUrl === undefined
      || badge === undefined
      || !isNonnegativeInteger(payload.price)
      || !isNonnegativeInteger(payload.sortOrder)
      || typeof payload.active !== "boolean"
      || (dailyLimit !== null && !isNonnegativeInteger(dailyLimit))
    ) {
      return Response.json({ error: "상품 입력값을 확인해주세요." }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    const update = await runtimeEnv.DB.prepare(`
      UPDATE products
      SET
        category = ?,
        name = ?,
        subtitle = ?,
        description = ?,
        price = ?,
        display_weight = ?,
        image_url = ?,
        badge = ?,
        daily_limit = ?,
        sort_order = ?,
        active = ?,
        updated_at = ?
      WHERE id = ? AND updated_at = ?
    `).bind(
      category,
      name,
      subtitle,
      description,
      payload.price,
      displayWeight,
      imageUrl,
      badge,
      dailyLimit,
      payload.sortOrder,
      payload.active ? 1 : 0,
      updatedAt,
      id,
      expectedVersion,
    ).run();

    if (update.meta.changes) {
      return Response.json({ ok: true, version: updatedAt, updatedAt });
    }

    const existing = await runtimeEnv.DB.prepare("SELECT id FROM products WHERE id = ?")
      .bind(id)
      .first<{ id: string }>();
    if (!existing) return Response.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ error: "다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요." }, { status: 409 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "상품을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
