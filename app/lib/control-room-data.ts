import { aggregateProductionNeeds, type BomComponent, type ProductDemand } from "./production-domain";
import type { ComponentRequirement } from "./production-domain";
import { addOperationalDays } from "./operational-date";
import type {
  ControlRoomAlert,
  ControlRoomForecastDay,
  ControlRoomForecastResponse,
  ControlRoomLiveResponse,
  ControlRoomOrderSummary,
  ControlRoomPackageSummary,
  ControlRoomProductionSummary,
  ControlRoomWorkshopSummary,
} from "./control-room-types";

type OperationalOrderRow = {
  id: string;
  order_no: string;
  order_status: string;
  fulfillment_type: string;
  pickup_at: string | null;
  ship_date: string | null;
  customer_arrived: number;
  total_quantity: number;
  package_total: number;
  package_completed: number;
};

type OperationalEventRow = {
  order_id: string;
  event_type: string;
  created_at: string;
};

type DailyOrderRow = {
  schedule_date: string;
  order_count: number;
  total_sets: number;
  onsite: number;
  pickup: number;
  shipping: number;
};

type DailyDemandRow = {
  schedule_date: string;
  product_id: string;
  product_name: string;
  quantity: number;
};

type DailyPackageRow = {
  schedule_date: string;
  package_total: number;
  package_completed: number;
};

type BomRow = {
  product_id: string;
  id: string;
  component_code: string;
  component_name: string;
  quantity_per_product: number;
};

type AvailableRow = { component_code: string; quantity: number };
type BatchSupplyRow = { production_date: string; component_code: string; remaining: number };
type LiveBatchRow = { component_code: string; production_target: number; produced_quantity: number; status: string };
type ControlRoomProductionData = { requirements: ComponentRequirement[]; missingProducts: ProductDemand[]; batches: LiveBatchRow[] };

const changeEventTypes = new Set([
  "order_changed",
  "order_updated",
  "items_changed",
  "fulfillment_changed",
  "schedule_changed",
]);

const severityRank = { critical: 0, warning: 1, production: 2 } as const;

function seoulDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isTerminal(status: string) {
  return status === "fulfilled" || status === "cancelled";
}

function orderStatusLabel(status: string) {
  if (status === "in_progress") return "작업중";
  if (status === "ready") return "준비완료";
  if (status === "fulfilled") return "완료";
  return "작업대기";
}

function eventState(events: OperationalEventRow[]) {
  const acknowledgedAt = events.find((event) => event.event_type === "change_acknowledged")?.created_at ?? "";
  return {
    accepted: events.some((event) => event.event_type === "WORK_ACCEPTED"),
    changed: events.some((event) => changeEventTypes.has(event.event_type) && (!acknowledgedAt || event.created_at > acknowledgedAt)),
  };
}

export function summarizeControlRoomOrders(
  rows: OperationalOrderRow[],
  events: OperationalEventRow[],
  date: string,
  now = new Date(),
) {
  const activeRows = rows.filter((row) => row.order_status !== "cancelled");
  const today = seoulDate(now);
  const selectedIsToday = date === today;
  const eventMap = new Map<string, OperationalEventRow[]>();
  for (const event of events) eventMap.set(event.order_id, [...(eventMap.get(event.order_id) ?? []), event]);

  const derived = activeRows.map((row) => {
    const state = eventState(eventMap.get(row.id) ?? []);
    const terminal = isTerminal(row.order_status);
    const pickupTime = row.pickup_at ? new Date(row.pickup_at).getTime() : Number.NaN;
    const difference = pickupTime - now.getTime();
    const dueSoon = !terminal && row.fulfillment_type === "pickup" && selectedIsToday && difference >= 0 && difference <= 30 * 60 * 1000;
    const pickupOverdue = !terminal && row.fulfillment_type === "pickup" && Boolean(row.pickup_at)
      && (date < today || (selectedIsToday && difference < 0));
    const shippingOverdue = !terminal && row.fulfillment_type === "shipping" && Boolean(row.ship_date) && date < today;
    return { row, ...state, terminal, dueSoon, overdue: pickupOverdue || shippingOverdue };
  });

  const orders: ControlRoomOrderSummary = {
    total: activeRows.length,
    totalSets: activeRows.reduce((sum, row) => sum + Number(row.total_quantity), 0),
    onsite: activeRows.filter((row) => row.fulfillment_type === "onsite").length,
    pickup: activeRows.filter((row) => row.fulfillment_type === "pickup").length,
    shipping: activeRows.filter((row) => row.fulfillment_type === "shipping").length,
    waiting: activeRows.filter((row) => row.order_status === "submitted" || row.order_status === "confirmed").length,
    inProgress: activeRows.filter((row) => row.order_status === "in_progress").length,
    ready: activeRows.filter((row) => row.order_status === "ready").length,
    fulfilled: activeRows.filter((row) => row.order_status === "fulfilled").length,
    arrived: derived.filter((item) => Boolean(item.row.customer_arrived) && !item.terminal).length,
    dueSoon: derived.filter((item) => item.dueSoon).length,
    overdue: derived.filter((item) => item.overdue).length,
    changes: derived.filter((item) => item.changed && !item.terminal).length,
  };

  const workshop: ControlRoomWorkshopSummary = {
    waiting: derived.filter((item) => item.row.order_status === "submitted" || (item.row.order_status === "confirmed" && !item.accepted)).length,
    accepted: derived.filter((item) => item.row.order_status === "confirmed" && item.accepted).length,
    inProgress: orders.inProgress,
    ready: orders.ready,
    urgent: derived.filter((item) => !item.terminal && (Boolean(item.row.customer_arrived) || item.dueSoon || item.overdue)).length,
  };

  const packageTotal = activeRows.reduce((sum, row) => sum + Number(row.package_total), 0);
  const packageCompleted = activeRows.reduce((sum, row) => sum + Number(row.package_completed), 0);
  const packages: ControlRoomPackageSummary = {
    total: packageTotal,
    completed: packageCompleted,
    incomplete: Math.max(0, packageTotal - packageCompleted),
    completionRate: packageTotal ? Math.round(packageCompleted / packageTotal * 100) : 0,
  };

  const alerts: ControlRoomAlert[] = [];
  for (const item of derived) {
    if (item.terminal) continue;
    const detail = `${item.row.order_no} · ${orderStatusLabel(item.row.order_status)}`;
    if (item.row.customer_arrived) {
      alerts.push({ id: `arrived:${item.row.id}`, severity: "critical", area: "workshop", title: "고객 도착 · 아직 준비되지 않음", detail, href: `/workshop?date=${date}` });
    } else if (item.overdue) {
      alerts.push({ id: `overdue:${item.row.id}`, severity: "critical", area: "sales", title: "일정이 지났지만 완료되지 않음", detail, href: `/sales?date=${date}` });
    } else if (item.dueSoon) {
      alerts.push({ id: `due:${item.row.id}`, severity: "warning", area: "workshop", title: "30분 이내 수령 미완료", detail, href: `/workshop?date=${date}` });
    }
    if (item.changed) {
      alerts.push({ id: `change:${item.row.id}`, severity: "warning", area: "sales", title: "주문변경 확인 필요", detail, href: `/sales?date=${date}` });
    }
  }

  return { orders, workshop, packages, alerts };
}

function productionSummary(overview: ControlRoomProductionData | null): ControlRoomProductionSummary {
  if (!overview) {
    return { available: false, requiredPacks: 0, availablePacks: 0, shortagePacks: 0, uncoveredPacks: 0, missingBomProducts: 0, activeBatches: 0, batchTarget: 0, batchProduced: 0 };
  }
  const active = overview.batches.filter((batch) => batch.status === "planned" || batch.status === "in_progress");
  const remainingByComponent = new Map<string, number>();
  for (const batch of active) {
    remainingByComponent.set(batch.component_code, (remainingByComponent.get(batch.component_code) ?? 0) + Math.max(0, batch.production_target - batch.produced_quantity));
  }
  return {
    available: true,
    requiredPacks: overview.requirements.reduce((sum, item) => sum + item.requiredQuantity, 0),
    availablePacks: overview.requirements.reduce((sum, item) => sum + item.availableQuantity, 0),
    shortagePacks: overview.requirements.reduce((sum, item) => sum + item.additionalNeeded, 0),
    uncoveredPacks: overview.requirements.reduce((sum, item) => sum + Math.max(0, item.additionalNeeded - (remainingByComponent.get(item.componentCode) ?? 0)), 0),
    missingBomProducts: overview.missingProducts.length,
    activeBatches: active.length,
    batchTarget: active.reduce((sum, batch) => sum + batch.production_target, 0),
    batchProduced: active.reduce((sum, batch) => sum + batch.produced_quantity, 0),
  };
}

async function loadControlRoomProduction(db: D1Database, date: string): Promise<ControlRoomProductionData> {
  const [demandResult, availableResult, batchResult] = await Promise.all([
    db.prepare("SELECT oi.product_id,p.name AS product_name,SUM(oi.quantity) AS quantity FROM orders o JOIN fulfillments f ON f.order_id=o.id JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.order_status NOT IN ('cancelled','fulfilled') AND o.fulfillment_type!='onsite' AND ((f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?)) GROUP BY oi.product_id,p.name").bind(date, date).all<{ product_id: string; product_name: string; quantity: number }>(),
    db.prepare("SELECT component_code,COUNT(*) AS quantity FROM skin_packs WHERE status='available' GROUP BY component_code").all<AvailableRow>(),
    db.prepare("SELECT component_code,production_target,produced_quantity,status FROM production_batches WHERE production_date=? AND status!='cancelled'").bind(date).all<LiveBatchRow>(),
  ]);
  const demands: ProductDemand[] = demandResult.results.map((row) => ({ productId: row.product_id, productName: row.product_name, quantity: Number(row.quantity) }));
  let bom: BomComponent[] = [];
  if (demands.length) {
    const placeholders = demands.map(() => "?").join(",");
    const rows = await db.prepare(`SELECT id,product_id,component_code,component_name,quantity_per_product FROM product_components WHERE active=1 AND product_id IN (${placeholders}) ORDER BY product_id,sort_order`).bind(...demands.map((item) => item.productId)).all<BomRow>();
    bom = rows.results.map((row) => ({ productId: row.product_id, componentId: row.id, componentCode: row.component_code, componentName: row.component_name, quantityPerProduct: Number(row.quantity_per_product) }));
  }
  const available = Object.fromEntries(availableResult.results.map((row) => [row.component_code, Number(row.quantity)]));
  const expanded = aggregateProductionNeeds(demands, bom, available);
  return { ...expanded, batches: batchResult.results };
}

async function loadOperationalOrders(db: D1Database, date: string) {
  const rows = await db.prepare(`
    SELECT
      o.id,o.order_no,o.order_status,o.fulfillment_type,
      f.pickup_at,f.ship_date,f.customer_arrived,
      COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id=o.id),0) AS total_quantity,
      COALESCE((SELECT COUNT(*) FROM packages p WHERE p.order_id=o.id AND p.package_status!='voided'),0) AS package_total,
      COALESCE((SELECT COUNT(*) FROM packages p WHERE p.order_id=o.id AND p.package_status IN ('completed','handed_over')),0) AS package_completed
    FROM orders o
    JOIN fulfillments f ON f.order_id=o.id
    WHERE o.order_status!='cancelled' AND (
      (o.fulfillment_type='onsite' AND substr(f.pickup_at,1,10)=?) OR
      (o.fulfillment_type!='onsite' AND f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR
      (f.fulfillment_type='shipping' AND f.ship_date=?)
    )
    ORDER BY COALESCE(f.pickup_at,f.ship_date),o.created_at
    LIMIT 500
  `).bind(date, date, date).all<OperationalOrderRow>();
  if (!rows.results.length) return { rows: [], events: [] };
  const placeholders = rows.results.map(() => "?").join(",");
  const events = await db.prepare(`
    SELECT order_id,event_type,created_at
    FROM order_events
    WHERE order_id IN (${placeholders}) AND event_type IN (
      'WORK_ACCEPTED','change_acknowledged','order_changed','order_updated','items_changed','fulfillment_changed','schedule_changed'
    )
    ORDER BY created_at DESC,id DESC
  `).bind(...rows.results.map((row) => row.id)).all<OperationalEventRow>();
  return { rows: rows.results, events: events.results };
}

export async function loadControlRoomLive(db: D1Database, date: string, workerId: string, now = new Date()): Promise<ControlRoomLiveResponse> {
  void workerId;
  const [operational, overview] = await Promise.all([
    loadOperationalOrders(db, date),
    loadControlRoomProduction(db, date).catch(() => null),
  ]);
  const summarized = summarizeControlRoomOrders(operational.rows, operational.events, date, now);
  const production = productionSummary(overview);
  const alerts = [...summarized.alerts];
  if (summarized.packages.incomplete > 0) {
    alerts.push({ id: "packages:incomplete", severity: "warning", area: "workshop", title: "오늘 패키지 미완성", detail: `${summarized.packages.incomplete}세트 조립 필요`, href: `/workshop?date=${date}` });
  }
  if (production.available && production.missingBomProducts > 0) {
    alerts.push({ id: "production:missing-bom", severity: "production", area: "production", title: "BOM이 없는 주문상품", detail: `${production.missingBomProducts}개 상품 확인 필요`, href: `/workshop/production?date=${date}` });
  }
  if (production.available && production.uncoveredPacks > 0) {
    alerts.push({ id: "production:shortage", severity: "production", area: "production", title: "생산계획으로 충당되지 않는 부족량", detail: `${production.uncoveredPacks}팩 추가 계획 필요`, href: `/workshop/production?date=${date}` });
  }
  alerts.sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.title.localeCompare(right.title, "ko"));
  return { date, generatedAt: now.toISOString(), orders: summarized.orders, workshop: summarized.workshop, production, packages: summarized.packages, alerts };
}

function scheduleExpression() {
  return "CASE WHEN o.fulfillment_type='onsite' THEN substr(f.pickup_at,1,10) WHEN f.fulfillment_type='pickup' THEN substr(f.pickup_at,1,10) ELSE f.ship_date END";
}

export async function loadControlRoomForecast(db: D1Database, startDate: string, days: number, now = new Date()): Promise<ControlRoomForecastResponse> {
  const rangeStart = addOperationalDays(startDate, 1);
  const rangeEnd = addOperationalDays(startDate, days);
  const schedule = scheduleExpression();
  const [dailyOrders, dailyPackages] = await Promise.all([
    db.prepare(`
      WITH scheduled AS (
        SELECT o.id,o.fulfillment_type,${schedule} AS schedule_date,
          COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id=o.id),0) AS total_sets
        FROM orders o JOIN fulfillments f ON f.order_id=o.id
        WHERE o.order_status!='cancelled'
      )
      SELECT schedule_date,COUNT(*) AS order_count,SUM(total_sets) AS total_sets,
        SUM(CASE WHEN fulfillment_type='onsite' THEN 1 ELSE 0 END) AS onsite,
        SUM(CASE WHEN fulfillment_type='pickup' THEN 1 ELSE 0 END) AS pickup,
        SUM(CASE WHEN fulfillment_type='shipping' THEN 1 ELSE 0 END) AS shipping
      FROM scheduled WHERE schedule_date BETWEEN ? AND ? GROUP BY schedule_date
    `).bind(rangeStart, rangeEnd).all<DailyOrderRow>(),
    db.prepare(`
      WITH scheduled AS (
        SELECT o.id,${schedule} AS schedule_date
        FROM orders o JOIN fulfillments f ON f.order_id=o.id
        WHERE o.order_status!='cancelled'
      )
      SELECT s.schedule_date,COUNT(p.id) AS package_total,
        SUM(CASE WHEN p.package_status IN ('completed','handed_over') THEN 1 ELSE 0 END) AS package_completed
      FROM scheduled s LEFT JOIN packages p ON p.order_id=s.id AND p.package_status!='voided'
      WHERE s.schedule_date BETWEEN ? AND ? GROUP BY s.schedule_date
    `).bind(rangeStart, rangeEnd).all<DailyPackageRow>(),
  ]);

  let productionAvailable = true;
  let demandRows: DailyDemandRow[] = [];
  let bomRows: BomRow[] = [];
  let availableRows: AvailableRow[] = [];
  let batchRows: BatchSupplyRow[] = [];
  try {
    const demands = await db.prepare(`
      SELECT ${schedule} AS schedule_date,oi.product_id,p.name AS product_name,SUM(oi.quantity) AS quantity
      FROM orders o JOIN fulfillments f ON f.order_id=o.id
      JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id
      WHERE o.order_status NOT IN ('cancelled','fulfilled') AND o.fulfillment_type!='onsite' AND ${schedule} BETWEEN ? AND ?
      GROUP BY schedule_date,oi.product_id,p.name
    `).bind(rangeStart, rangeEnd).all<DailyDemandRow>();
    demandRows = demands.results;
    const productIds = [...new Set(demandRows.map((row) => row.product_id))];
    const [available, batches] = await Promise.all([
      db.prepare("SELECT component_code,COUNT(*) AS quantity FROM skin_packs WHERE status='available' GROUP BY component_code").all<AvailableRow>(),
      db.prepare("SELECT production_date,component_code,SUM(MAX(0,production_target-produced_quantity)) AS remaining FROM production_batches WHERE production_date BETWEEN ? AND ? AND status IN ('planned','in_progress') GROUP BY production_date,component_code").bind(rangeStart, rangeEnd).all<BatchSupplyRow>(),
    ]);
    availableRows = available.results;
    batchRows = batches.results;
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const bom = await db.prepare(`SELECT id,product_id,component_code,component_name,quantity_per_product FROM product_components WHERE active=1 AND product_id IN (${placeholders}) ORDER BY product_id,sort_order`).bind(...productIds).all<BomRow>();
      bomRows = bom.results;
    }
  } catch {
    productionAvailable = false;
  }

  const inventory: Record<string, number> = Object.fromEntries(availableRows.map((row) => [row.component_code, Number(row.quantity)]));
  const bom: BomComponent[] = bomRows.map((row) => ({ productId: row.product_id, componentId: row.id, componentCode: row.component_code, componentName: row.component_name, quantityPerProduct: Number(row.quantity_per_product) }));
  const forecast: ControlRoomForecastDay[] = [];
  for (let offset = 1; offset <= days; offset += 1) {
    const date = addOperationalDays(startDate, offset);
    const orders = dailyOrders.results.find((row) => row.schedule_date === date);
    const packages = dailyPackages.results.find((row) => row.schedule_date === date);
    for (const supply of batchRows.filter((row) => row.production_date === date)) {
      inventory[supply.component_code] = (inventory[supply.component_code] ?? 0) + Number(supply.remaining);
    }
    const demands: ProductDemand[] = demandRows.filter((row) => row.schedule_date === date).map((row) => ({ productId: row.product_id, productName: row.product_name, quantity: Number(row.quantity) }));
    const expanded = productionAvailable ? aggregateProductionNeeds(demands, bom, inventory) : { requirements: [], missingProducts: [] };
    for (const requirement of expanded.requirements) inventory[requirement.componentCode] = Math.max(0, (inventory[requirement.componentCode] ?? 0) - requirement.requiredQuantity);
    forecast.push({
      date,
      orderCount: Number(orders?.order_count ?? 0),
      totalSets: Number(orders?.total_sets ?? 0),
      onsite: Number(orders?.onsite ?? 0),
      pickup: Number(orders?.pickup ?? 0),
      shipping: Number(orders?.shipping ?? 0),
      packageTotal: Number(packages?.package_total ?? 0),
      packageCompleted: Number(packages?.package_completed ?? 0),
      productionAvailable,
      requiredPacks: expanded.requirements.reduce((sum, item) => sum + item.requiredQuantity, 0),
      shortagePacks: expanded.requirements.reduce((sum, item) => sum + item.additionalNeeded, 0),
      missingBomProducts: expanded.missingProducts.length,
    });
  }
  return { startDate, days, generatedAt: now.toISOString(), forecast };
}

