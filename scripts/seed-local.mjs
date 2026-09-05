import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const persistTo = resolve(root, ".wrangler/state");
const SEED_PREFIX = "seed-local-";
const CLEAR_ONLY = process.argv.includes("--clear");
const ORDER_COUNT = 32;

const DELIVERY_METHODS = ["onsite_sale", "onsite_reservation", "delivery"];
const WORK_STATUSES = ["received", "confirmed", "in_progress", "ready", "completed"];
const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오"];
const FAKE_MARKERS = ["테스트", "샘플", "예시", "가상", "연습"];
const ADDRESS_POOL = [
  { postal: "00001", road: "서울특별시 중구 테스트로 12", jibun: "서울특별시 중구 견본동 12-3", detail: "샘플빌딩 3층" },
  { postal: "00002", road: "경기도 성남시 분당구 샘플길 34", jibun: "경기도 성남시 분당구 예시동 45-6", detail: "연습아파트 101동 202호" },
  { postal: "00003", road: "부산광역시 해운대구 가상로 56", jibun: "부산광역시 해운대구 견본동 78-9", detail: "테스트타워 5층" },
  { postal: "00004", road: "인천광역시 남동구 임시길 78", jibun: "인천광역시 남동구 견본동 12-3", detail: "예시상가 2층" },
];

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

function runWrangler(args, captureOutput) {
  return new Promise((settle, fail) => {
    const child = spawn(
      "wrangler",
      ["d1", "execute", "DB", "--local", "-c", "scripts/wrangler.jsonc", "--persist-to", persistTo, ...args],
      {
        cwd: root,
        env: {
          ...process.env,
          WRANGLER_WRITE_LOGS: "false",
          WRANGLER_LOG_PATH: ".wrangler/logs",
          MINIFLARE_REGISTRY_PATH: ".wrangler/registry",
        },
        stdio: captureOutput ? ["ignore", "pipe", "inherit"] : "inherit",
      },
    );
    let stdout = "";
    if (captureOutput) child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.once("error", fail);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        settle(stdout);
        return;
      }
      fail(new Error(`wrangler d1 execute failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

async function queryJson(sql) {
  const stdout = await runWrangler(["--json", "--command", sql], true);
  const [result] = JSON.parse(stdout);
  return result.results;
}

async function runSqlFile(sql) {
  const dir = await mkdtemp(join(tmpdir(), "seed-local-"));
  const file = join(dir, "batch.sql");
  await writeFile(file, sql, "utf8");
  try {
    await runWrangler(["--file", file], false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertStatement(table, columns, rows) {
  const values = rows
    .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(",")})`)
    .join(",\n");
  return `INSERT INTO ${table}(${columns.join(",")}) VALUES\n${values};`;
}

async function countSeedRows() {
  const [orderRow] = await queryJson(`SELECT count(*) AS c FROM orders WHERE id LIKE '${SEED_PREFIX}%'`);
  const [itemRow] = await queryJson(`SELECT count(*) AS c FROM work_items WHERE id LIKE '${SEED_PREFIX}%'`);
  return { orders: orderRow.c, workItems: itemRow.c };
}

async function clearSeedRows() {
  await runSqlFile([
    `DELETE FROM work_item_events WHERE order_id LIKE '${SEED_PREFIX}%' OR work_item_id LIKE '${SEED_PREFIX}%';`,
    `DELETE FROM work_items WHERE id LIKE '${SEED_PREFIX}%';`,
    `DELETE FROM orders WHERE id LIKE '${SEED_PREFIX}%';`,
  ].join("\n"));
}

function pad(n, width) {
  return String(n).padStart(width, "0");
}

function seoulTodayParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function isoDateAtOffset(base, offsetDays) {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function fakeBuyerName(index) {
  const surname = SURNAMES[index % SURNAMES.length];
  const marker = FAKE_MARKERS[index % FAKE_MARKERS.length];
  return `${surname}${marker}${pad(index, 2)}`;
}

function fakePhone(index) {
  return `0100000${pad(index % 10000, 4)}`;
}

function dueAtFor(deliveryMethod, date, index) {
  if (deliveryMethod === "delivery") return `${date}T00:00:00+09:00`;
  const hour = pad(9 + (index % 9), 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${date}T${hour}:${minute}:00+09:00`;
}

function paymentFor(workStatus, totalAmount, index) {
  if (workStatus === "completed") return { paymentStatus: "paid", paidAmount: totalAmount };
  if (index % 4 === 0) return { paymentStatus: "partial", paidAmount: Math.round(totalAmount / 2) };
  return { paymentStatus: "unpaid", paidAmount: 0 };
}

function buildSeedData(products, now) {
  const orders = [];
  const workItems = [];
  const today = seoulTodayParts();

  for (let i = 1; i <= ORDER_COUNT; i += 1) {
    const orderId = `${SEED_PREFIX}order-${pad(i, 3)}`;
    const deliveryMethod = DELIVERY_METHODS[(i - 1) % DELIVERY_METHODS.length];
    const workStatus = WORK_STATUSES[(i - 1) % WORK_STATUSES.length];
    const dueDate = isoDateAtOffset(today, ((i - 1) % 4) - 1);
    const dueAt = dueAtFor(deliveryMethod, dueDate, i);
    const buyerName = fakeBuyerName(i);
    const buyerPhone = fakePhone(i);
    const address = deliveryMethod === "delivery" ? ADDRESS_POOL[(i - 1) % ADDRESS_POOL.length] : null;
    const itemCount = i % 5 === 0 ? 2 + (i % 2) : 1;
    const createdAt = new Date(now - ((i * 41) % (3 * 24 * 60)) * 60_000).toISOString();

    const items = [];
    for (let j = 1; j <= itemCount; j += 1) {
      const product = products[(i * 3 + j) % products.length];
      const quantity = 1 + ((i + j) % 3);
      const lineTotal = product.price * quantity;
      items.push({
        id: `${SEED_PREFIX}item-${pad(i, 3)}-${pad(j, 2)}`,
        orderId,
        productId: product.id,
        productNameSnapshot: product.name,
        unitPriceSnapshot: product.price,
        quantity,
        lineTotal,
        deliveryMethod,
        dueAt,
        workStatus,
        recipientName: deliveryMethod === "delivery" ? buyerName : null,
        recipientPhone: deliveryMethod === "delivery" ? buyerPhone : null,
        postalCode: address ? address.postal : null,
        roadAddr: address ? address.road : null,
        roadAddrReference: null,
        jibunAddr: address ? address.jibun : null,
        detailAddr: address ? address.detail : null,
        customizationJson: null,
        note: "",
        version: 1,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const { paymentStatus, paidAmount } = paymentFor(workStatus, totalAmount, i);

    orders.push({
      id: orderId,
      orderNo: `JI-SEED-${pad(i, 4)}`,
      buyerName,
      buyerPhone,
      paymentStatus,
      paidAmount,
      totalAmount,
      customerArrivedAt: null,
      customerNote: "",
      idempotencyKey: `${SEED_PREFIX}idem-${pad(i, 3)}`,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
    workItems.push(...items);
  }

  return { orders, workItems };
}

async function seed() {
  const products = await queryJson("SELECT id, name, price FROM products WHERE active=1");
  if (products.length === 0) {
    throw new Error("No active products found. Run `npm run db:local` first so the catalogue is seeded.");
  }

  const { orders, workItems } = buildSeedData(products, Date.now());

  const orderColumns = [
    "id", "order_no", "buyer_name", "buyer_phone", "payment_status", "paid_amount",
    "total_amount", "customer_arrived_at", "customer_note", "idempotency_key",
    "version", "created_at", "updated_at",
  ];
  const orderRows = orders.map((order) => ({
    id: order.id,
    order_no: order.orderNo,
    buyer_name: order.buyerName,
    buyer_phone: order.buyerPhone,
    payment_status: order.paymentStatus,
    paid_amount: order.paidAmount,
    total_amount: order.totalAmount,
    customer_arrived_at: order.customerArrivedAt,
    customer_note: order.customerNote,
    idempotency_key: order.idempotencyKey,
    version: order.version,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  }));

  const workItemColumns = [
    "id", "order_id", "product_id", "product_name_snapshot", "unit_price_snapshot", "quantity",
    "line_total", "delivery_method", "due_at", "work_status", "recipient_name", "recipient_phone",
    "postal_code", "road_addr", "road_addr_reference", "jibun_addr", "detail_addr",
    "customization_json", "note", "version", "created_at", "updated_at",
  ];
  const workItemRows = workItems.map((item) => ({
    id: item.id,
    order_id: item.orderId,
    product_id: item.productId,
    product_name_snapshot: item.productNameSnapshot,
    unit_price_snapshot: item.unitPriceSnapshot,
    quantity: item.quantity,
    line_total: item.lineTotal,
    delivery_method: item.deliveryMethod,
    due_at: item.dueAt,
    work_status: item.workStatus,
    recipient_name: item.recipientName,
    recipient_phone: item.recipientPhone,
    postal_code: item.postalCode,
    road_addr: item.roadAddr,
    road_addr_reference: item.roadAddrReference,
    jibun_addr: item.jibunAddr,
    detail_addr: item.detailAddr,
    customization_json: item.customizationJson,
    note: item.note,
    version: item.version,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }));

  await clearSeedRows();
  await runSqlFile([
    insertStatement("orders", orderColumns, orderRows),
    insertStatement("work_items", workItemColumns, workItemRows),
  ].join("\n\n"));

  const after = await countSeedRows();
  console.log(`Seeded ${after.orders} orders and ${after.workItems} work items (id prefix: ${SEED_PREFIX}).`);
}

async function clear() {
  const before = await countSeedRows();
  await clearSeedRows();
  console.log(`Cleared ${before.orders} seed orders and ${before.workItems} seed work items.`);
}

if (CLEAR_ONLY) {
  await clear();
} else {
  await seed();
}
