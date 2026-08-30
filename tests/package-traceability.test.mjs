import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { aggregateProductionNeeds, additionalNeeded, buildSkinPackCode, skinPackLabelsToLongCsv } from "../app/lib/production-domain.ts";
import { buildPackageCode, parseTraceabilityScan, validateTraceabilityLength } from "../app/lib/package-domain.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const splitMigration = (sql) => sql.split(/--> statement-breakpoint\s*/).map((value) => value.trim()).filter(Boolean);
function apply(database, sql) { for (const statement of splitMigration(sql)) database.exec(statement); }
async function migratedDatabase(include0005 = true) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const name of ["0000_charming_bishop.sql", "0001_confused_swarm.sql", "0002_deep_giant_girl.sql", "0003_cancel_production_smoke_orders.sql", "0004_brown_omega_red.sql"]) apply(database, await read(`drizzle/${name}`));
  if (include0005) apply(database, await read("drizzle/0005_chunky_sway.sql"));
  return database;
}
function trace(database, number) {
  database.prepare("INSERT INTO traceability_records(traceability_no,last_raw_scan,last_used_by,last_used_at,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(number, number, "worker", "2026-08-30T00:00:00Z", "2026-08-30T00:00:00Z", "2026-08-30T00:00:00Z");
}
function batch(database, { id, code, name, target, traceabilityNo, segment = 1, parent = null }) {
  database.prepare("INSERT INTO production_batches(id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,available_quantity_at_start,additional_needed,production_target,produced_quantity,traceability_no,status,started_by,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,20,5,15,?,0,?,'in_progress','worker','2026-08-30T00:00:00Z','2026-08-30T00:00:00Z','2026-08-30T00:00:00Z')").run(id, "2026-08-30", parent, segment, code, name, target, traceabilityNo);
}
function pack(database, { id, batchId, sequence, code, componentCode, name, weight, traceabilityNo }) {
  database.prepare("INSERT INTO skin_packs(id,production_batch_id,batch_sequence,skin_pack_code,component_code,cut_name_snapshot,weight_g,traceability_no,manufactured_at,status,idempotency_key,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'available',?,?,?,?)").run(id, batchId, sequence, code, componentCode, name, weight, traceabilityNo, "2026-08-30T01:00:00Z", `idem-${id}`, "worker", "2026-08-30T01:00:00Z", "2026-08-30T01:00:00Z");
}

const palyeongBom = [
  ["CM", "치마살"], ["BC", "부채살"], ["UJ", "업진살"], ["GB", "갈비살"], ["JJ", "제비추리"],
].map(([componentCode, componentName], index) => ({ productId: "palyeong", componentId: `pc-${index}`, componentCode, componentName, quantityPerProduct: 1 }));

test("A/B/C. BOM expands sets, sums shared cuts, and subtracts available inventory", () => {
  const ten = aggregateProductionNeeds([{ productId: "palyeong", productName: "팔영", quantity: 10 }], palyeongBom);
  assert.deepEqual(Object.fromEntries(ten.requirements.map((item) => [item.componentCode, item.requiredQuantity])), { BC: 10, GB: 10, JJ: 10, UJ: 10, CM: 10 });
  const shared = aggregateProductionNeeds([{ productId: "a", productName: "A", quantity: 6 }, { productId: "b", productName: "B", quantity: 7 }], [
    { productId: "a", componentId: "a-cm", componentCode: "CM", componentName: "치마살", quantityPerProduct: 1 },
    { productId: "b", componentId: "b-cm", componentCode: "CM", componentName: "치마살", quantityPerProduct: 2 },
  ], { CM: 5 });
  assert.equal(shared.requirements[0].requiredQuantity, 20);
  assert.equal(shared.requirements[0].additionalNeeded, 15);
  assert.equal(additionalNeeded(20, 5), 15);
});

test("D. production target is worker-adjustable and never drops below produced quantity", async () => {
  const database = await migratedDatabase(); trace(database, "111111111111"); batch(database, { id: "batch-d", code: "CM", name: "치마살", target: 15, traceabilityNo: "111111111111" });
  database.prepare("UPDATE production_batches SET production_target=20 WHERE id='batch-d' AND produced_quantity<=20").run();
  assert.equal(database.prepare("SELECT production_target FROM production_batches WHERE id='batch-d'").get().production_target, 20);
  database.close();
});

test("E/F/G/H. one trace applies to a batch, each weight creates one immutable skin pack, and trace changes create a segment", async () => {
  const database = await migratedDatabase(); trace(database, "111111111111"); trace(database, "222222222222");
  batch(database, { id: "batch-1", code: "CM", name: "치마살", target: 3, traceabilityNo: "111111111111" });
  [205, 211, 198].forEach((weight, index) => pack(database, { id: `sp-${index + 1}`, batchId: "batch-1", sequence: index + 1, code: buildSkinPackCode("CM", "2026-08-30", index + 1), componentCode: "CM", name: "치마살", weight, traceabilityNo: "111111111111" }));
  assert.equal(database.prepare("SELECT produced_quantity FROM production_batches WHERE id='batch-1'").get().produced_quantity, 3);
  assert.deepEqual(database.prepare("SELECT weight_g FROM skin_packs WHERE production_batch_id='batch-1' ORDER BY batch_sequence").all().map((row) => row.weight_g), [205, 211, 198]);
  assert.equal(database.prepare("SELECT COUNT(DISTINCT traceability_no) count FROM skin_packs WHERE production_batch_id='batch-1'").get().count, 1);
  database.prepare("UPDATE production_batches SET status='completed',completed_at='2026-08-30T02:00:00Z' WHERE id='batch-1'").run();
  batch(database, { id: "batch-2", code: "CM", name: "치마살", target: 1, traceabilityNo: "222222222222", segment: 2, parent: "batch-1" });
  pack(database, { id: "sp-4", batchId: "batch-2", sequence: 1, code: "CM-260830-1001", componentCode: "CM", name: "치마살", weight: 207, traceabilityNo: "222222222222" });
  assert.equal(database.prepare("SELECT traceability_no FROM skin_packs WHERE id='sp-1'").get().traceability_no, "111111111111");
  assert.equal(database.prepare("SELECT traceability_no FROM skin_packs WHERE id='sp-4'").get().traceability_no, "222222222222");
  assert.throws(() => database.prepare("INSERT INTO skin_packs(id,production_batch_id,batch_sequence,skin_pack_code,component_code,cut_name_snapshot,weight_g,traceability_no,manufactured_at,status,idempotency_key,created_by,created_at,updated_at) VALUES('bad','batch-1',4,'BAD','CM','치마살',200,'222222222222','now','available','bad','worker','now','now')").run(), /SKIN_PACK_BATCH_SEQUENCE_CONFLICT/);
  database.close();
});

test("I. Open Label CSV is long format with one row per skin pack", () => {
  const rows = [205, 211, 198].map((weightG, index) => ({ skinPackCode: `CM-${index + 1}`, cutName: "치마살", weightG, traceabilityNo: "111", origin: "국내산", slaughterhouse: "A", grade: "1++", manufacturedAt: "2026-08-30", storageMethod: "냉장", expiryText: "설정값", packagingMaterial: "필름", foodType: "포장육" }));
  const csv = skinPackLabelsToLongCsv(rows);
  assert.equal(csv.trim().split(/\r?\n/).length, 4);
  assert.match(csv, /^skin_pack_code,cut_name,weight_g,traceability_no/);
  assert.doesNotMatch(csv, /component_1_/);
});

test("J/K/L. assembling Palyeong consumes each BOM slot once, blocks duplicate pack assignment, and QR has no PII", async () => {
  const database = await migratedDatabase(); trace(database, "333333333333");
  const season = database.prepare("SELECT id FROM sales_seasons LIMIT 1").get();
  database.prepare("INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES('order-j','JI-260830-1000',?,'테스트 고객','01012345678','confirmed','pickup','2026-09-01 10:00 방문','',300000,'idem-j',1,'2026-08-30','2026-08-30','2026-08-30')").run(season.id);
  database.prepare("INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES('item-j','order-j','palyeong','팔영세트',300000,300000,1,300000,'2026-08-30')").run();
  for (const [index, component] of palyeongBom.entries()) { batch(database, { id: `batch-${component.componentCode}`, code: component.componentCode, name: component.componentName, target: 1, traceabilityNo: "333333333333" }); pack(database, { id: `sp-${component.componentCode}`, batchId: `batch-${component.componentCode}`, sequence: 1, code: `${component.componentCode}-260830-0001`, componentCode: component.componentCode, name: component.componentName, weight: 200 + index, traceabilityNo: "333333333333" }); }
  const packageCode = buildPackageCode("VAC-PY", "JI-260830-1000", 1);
  database.prepare("INSERT INTO packages(id,order_id,order_item_id,package_sequence,assembly_key,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES('pkg-j','order-j','item-j',1,'assembly-j',?,'palyeong','팔영세트','completed','now','now')").run(packageCode);
  const components = database.prepare("SELECT id,component_code FROM product_components WHERE product_id='palyeong' ORDER BY sort_order").all();
  components.forEach((component, index) => { database.prepare("INSERT INTO package_skin_packs(id,package_id,skin_pack_id,product_component_id,quantity_slot,assigned_by,assigned_at) VALUES(?,?,?,?,1,'worker','now')").run(`map-${index}`, "pkg-j", `sp-${component.component_code}`, component.id); database.prepare("UPDATE skin_packs SET status='assigned' WHERE id=?").run(`sp-${component.component_code}`); });
  assert.equal(database.prepare("SELECT COUNT(*) count FROM package_skin_packs WHERE package_id='pkg-j'").get().count, 5);
  assert.throws(() => database.prepare("INSERT INTO package_skin_packs(id,package_id,skin_pack_id,product_component_id,quantity_slot,assigned_by,assigned_at) VALUES('duplicate','pkg-j','sp-CM',?,2,'worker','now')").run(components[0].id));
  const qr = `/workshop/packages/${encodeURIComponent(packageCode)}`;
  assert.doesNotMatch(qr, /테스트 고객|01012345678/);
  database.close();
});

test("M/N. whiteboard and sales polling remain wired while package creation is removed from work acceptance", async () => {
  const [workshop, workshopApi, action, status, sales] = await Promise.all([read("app/components/WorkshopApp.tsx"), read("app/api/workshop/orders/route.ts"), read("app/api/workshop/actions/route.ts"), read("app/api/orders/status/route.ts"), read("app/components/SalesApp.tsx")]);
  assert.match(workshop, /시간대별 작업 타임라인/);
  assert.match(workshop, /가용 스킨팩으로 1세트 조립/);
  assert.match(workshopApi, /WORKSHOP_DATE_ORDERS_SQL/);
  assert.doesNotMatch(action, /prepareEnsureOrderPackages|INSERT INTO packages/);
  assert.doesNotMatch(status, /prepareEnsureOrderPackages|INSERT INTO packages/);
  assert.match(sales, /2500/);
  assert.match(sales, /cache: "no-store"/);
});

test("migration 0005 is additive, preserves existing rows, and exposes required indexes/triggers", async () => {
  const database = await migratedDatabase(false);
  const before = { orders: database.prepare("SELECT COUNT(*) count FROM orders").get().count, items: database.prepare("SELECT COUNT(*) count FROM order_items").get().count, products: database.prepare("SELECT COUNT(*) count FROM products").get().count };
  apply(database, await read("drizzle/0005_chunky_sway.sql"));
  assert.deepEqual(before, { orders: database.prepare("SELECT COUNT(*) count FROM orders").get().count, items: database.prepare("SELECT COUNT(*) count FROM order_items").get().count, products: database.prepare("SELECT COUNT(*) count FROM products").get().count });
  for (const table of ["product_components", "production_batches", "skin_packs", "skin_pack_labels", "package_skin_packs", "traceability_records", "package_assignment_history", "package_labels"]) assert.equal(database.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name=?").get(table).count, 1);
  for (const trigger of ["skin_pack_sequence_guard", "skin_pack_increment_batch", "package_skin_pack_requires_available"]) assert.equal(database.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name=?").get(trigger).count, 1);
  database.close();
});

test("HID/manual scan validation and recent trace cache remain in the production flow", async () => {
  const [ui, api, data] = await Promise.all([read("app/components/ProductionApp.tsx"), read("app/api/workshop/production/route.ts"), read("app/lib/production-data.ts")]);
  assert.match(ui, /event\.key === "Enter"/);
  assert.deepEqual(parseTraceabilityScan(" 123456 "), { ok: true, traceabilityNo: "123456", raw: "123456" });
  assert.equal(validateTraceabilityLength("123456", []).ok, true);
  assert.match(api, /ON CONFLICT\(traceability_no\) DO UPDATE/);
  assert.match(data, /last_used_by=\?/);
  assert.match(data, /LIMIT 5/);
});