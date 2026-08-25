import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products, salesSeasons } from "../../../db/schema";

export async function GET() {
  try {
    const db = getDb();
    const [productRows, seasonRows] = await Promise.all([
      db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.displayOrder)),
      db.select().from(salesSeasons).where(eq(salesSeasons.active, true)).orderBy(desc(salesSeasons.salesStartDate)).limit(1),
    ]);
    const season = seasonRows[0];
    const activeSeason = season ? {
      id: season.id,
      name: season.name,
      holidayDate: season.holidayDate,
      salesStartDate: season.salesStartDate,
      salesEndDate: season.salesEndDate,
    } : null;
    return Response.json({ products: productRows, activeSeason }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
