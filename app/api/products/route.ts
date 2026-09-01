import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  configurationEvents,
  productDailyLimits,
  productDailyReservations,
  products,
  salesSeasons,
} from "../../../db/schema";
import { DEFAULT_KIOSK_HEADLINE, parseStoredSetting } from "../../lib/app-settings";
import { resolveCatalogProductImageUrl } from "../../lib/catalog-product-images";

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const availabilityDate = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
      ? (url.searchParams.get("date") as string)
      : todayInSeoul();
    const db = getDb();
    const [productRows, seasonRows, headlineRows] = await Promise.all([
      db
        .select({
          product: products,
          dailyLimit: productDailyLimits.dailyLimit,
          reservedQuantity: sql<number>`coalesce(sum(${productDailyReservations.quantity}), 0)`,
        })
        .from(products)
        .leftJoin(
          productDailyLimits,
          and(
            eq(productDailyLimits.productId, products.id),
            eq(productDailyLimits.active, true),
          ),
        )
        .leftJoin(
          productDailyReservations,
          and(
            eq(productDailyReservations.productId, products.id),
            eq(productDailyReservations.reserveDate, availabilityDate),
            eq(productDailyReservations.status, "active"),
          ),
        )
        .where(eq(products.active, true))
        .groupBy(products.id, productDailyLimits.dailyLimit)
        .orderBy(asc(products.displayOrder)),
      db
        .select()
        .from(salesSeasons)
        .where(eq(salesSeasons.active, true))
        .orderBy(desc(salesSeasons.salesStartDate))
        .limit(1),
      db
        .select({ afterData: configurationEvents.afterData })
        .from(configurationEvents)
        .where(
          and(
            eq(configurationEvents.entityType, "app_setting"),
            eq(configurationEvents.entityId, "kiosk_headline"),
          ),
        )
        .orderBy(desc(configurationEvents.createdAt), desc(configurationEvents.id))
        .limit(1),
    ]);

    const season = seasonRows[0];
    const activeSeason = season
      ? {
          id: season.id,
          name: season.name,
          holidayDate: season.holidayDate,
          salesStartDate: season.salesStartDate,
          salesEndDate: season.salesEndDate,
        }
      : null;
    const productResponse = productRows.map(({ product, dailyLimit, reservedQuantity }) => ({
      ...product,
      imageUrl: resolveCatalogProductImageUrl(product.id, product.imageUrl),
      dailyLimit,
      reservedQuantity,
      remainingQuantity: dailyLimit === null ? null : Math.max(0, dailyLimit - reservedQuantity),
      availabilityDate,
    }));

    return Response.json(
      { products: productResponse, activeSeason, appSettings: { kioskHeadline: parseStoredSetting(headlineRows[0]?.afterData, DEFAULT_KIOSK_HEADLINE) } },
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
