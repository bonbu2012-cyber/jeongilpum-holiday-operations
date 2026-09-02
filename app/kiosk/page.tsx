import { env } from "cloudflare:workers";
import KioskApp from "../components/KioskApp";
import type { CategoryRailItem } from "../components/types";

type CategoryRow = {
  id: string;
  name: string;
  rail_order: number | null;
  rail_label: string;
  rail_assist: string | null;
  rail_variant: "default" | "single" | "omeat";
  is_custom_order_link: number;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const result = await runtimeEnv.DB.prepare(`
    SELECT id,name,rail_order,rail_label,rail_assist,rail_variant,is_custom_order_link
    FROM categories
    WHERE active=1
    ORDER BY (rail_order IS NULL),rail_order,sort_order
  `).all<CategoryRow>();
  const categories: CategoryRailItem[] = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    railOrder: row.rail_order,
    railLabel: row.rail_label,
    railAssist: row.rail_assist,
    railVariant: row.rail_variant,
    isCustomOrderLink: Boolean(row.is_custom_order_link),
  }));
  return <KioskApp categories={categories} />;
}
