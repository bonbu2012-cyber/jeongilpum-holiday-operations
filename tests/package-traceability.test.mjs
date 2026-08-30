import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildLabelPayload, buildPackageCode, labelPayloadToWideCsv, parseTraceabilityScan, validatePackageComponents, validateTraceabilityLength } from "../app/lib/package-domain.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const splitMigration = (sql) => sql.split(/--> statement-breakpoint\s*/).map((value) => value.trim()).filter(Boolean);
function apply(database, sql) { for (const statement of splitMigration(sql)) database.exec(statement); }

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const name of ["0000_charming_bishop.sql", "0001_confused_swarm.sql", "0002_deep_giant_girl.sql", "0003_cancel_production_smoke_orders.sql", "0004_brown_omega_red.sql"]) apply(database, await read(`drizzle/${name}`));
  return database;
}

test("A/B. quantity slots create stable unique package codes and remain idempotent", async () => {
  const database = await migratedDatabase();
  const season = database.prepare("SELECT id FROM sales_seasons LIMIT 1").get();
  database.prepare("INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES('order-pkg','JI-260829-0142',?,'테스트','01000000000','confirmed','pickup','2026-09-01 10:00 방문','',600000,'idem-pkg',1,'2026-08-29','2026-08-29','2026-08-29')").run(season.id);
  database.prepare("INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES('item-py','order-pkg','palyeong','팔영세트',300000,300000,2,600000,'2026-08-29')").run();
  database.prepare("INSERT INTO packages(id,order_id,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES('legacy-package','order-pkg','LEGACY-0142','palyeong','팔영세트','queued','2026-08-29','2026-08-29')").run();
  const before = { packages: database.prepare("SELECT COUNT(*) count FROM packages").get().count, products: database.prepare("SELECT COUNT(*) count FROM products").get().count, orders: database.prepare("SELECT COUNT(*) count FROM orders").get().count, items: database.prepare("SELECT COUNT(*) count FROM order_items").get().count };
  apply(database, await read("drizzle/0005_huge_peter_quill.sql"));
  assert.equal(buildPackageCode("VAC-PY", "JI-260829-0142", 1), "PY-260829-0142-01");
  const insert = database.prepare("INSERT OR IGNORE INTO packages(id,order_id,order_item_id,package_sequence,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'queued','2026-08-29','2026-08-29')");
  for (let attempt = 0; attempt < 2; attempt += 1) for (let sequence = 1; sequence <= 2; sequence += 1) insert.run(`pkg:item-py:${sequence}`, "order-pkg", "item-py", sequence, buildPackageCode("VAC-PY", "JI-260829-0142", sequence), "palyeong", "팔영세트");
  assert.equal(database.prepare("SELECT COUNT(*) count FROM packages WHERE order_id='order-pkg' AND order_item_id='item-py'").get().count, 2);
  assert.deepEqual(database.prepare("SELECT package_code FROM packages WHERE order_id='order-pkg' AND order_item_id='item-py' ORDER BY package_sequence").all().map((row) => row.package_code), ["PY-260829-0142-01", "PY-260829-0142-02"]);
  assert.equal(database.prepare("SELECT package_code FROM packages WHERE id='legacy-package'").get().package_code, "LEGACY-0142");
  assert.deepEqual(before, { packages: database.prepare("SELECT COUNT(*) count FROM packages WHERE id='legacy-package'").get().count, products: database.prepare("SELECT COUNT(*) count FROM products").get().count, orders: database.prepare("SELECT COUNT(*) count FROM orders").get().count, items: database.prepare("SELECT COUNT(*) count FROM order_items").get().count });
  database.close();
});

test("C/D. QR is package-only and package routes require authenticated operator access", async () => {
  const [detail, api, csv, page] = await Promise.all([read("app/lib/package-detail.ts"), read("app/api/workshop/packages/[packageCode]/route.ts"), read("app/api/workshop/packages/[packageCode]/csv/route.ts"), read("app/workshop/packages/[packageCode]/page.tsx")]);
  assert.match(detail, /qrValue: `\/workshop\/packages\//);
  assert.doesNotMatch(detail, /buyer_name|buyerPhone|recipient|road_addr|detail_addr/);
  for (const source of [api, csv]) { assert.match(source, /getChatGPTUser/); assert.match(source, /isConfiguredOperator/); assert.match(source, /status: 403/); }
  assert.match(page, /requireChatGPTUser/);
});

test("E/F. Palyeong has five templates and one traceability number can update selected components", async () => {
  const database = await migratedDatabase();
  apply(database, await read("drizzle/0005_huge_peter_quill.sql"));
  assert.deepEqual(database.prepare("SELECT component_name FROM product_components WHERE product_id='palyeong' ORDER BY sort_order").all().map((row) => row.component_name), ["치마살", "부채살", "업진살", "갈비살", "제비추리"]);
  database.exec("PRAGMA foreign_keys=OFF; INSERT INTO packages(id,order_id,order_item_id,package_sequence,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES('p','missing',NULL,NULL,'PY-TEST','palyeong','팔영','queued','now','now'); PRAGMA foreign_keys=ON");
  database.prepare("INSERT INTO package_components(id,package_id,product_component_id,component_name_snapshot,sort_order,updated_at) SELECT 'pc-'||sort_order,'p',id,component_name,sort_order,'now' FROM product_components WHERE product_id='palyeong'").run();
  database.prepare("INSERT INTO traceability_records(traceability_no,last_raw_scan,last_used_by,last_used_at,created_at,updated_at) VALUES('123456789012','123456789012','worker','now','now','now')").run();
  database.prepare("UPDATE package_components SET traceability_no='123456789012' WHERE package_id='p' AND sort_order IN (10,20,30)").run();
  assert.equal(database.prepare("SELECT COUNT(*) count FROM package_components WHERE package_id='p' AND traceability_no='123456789012'").get().count, 3);
  database.close();
});

test("G/H/I. HID Enter shares the handler and numeric validation is actionable", async () => {
  const ui = await read("app/components/PackageApp.tsx");
  assert.match(ui, /event\.key === "Enter"/);
  assert.match(ui, /applyTraceability\(scan, "hid"\)/);
  assert.deepEqual(parseTraceabilityScan(" 123456 "), { ok: true, traceabilityNo: "123456", raw: "123456" });
  assert.match(parseTraceabilityScan("ABC-123").error, /복합 바코드 형식/);
  assert.equal(validateTraceabilityLength("123456", []).ok, true);
  assert.equal(validateTraceabilityLength("123456", [12]).ok, false);
});

test("J/K. traceability cache is upserted and returns five recent values for the worker", async () => {
  const [api, detail] = await Promise.all([read("app/api/workshop/packages/[packageCode]/route.ts"), read("app/lib/package-detail.ts")]);
  assert.match(api, /ON CONFLICT\(traceability_no\) DO UPDATE/);
  assert.match(api, /last_used_by/);
  assert.match(detail, /WHERE last_used_by=\?/);
  assert.match(detail, /date\(last_used_at,'\+9 hours'\)/);
  assert.match(detail, /LIMIT 5/);
});

test("L/M. positive weight and required traceability block label generation until complete", () => {
  const incomplete = [{ componentName: "치마살", traceabilityRequired: true, weightRequired: true, originRequired: false, slaughterhouseRequired: false, traceabilityNo: null, weightG: 0, origin: "", slaughterhouse: "" }];
  assert.deepEqual(validatePackageComponents(incomplete), ["치마살: 이력번호가 필요합니다.", "치마살: 0g보다 큰 중량이 필요합니다."]);
  assert.throws(() => buildLabelPayload({ packageCode: "PY-1", orderNo: "JI-1", productName: "팔영", schedule: "2026-09-01", qrValue: "/workshop/packages/PY-1", components: incomplete }));
  const ready = [{ ...incomplete[0], traceabilityNo: "123456789012", weightG: 450 }];
  assert.equal(buildLabelPayload({ packageCode: "PY-1", orderNo: "JI-1", productName: "팔영", schedule: "2026-09-01", qrValue: "/workshop/packages/PY-1", components: ready }).components[0].weightG, 450);
});

test("N/O. wide CSV has stable multi-component columns and label versions are stored", async () => {
  const payload = buildLabelPayload({ packageCode: "PY-1", orderNo: "JI-1", productName: "팔영", schedule: "2026-09-01", qrValue: "/workshop/packages/PY-1", components: [
    { componentName: "치마살", traceabilityRequired: true, weightRequired: true, originRequired: false, slaughterhouseRequired: false, traceabilityNo: "111", weightG: 400, origin: "국내산", slaughterhouse: "A" },
    { componentName: "부채살", traceabilityRequired: true, weightRequired: true, originRequired: false, slaughterhouseRequired: false, traceabilityNo: "222", weightG: 500, origin: "국내산", slaughterhouse: "A" },
  ] });
  const csv = labelPayloadToWideCsv(payload);
  assert.match(csv, /component_1_name,component_1_traceability_no,component_1_weight_g/);
  assert.match(csv, /component_2_name/);
  const migration = await read("drizzle/0005_huge_peter_quill.sql");
  assert.match(migration, /CREATE TABLE `package_labels`/);
  assert.match(migration, /idx_package_labels_version/);
});

test("P/Q. reassignment retains VOID_AND_REPRINT plus assignment history and existing whiteboard regressions", async () => {
  const [reassign, workshop, action, status] = await Promise.all([read("app/api/workshop/packages/reassign/route.ts"), read("app/components/WorkshopApp.tsx"), read("app/api/workshop/actions/route.ts"), read("app/api/orders/status/route.ts")]);
  assert.match(reassign, /package_assignment_history/g);
  assert.match(reassign, /VOID_AND_REPRINT/);
  assert.match(action, /prepareEnsureOrderPackages/);
  const packageApi = await read("app/api/workshop/packages/[packageCode]/route.ts");
  for (const eventType of ["PACKAGE_TRACEABILITY_UPDATED", "PACKAGE_WEIGHT_UPDATED", "PACKAGE_LABEL_PREVIEWED"]) assert.match(packageApi, new RegExp(eventType));
  assert.match(status, /prepareEnsureOrderPackages/);
  assert.match(workshop, /시간대별 작업 타임라인/);
  assert.match(workshop, /개별 패키지/);
  assert.doesNotMatch(workshop, /축산물이력번호.*timeline-row/);
});
