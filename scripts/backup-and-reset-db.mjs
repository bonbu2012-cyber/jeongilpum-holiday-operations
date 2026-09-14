import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vpyedzjycmphoutztxnr.supabase.co").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweWVkemp5Y21waG91dHp0eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY4NjgsImV4cCI6MjA5OTExMjg2OH0.u0iUtRnlIUoi8nzrYH1xMLSWIk5f1xGxJ_--pCX9Qo0").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey).trim();

const client = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OPERATIONAL_TABLES = [
  "work_item_events",
  "fulfillment_items",
  "fulfillments",
  "order_item_customizations",
  "product_daily_reservations",
  "order_items",
  "work_items",
  "order_events",
  "order_customer_accounts",
  "customer_ledger_consultation_orders",
  "customer_ledger_transactions",
  "customer_ledger_consultations",
  "customer_ledger_events",
  "customer_accounts",
  "payments",
  "package_assignment_history",
  "package_labels",
  "package_skin_packs",
  "packages",
  "skin_pack_labels",
  "skin_packs",
  "production_batches",
  "traceability_records",
  "operational_alerts",
  "orders",
];

async function main() {
  console.log("=== 1. Starting Database Backup ===");
  const backupData = {
    timestamp: new Date().toISOString(),
    tables: {},
  };

  for (const table of OPERATIONAL_TABLES) {
    const { data, error } = await client.from(table).select("*");
    if (error) {
      console.warn(`[WARN] Table ${table} fetch error:`, error.message);
      backupData.tables[table] = [];
    } else {
      backupData.tables[table] = data || [];
      console.log(`- Backed up ${table}: ${(data || []).length} rows`);
    }
  }

  const backupsDir = resolve(root, "backups");
  await mkdir(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = resolve(backupsDir, `orders_backup_${timestamp}.json`);
  await writeFile(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\n[SUCCESS] Backup saved to: ${backupFile}\n`);

  console.log("=== 2. Resetting Operational Tables ===");
  for (const table of OPERATIONAL_TABLES) {
    const rowCount = backupData.tables[table]?.length ?? 0;
    if (rowCount === 0) continue;

    const { data, error } = await client.rpc("exec_dml", {
      statement: `DELETE FROM ${table} WHERE 1=1;`,
    });

    if (error || (data && typeof data === "object" && "error" in data)) {
      const errMsg = error?.message || data?.error;
      console.error(`[ERROR] Failed to delete from ${table}:`, errMsg);
    } else {
      console.log(`- Cleared ${table} (${rowCount} rows removed)`);
    }
  }

  console.log("\n=== 3. Verifying Post-Reset State ===");
  let allCleared = true;
  for (const table of OPERATIONAL_TABLES) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.warn(`- ${table}: could not check count (${error.message})`);
    } else {
      console.log(`- ${table}: ${count} rows`);
      if ((count ?? 0) > 0) allCleared = false;
    }
  }

  console.log("\n=== 4. Verifying Master Catalog Intact ===");
  const { count: catCount } = await client.from("categories").select("*", { count: "exact", head: true });
  const { count: prodCount } = await client.from("products").select("*", { count: "exact", head: true });
  const { count: seasonCount } = await client.from("sales_seasons").select("*", { count: "exact", head: true });
  console.log(`- categories: ${catCount} rows (INTACT)`);
  console.log(`- products: ${prodCount} rows (INTACT)`);
  console.log(`- sales_seasons: ${seasonCount} rows (INTACT)`);

  if (allCleared && (prodCount ?? 0) > 0 && (seasonCount ?? 0) > 0) {
    console.log("\n>>> [SUCCESS] Database successfully initialized for fresh holiday orders! <<<");
  } else {
    console.warn("\n>>> [WARNING] Some tables may still contain rows. Please check logs above. <<<");
  }
}

main().catch(console.error);
