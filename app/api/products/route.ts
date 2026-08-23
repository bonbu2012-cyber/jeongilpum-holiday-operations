import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(products).where(eq(products.active, true)).orderBy(asc(products.displayOrder));
    return Response.json({ products: rows }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
