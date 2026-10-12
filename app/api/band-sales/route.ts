import { getDb } from "../../../db";
import { publicSale, saleState, type BandSaleRow } from "../../lib/band-reservation";
import { requireOperatorApi } from "../../lib/operator-session";

type SaleInput = {
  productId?: string;
  title?: string;
  subtitle?: string;
  price?: number;
  productionLimit?: number;
  depositPerUnit?: number;
  reservationStartAt?: string;
  reservationEndAt?: string;
  productionLockAt?: string;
  pickupDate?: string;
  pickupStart?: string;
  pickupEnd?: string;
  pickupLocation?: string;
};

type ProductRow = {
  id: string;
  name: string;
  price: number;
  daily_limit: number | null;
  active: number | boolean;
};

const DB = getDb();

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value: string) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function paymentMode() {
  return process.env.BAND_PAYMENT_MODE || "test";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin = url.searchParams.get("admin") === "1";

  if (admin) {
    const denied = await requireOperatorApi();
    if (denied) return denied;

    const [salesResult, productsResult] = await Promise.all([
      DB.prepare(`
        SELECT *
        FROM band_sales
        ORDER BY created_at DESC
        LIMIT 30
      `).all<BandSaleRow>(),
      DB.prepare(`
        SELECT id,name,price,daily_limit,active
        FROM products
        WHERE active=1
        ORDER BY sort_order,display_order,name
      `).all<ProductRow>(),
    ]);

    return Response.json({
      sales: salesResult.results.map((sale) => ({ ...sale, state: saleState(sale) })),
      products: productsResult.results,
      paymentMode: paymentMode(),
    });
  }

  const sale = await DB.prepare(`
    SELECT *
    FROM band_sales
    WHERE active=1
    ORDER BY reservation_start_at DESC
    LIMIT 1
  `).first<BandSaleRow>();

  return Response.json({
    sale: sale ? publicSale(sale) : null,
    paymentMode: paymentMode(),
  });
}

export async function POST(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const payload = await request.json().catch(() => ({})) as SaleInput;
  const productId = clean(payload.productId);
  const title = clean(payload.title);
  const subtitle = clean(payload.subtitle);
  const price = Number(payload.price);
  const productionLimit = Number(payload.productionLimit);
  const depositPerUnit = Number(payload.depositPerUnit ?? 1000);
  const reservationStartAt = clean(payload.reservationStartAt);
  const reservationEndAt = clean(payload.reservationEndAt);
  const productionLockAt = clean(payload.productionLockAt);
  const pickupDate = clean(payload.pickupDate);
  const pickupStart = clean(payload.pickupStart) || "10:00";
  const pickupEnd = clean(payload.pickupEnd) || "19:00";
  const pickupLocation = clean(payload.pickupLocation);

  if (!productId || !title || !Number.isInteger(price) || price <= 0) {
    return Response.json({ error: "상품과 판매가를 확인해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(productionLimit) || productionLimit < 1 || productionLimit > 1000) {
    return Response.json({ error: "최대 생산수량은 1~1000개로 입력해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(depositPerUnit) || depositPerUnit < 0 || depositPerUnit > price) {
    return Response.json({ error: "예약금을 확인해주세요." }, { status: 400 });
  }
  if (![reservationStartAt, reservationEndAt, productionLockAt].every(validIso) || !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) {
    return Response.json({ error: "예약/생산/픽업 일정을 확인해주세요." }, { status: 400 });
  }
  if (new Date(reservationStartAt) >= new Date(reservationEndAt) || new Date(reservationEndAt) > new Date(productionLockAt)) {
    return Response.json({ error: "예약시작 < 예약마감 <= 생산확정 순서로 입력해주세요." }, { status: 400 });
  }

  const product = await DB.prepare(`
    SELECT id,name,price,daily_limit,active
    FROM products
    WHERE id=? AND active=1
    LIMIT 1
  `).bind(productId).first<ProductRow>();
  if (!product) return Response.json({ error: "판매 가능한 상품을 찾을 수 없습니다." }, { status: 404 });

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await DB.batch([
    DB.prepare(`
      UPDATE band_sales
      SET active=FALSE,updated_at=?
      WHERE active=TRUE
    `).bind(now),
    DB.prepare(`
      INSERT INTO band_sales(
        id,product_id,title,subtitle,price,production_limit,reserved_qty,deposit_per_unit,
        reservation_start_at,reservation_end_at,production_lock_at,pickup_date,pickup_start,pickup_end,
        pickup_location,status,active,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,0,?,?,?,?,?,?,?,?, 'open',TRUE,?,?)
    `).bind(
      id,
      productId,
      title,
      subtitle,
      price,
      productionLimit,
      depositPerUnit,
      reservationStartAt,
      reservationEndAt,
      productionLockAt,
      pickupDate,
      pickupStart,
      pickupEnd,
      pickupLocation,
      now,
      now,
    ),
  ]);

  const sale = await DB.prepare("SELECT * FROM band_sales WHERE id=? LIMIT 1").bind(id).first<BandSaleRow>();
  return Response.json({ sale }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  const payload = await request.json().catch(() => ({})) as { id?: string; action?: string };
  const id = clean(payload.id);
  const action = clean(payload.action);
  if (!id || !["open", "close", "complete", "activate"].includes(action)) {
    return Response.json({ error: "판매회차와 작업을 확인해주세요." }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (action === "activate") {
    await DB.prepare("UPDATE band_sales SET active=FALSE,updated_at=? WHERE active=TRUE").bind(now).run();
  }

  const status = action === "open" ? "open" : action === "complete" ? "completed" : action === "close" ? "closed" : null;
  const active = action === "complete" ? false : action === "activate" || action === "open" ? true : null;

  if (status !== null && active !== null) {
    await DB.prepare("UPDATE band_sales SET status=?,active=?,updated_at=? WHERE id=?").bind(status, active, now, id).run();
  } else if (status !== null) {
    await DB.prepare("UPDATE band_sales SET status=?,updated_at=? WHERE id=?").bind(status, now, id).run();
  } else if (active !== null) {
    await DB.prepare("UPDATE band_sales SET active=?,updated_at=? WHERE id=?").bind(active, now, id).run();
  }

  const sale = await DB.prepare("SELECT * FROM band_sales WHERE id=? LIMIT 1").bind(id).first<BandSaleRow>();
  if (!sale) return Response.json({ error: "판매회차를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ sale });
}
