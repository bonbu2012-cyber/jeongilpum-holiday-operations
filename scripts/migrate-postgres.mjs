import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vpyedzjycmphoutztxnr.supabase.co").replace(/^\uFEFF/, "").trim();
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = rawKey ? rawKey.replace(/^\uFEFF/, "").trim() : "";

if (!supabaseServiceKey) {
  console.log("[migrate-postgres] SUPABASE_SERVICE_ROLE_KEY not found in environment. Skipping build-time DB check.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("[migrate-postgres] Checking Supabase database tables and seed data...");

// 0. Ensure nocase collation exists in PostgreSQL
try {
  await supabase.rpc("exec_dml", { statement: "CREATE COLLATION IF NOT EXISTS nocase (provider = icu, locale = 'und-u-ks-level2', deterministic = false);" });
} catch (e) {
  // Ignore if already exists or permission
}

// 1. Check if products exist, otherwise seed from data/catalog.json
try {
  const { data: existingProducts, error: prodErr } = await supabase.from("products").select("id").limit(1);
  if (prodErr) {
    console.warn("[migrate-postgres] Notice querying products table:", prodErr.message);
  } else if (!existingProducts || existingProducts.length === 0) {
    console.log("[migrate-postgres] Seeding products from data/catalog.json...");
    const catalog = JSON.parse(readFileSync(resolve(root, "data/catalog.json"), "utf8"));
    const rows = catalog.map((p) => ({
      id: p.id,
      category: p.category,
      code: p.code,
      name: p.name,
      subtitle: p.subtitle || "",
      description: p.description || "",
      price: p.price,
      customer_display_weight: p.displayWeight,
      display_weight: p.displayWeight,
      image_url: p.imageUrl,
      badge: p.badge,
      daily_limit: p.dailyLimit,
      display_order: p.sortOrder || 0,
      sort_order: p.sortOrder || 0,
      active: p.active,
    }));
    const { error: insertErr } = await supabase.from("products").upsert(rows, { onConflict: "id" });
    if (insertErr) {
      console.error("[migrate-postgres] Failed to seed products:", insertErr.message);
    } else {
      console.log(`[migrate-postgres] Successfully seeded ${rows.length} products.`);
    }
  } else {
    console.log("[migrate-postgres] Products table already populated.");
  }

  // 2. Ensure sales seasons exists
  const { data: seasons } = await supabase.from("sales_seasons").select("id").limit(1);
  if (!seasons || seasons.length === 0) {
    console.log("[migrate-postgres] Seeding initial sales season (2026 추석)...");
    await supabase.from("sales_seasons").upsert({
      id: "season-2026-chuseok",
      name: "2026 추석",
      holiday_date: "2026-09-25",
      sales_start_date: "2026-08-01",
      sales_end_date: "2026-09-25",
      active: true,
    }, { onConflict: "id" });
  }

  // 3. Ensure categories exist
  const { data: cats } = await supabase.from("categories").select("id").limit(1);
  if (!cats || cats.length === 0) {
    console.log("[migrate-postgres] Seeding default categories...");
    await supabase.from("categories").upsert([
      { id: "vacuum-set", name: "진공세트", sort_order: 0, rail_order: 0, rail_label: "진공세트", rail_assist: "VACUUM", rail_variant: "default", is_custom_order_link: false, active: true },
      { id: "premium-set", name: "프리미엄", sort_order: 1, rail_order: 1, rail_label: "프리미엄", rail_assist: "PREMIUM", rail_variant: "default", is_custom_order_link: false, active: true },
      { id: "omeat", name: "O'meat", sort_order: 2, rail_order: 4, rail_label: "O'", rail_assist: "meat", rail_variant: "omeat", is_custom_order_link: false, active: true },
      { id: "la-galbi", name: "LA갈비", sort_order: 3, rail_order: 2, rail_label: "LA갈비", rail_assist: "LA", rail_variant: "default", is_custom_order_link: false, active: true },
      { id: "bone-set", name: "뼈세트", sort_order: 4, rail_order: 3, rail_label: "뼈세트", rail_assist: null, rail_variant: "single", is_custom_order_link: false, active: true },
      { id: "custom-order", name: "맞춤주문", sort_order: 5, rail_order: null, rail_label: "맞춤주문", rail_assist: "CUSTOM ORDER", rail_variant: "default", is_custom_order_link: true, active: true },
    ], { onConflict: "id" });
  }

  console.log("[migrate-postgres] Migration and seed verification completed successfully.");
} catch (e) {
  console.warn("[migrate-postgres] Warning during migration check (non-fatal):", e.message);
}

process.exit(0);
