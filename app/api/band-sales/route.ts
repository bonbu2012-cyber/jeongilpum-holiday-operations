import { supabaseAdmin } from "../../../db";
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

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value: string) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const admin = url.searchParams.get("admin") === "1";

  if (admin) {
    const denied = await requireOperatorApi();
    if (denied) return denied;

    const [{ data: sales, error: salesError }, { data: products, error: productsError }] = await Promise.all([
      supabaseAdmin.from("band_sales").select("*").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("products").select("id,name,price,daily_limit,active").eq("active", true).order("sort_order", { ascending: true }),
    ]);

    if (salesError) return Response.json({ error: salesError.message }, { status: 500 });
    if (productsError) return Response.json({ error: productsError.message }, { status: 500 });

    return Response.json({
      sales: (sales ?? []).map((sale) => ({ ...sale, state: saleState(sale as BandSaleRow) })),
      products: products ?? [],
      paymentMode: process.env.BAND_PAYMENT_MODE || "test",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("band_sales")
    .select("*")
    .eq("active", true)
    .order("reservation_start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ sale: null, paymentMode: process.env.BAND_PAYMENT_MODE || "test" });

  return Response.json({
    sale: publicSale(data as BandSaleRow),
    paymentMode: process.env.BAND_PAYMENT_MODE || "test",
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

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id,name,active")
    .eq("id", productId)
    .maybeSingle();
  if (productError) return Response.json({ error: productError.message }, { status: 500 });
  if (!product || !product.active) return Response.json({ error: "판매 가능한 상품을 찾을 수 없습니다." }, { status: 404 });

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const deactivate = await supabaseAdmin
    .from("band_sales")
    .update({ active: false, updated_at: now })
    .eq("active", true);
  if (deactivate.error) return Response.json({ error: deactivate.error.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("band_sales")
    .insert({
      id,
      product_id: productId,
      title,
      subtitle,
      price,
      production_limit: productionLimit,
      reserved_qty: 0,
      deposit_per_unit: depositPerUnit,
      reservation_start_at: reservationStartAt,
      reservation_end_at: reservationEndAt,
      production_lock_at: productionLockAt,
      pickup_date: pickupDate,
      pickup_start: pickupStart,
      pickup_end: pickupEnd,
      pickup_location: pickupLocation,
      status: "open",
      active: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sale: data }, { status: 201 });
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
    await supabaseAdmin.from("band_sales").update({ active: false, updated_at: now }).eq("active", true);
  }

  const changes = action === "open"
    ? { status: "open", active: true, updated_at: now }
    : action === "activate"
      ? { active: true, updated_at: now }
      : action === "complete"
        ? { status: "completed", active: false, updated_at: now }
        : { status: "closed", updated_at: now };

  const { data, error } = await supabaseAdmin.from("band_sales").update(changes).eq("id", id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sale: data });
}
