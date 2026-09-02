import { env } from "cloudflare:workers";
import { DEFAULT_KIOSK_HEADLINE } from "../../lib/app-settings";
import { resolveCatalogProductImageUrl } from "../../lib/catalog-product-images";

type ProductRow = {
  id: string;
  category: string;
  code: string;
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
  reserved_quantity: number;
};

const runtimeEnv = env as typeof env & { DB: D1Database };
const KIOSK_SCHEDULE_DAYS = 365;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

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

function validIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const today = todayInSeoul();
    const requestedDate = new URL(request.url).searchParams.get("date")?.trim() ?? "";
    const availabilityDate = validIsoDate(requestedDate) ? requestedDate : today;
    const result = await runtimeEnv.DB.prepare(`
      SELECT
        p.id,p.category,p.code,p.name,p.subtitle,p.description,p.price,
        p.display_weight,p.image_url,p.badge,p.daily_limit,p.sort_order,p.active,
        COALESCE(SUM(w.quantity),0) AS reserved_quantity
      FROM products p
      LEFT JOIN work_items w
        ON w.product_id=p.id
        AND date(w.due_at)=?
        AND w.work_status!='cancelled'
      WHERE p.active=1
      GROUP BY p.id
      ORDER BY p.sort_order,p.id
    `).bind(availabilityDate).all<ProductRow>();

    return Response.json(
      {
        products: result.results.map((product) => ({
          id: product.id,
          category: product.category,
          code: product.code,
          name: product.name,
          subtitle: product.subtitle,
          description: product.description,
          price: product.price,
          customerDisplayWeight: product.display_weight,
          imageUrl: resolveCatalogProductImageUrl(product.id, product.image_url),
          badge: product.badge,
          dailyLimit: product.daily_limit,
          reservedQuantity: product.reserved_quantity,
          remainingQuantity: product.daily_limit === null
            ? null
            : Math.max(0, product.daily_limit - product.reserved_quantity),
          availabilityDate,
        })),
        activeSeason: {
          salesStartDate: today,
          salesEndDate: addDays(today, KIOSK_SCHEDULE_DAYS),
        },
        appSettings: {
          kioskHeadline: DEFAULT_KIOSK_HEADLINE,
        },
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
