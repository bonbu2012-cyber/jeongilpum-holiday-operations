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

// 0. Ensure nocase collation and boolean=integer operators exist in PostgreSQL
try {
  await supabase.rpc("exec_dml", { statement: "CREATE COLLATION IF NOT EXISTS nocase (provider = icu, locale = 'und-u-ks-level2', deterministic = false);" });
  await supabase.rpc("exec_dml", { statement: `
    CREATE OR REPLACE FUNCTION bool_eq_int(b boolean, i integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT b = (i != 0); $$;
    CREATE OR REPLACE FUNCTION int_eq_bool(i integer, b boolean) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT (i != 0) = b; $$;
    CREATE OR REPLACE FUNCTION bool_neq_int(b boolean, i integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT b != (i != 0); $$;
    CREATE OR REPLACE FUNCTION int_neq_bool(i integer, b boolean) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT (i != 0) != b; $$;
  ` });
} catch {
  // Ignore if already exists
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

  // 4. Ensure BAND reservation MVP tables exist
  console.log("[migrate-postgres] Ensuring BAND reservation MVP tables...");
  const bandStatements = [
    `CREATE TABLE IF NOT EXISTS band_sales (
      id text PRIMARY KEY,
      product_id text NOT NULL REFERENCES products(id),
      title text NOT NULL,
      subtitle text NOT NULL DEFAULT '',
      price integer NOT NULL,
      production_limit integer NOT NULL CHECK (production_limit > 0),
      reserved_qty integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
      deposit_per_unit integer NOT NULL DEFAULT 1000 CHECK (deposit_per_unit >= 0),
      reservation_start_at text NOT NULL,
      reservation_end_at text NOT NULL,
      production_lock_at text NOT NULL,
      pickup_date text NOT NULL,
      pickup_start text NOT NULL DEFAULT '10:00',
      pickup_end text NOT NULL DEFAULT '19:00',
      pickup_location text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','completed')),
      active boolean NOT NULL DEFAULT false,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_band_sales_active_start ON band_sales(active,reservation_start_at)`,
    `CREATE INDEX IF NOT EXISTS idx_band_sales_pickup_date ON band_sales(pickup_date)`,
    `CREATE TABLE IF NOT EXISTS band_reservations (
      id text PRIMARY KEY,
      reservation_no text NOT NULL UNIQUE,
      sale_id text NOT NULL REFERENCES band_sales(id),
      customer_name text NOT NULL,
      customer_phone text NOT NULL,
      idempotency_key text NOT NULL UNIQUE,
      quantity integer NOT NULL CHECK (quantity > 0),
      unit_price integer NOT NULL,
      total_amount integer NOT NULL CHECK (total_amount >= 0),
      deposit_amount integer NOT NULL CHECK (deposit_amount >= 0),
      pickup_window text NOT NULL,
      status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','picked_up','cancelled','no_show')),
      payment_status text NOT NULL DEFAULT 'test_paid',
      payment_provider text NOT NULL DEFAULT 'test',
      payment_tid text,
      policy_version text NOT NULL,
      policy_agreed_at text NOT NULL,
      cancelled_at text,
      picked_up_at text,
      no_show_at text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_band_reservations_sale_status ON band_reservations(sale_id,status)`,
    `CREATE INDEX IF NOT EXISTS idx_band_reservations_phone ON band_reservations(customer_phone,created_at)`,
    `CREATE TABLE IF NOT EXISTS band_reservation_events (
      id text PRIMARY KEY,
      reservation_id text NOT NULL REFERENCES band_reservations(id),
      event_type text NOT NULL,
      payload_json text NOT NULL DEFAULT '',
      created_at text NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_band_reservation_events_reservation ON band_reservation_events(reservation_id,created_at)`,
  ];
  for (const statement of bandStatements) {
    const { error: bandError } = await supabase.rpc("exec_dml", { statement });
    if (bandError) throw new Error(`BAND reservation schema failed: ${bandError.message}`);
  }

  console.log("[migrate-postgres] Migration and seed verification completed successfully.");
} catch (e) {
  console.warn("[migrate-postgres] Warning during migration check (non-fatal):", e.message);
}

process.exit(0);
