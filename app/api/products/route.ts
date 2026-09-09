import { env } from "cloudflare:workers";
import { DEFAULT_KIOSK_HEADLINE, parseStoredSetting } from "../../lib/app-settings";
import { resolveCatalogProductDetails } from "../../lib/catalog-product-details";
import { resolveCatalogProductImageUrl } from "../../lib/catalog-product-images";
import { latestProductAvailability } from "../../lib/product-availability";

type ProductRow = {
  id: string;
  category: string;
  code: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  display_weight: string | null;
  imageUrl: string | null;
  badge: string | null;
  daily_limit: number | null;
  sort_order: number;
  active: number;
  reserved_quantity: number;
};
type ComponentRow = { product_id: string; component_name: string };
type SettingRow = { after_data: string | null };
type AvailabilityRow = { id: string; entity_id: string; after_data: string | null };
type SeasonRow = {
  id: string;
  name: string;
  holiday_date: string;
  sales_start_date: string;
  sales_end_date: string;
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
    const [result, components, headline, availability, season] = await Promise.all([
      runtimeEnv.DB.prepare(`
        SELECT
          p.id,p.category,p.code,p.name,p.subtitle,p.description,p.price,
          p.display_weight,p.image_url AS imageUrl,p.badge,p.daily_limit,p.sort_order,p.active,
          COALESCE(SUM(w.quantity),0) AS reserved_quantity
        FROM products p
        LEFT JOIN work_items w
          ON w.product_id=p.id
          AND date(w.due_at)=?
          AND w.work_status!='cancelled'
        WHERE p.active=1
        GROUP BY p.id
        ORDER BY p.sort_order,p.id
      `).bind(availabilityDate).all<ProductRow>(),
      runtimeEnv.DB.prepare(`
        SELECT product_id,component_name
        FROM product_components
        WHERE active=1
        ORDER BY product_id,sort_order
      `).all<ComponentRow>(),
      runtimeEnv.DB.prepare(`
        SELECT after_data
        FROM configuration_events
        WHERE entity_type='app_setting' AND entity_id='kiosk_headline'
        ORDER BY created_at DESC,id DESC
        LIMIT 1
      `).first<SettingRow>(),
      runtimeEnv.DB.prepare(`
        SELECT id,entity_id,after_data
        FROM configuration_events
        WHERE entity_type='product_availability'
        ORDER BY created_at DESC,id DESC
      `).all<AvailabilityRow>(),
      runtimeEnv.DB.prepare(`
        SELECT id,name,holiday_date,sales_start_date,sales_end_date
        FROM sales_seasons
        WHERE active=1
        ORDER BY sales_start_date DESC
        LIMIT 1
      `).first<SeasonRow>(),
    ]);
    const componentNames = new Map<string, string[]>();
    for (const component of components.results) {
      const names = componentNames.get(component.product_id) ?? [];
      names.push(component.component_name);
      componentNames.set(component.product_id, names);
    }
    const availabilityByProduct = latestProductAvailability(availability.results.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      afterData: row.after_data,
    })));

    return Response.json(
      {
        products: result.results.map((product) => {
          const catalogDetails = resolveCatalogProductDetails(product);
          const soldOut = availabilityByProduct.get(product.id)?.soldOut ?? false;
          const remainingQuantity = soldOut
            ? 0
            : product.daily_limit === null
              ? null
              : Math.max(0, product.daily_limit - product.reserved_quantity);
          return {
            id: product.id,
            category: product.category,
            code: product.code,
            name: product.name,
            subtitle: catalogDetails?.tagline ?? product.subtitle,
            description: product.id === "bonghwang"
              ? "진공포장으로 필요한 만큼 나누어 보관할 수 있고 여러 구이용 부위의 맛과 식감을 고르게 즐길 수 있습니다. 20만원대 한우 선물을 찾으신다면 정일품이 가장 먼저 추천하는 구성입니다."
              : product.description,
            price: product.price,
            ...(catalogDetails ? {
              customerDisplayWeight: [catalogDetails.servings, `총 ${catalogDetails.totalWeight}`].filter(Boolean).join(" · "),
              cutNames: catalogDetails.components,
              servings: catalogDetails.servings,
              totalWeight: catalogDetails.totalWeight,
            } : {
              customerDisplayWeight: product.display_weight,
              cutNames: componentNames.get(product.id) ?? [],
              servings: null,
              totalWeight: product.display_weight,
            }),
            imageUrl: resolveCatalogProductImageUrl(product.id, product.imageUrl),
            badge: product.id === "bonghwang" ? "정일품 추천" : product.badge,
            dailyLimit: product.daily_limit,
            reservedQuantity: product.reserved_quantity,
            soldOut,
            remainingQuantity,
            availabilityDate,
          };
        }),
        activeSeason: season
          ? {
            id: season.id,
            name: season.name,
            holidayDate: season.holiday_date,
            salesStartDate: season.sales_start_date,
            salesEndDate: season.sales_end_date,
          }
          : {
            salesStartDate: today,
            salesEndDate: addDays(today, KIOSK_SCHEDULE_DAYS),
          },
        appSettings: {
          kioskHeadline: parseStoredSetting(headline?.after_data, DEFAULT_KIOSK_HEADLINE),
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
