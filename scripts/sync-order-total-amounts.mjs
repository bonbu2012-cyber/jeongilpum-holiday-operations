import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vpyedzjycmphoutztxnr.supabase.co").replace(/^\uFEFF/, "").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweWVkemp5Y21waG91dHp0eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY4NjgsImV4cCI6MjA5OTExMjg2OH0.u0iUtRnlIUoi8nzrYH1xMLSWIk5f1xGxJ_--pCX9Qo0").replace(/^\uFEFF/, "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey).replace(/^\uFEFF/, "").trim();

const client = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log("=== Checking for order total_amount mismatches ===");

  // 1. Fetch work_items
  const { data: workItems, error: wiError } = await client
    .from("work_items")
    .select("id, order_id, line_total, work_status");

  if (wiError) {
    console.error("Failed to fetch work items:", wiError);
    process.exit(1);
  }

  // Group line_total by order_id (excluding cancelled)
  const itemsTotalByOrder = new Map();
  for (const item of workItems || []) {
    if (item.work_status === "cancelled") continue;
    const current = itemsTotalByOrder.get(item.order_id) || 0;
    itemsTotalByOrder.set(item.order_id, current + (item.line_total || 0));
  }

  // 2. Fetch orders
  const { data: orders, error: oError } = await client
    .from("orders")
    .select("id, order_no, total_amount, paid_amount, payment_status, version");

  if (oError) {
    console.error("Failed to fetch orders:", oError);
    process.exit(1);
  }

  const updates = [];
  for (const order of orders || []) {
    const itemsTotal = itemsTotalByOrder.get(order.id);
    // Only adjust when work_items exist and itemsTotal > 0
    if (itemsTotal !== undefined && itemsTotal > 0 && itemsTotal !== order.total_amount) {
      const newPaidAmount = order.payment_status === "paid" ? itemsTotal : order.paid_amount;
      updates.push({
        id: order.id,
        orderNo: order.order_no,
        oldTotal: order.total_amount,
        newTotal: itemsTotal,
        paymentStatus: order.payment_status,
        oldPaid: order.paid_amount,
        newPaid: newPaidAmount,
        version: (order.version || 1) + 1,
      });
    }
  }

  console.log(`Found ${updates.length} mismatched orders:`);
  for (const up of updates) {
    console.log(
      `Order ${up.orderNo}: total_amount ${up.oldTotal} -> ${up.newTotal} (paid: ${up.oldPaid} -> ${up.newPaid}, status: ${up.paymentStatus})`
    );
  }

  if (updates.length === 0) {
    console.log("All orders are perfectly synchronized!");
    return;
  }

  console.log("\nSynchronizing mismatched orders to Supabase...");
  const now = new Date().toISOString();
  for (const up of updates) {
    const { error: updateError } = await client
      .from("orders")
      .update({
        total_amount: up.newTotal,
        paid_amount: up.newPaid,
        version: up.version,
        updated_at: now,
      })
      .eq("id", up.id);

    if (updateError) {
      console.error(`Failed to update order ${up.orderNo}:`, updateError);
    } else {
      console.log(`Successfully updated order ${up.orderNo}`);
    }
  }

  console.log("=== Synchronization complete ===");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
