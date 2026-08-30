import { aggregateProductionNeeds, type BomComponent, type ProductDemand } from "./production-domain";
import type { ProductionBatch, ProductionOverview } from "./production-types";

type DemandRow = { product_id: string; product_name: string; quantity: number };
type BomRow = { product_id: string; id: string; component_code: string; component_name: string; quantity_per_product: number };
type AvailableRow = { component_code: string; quantity: number };
type BatchRow = { id: string; production_date: string; parent_batch_id: string | null; segment_no: number; component_code: string; cut_name_snapshot: string; required_quantity: number; available_quantity_at_start: number; additional_needed: number; production_target: number; produced_quantity: number; traceability_no: string; origin: string; slaughterhouse: string; cattle_type: string; grade: string; storage_method: string; expiry_text: string; packaging_material: string; food_type: string; status: ProductionBatch["status"] };
type TraceRow = { traceability_no: string; origin: string; slaughterhouse: string; cattle_type: string; grade: string; last_used_at: string };

export async function loadProductionOverview(db: D1Database, date: string, workerId: string): Promise<ProductionOverview> {
  const [demandRows, availableRows, batchRows] = await Promise.all([
    db.prepare("SELECT oi.product_id,p.name AS product_name,SUM(oi.quantity) AS quantity FROM orders o JOIN fulfillments f ON f.order_id=o.id JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.order_status!='cancelled' AND ((f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?)) GROUP BY oi.product_id,p.name").bind(date, date).all<DemandRow>(),
    db.prepare("SELECT component_code,COUNT(*) AS quantity FROM skin_packs WHERE status='available' GROUP BY component_code").all<AvailableRow>(),
    db.prepare("SELECT id,production_date,parent_batch_id,segment_no,component_code,cut_name_snapshot,required_quantity,available_quantity_at_start,additional_needed,production_target,produced_quantity,traceability_no,origin,slaughterhouse,cattle_type,grade,storage_method,expiry_text,packaging_material,food_type,status FROM production_batches WHERE production_date=? AND status!='cancelled' ORDER BY component_code,segment_no,started_at").bind(date).all<BatchRow>(),
  ]);
  const demands: ProductDemand[] = demandRows.results.map((row) => ({ productId: row.product_id, productName: row.product_name, quantity: Number(row.quantity) }));
  let bom: BomComponent[] = [];
  if (demands.length) {
    const placeholders = demands.map(() => "?").join(",");
    const rows = await db.prepare(`SELECT id,product_id,component_code,component_name,quantity_per_product FROM product_components WHERE active=1 AND product_id IN (${placeholders}) ORDER BY product_id,sort_order`).bind(...demands.map((item) => item.productId)).all<BomRow>();
    bom = rows.results.map((row) => ({ productId: row.product_id, componentId: row.id, componentCode: row.component_code, componentName: row.component_name, quantityPerProduct: row.quantity_per_product }));
  }
  const available = Object.fromEntries(availableRows.results.map((row) => [row.component_code, Number(row.quantity)]));
  const expanded = aggregateProductionNeeds(demands, bom, available);
  const seoulToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const recent = await db.prepare("SELECT traceability_no,origin,slaughterhouse,cattle_type,grade,last_used_at FROM traceability_records WHERE last_used_by=? ORDER BY CASE WHEN date(last_used_at,'+9 hours')=? THEN 0 ELSE 1 END,last_used_at DESC LIMIT 5").bind(workerId, seoulToday).all<TraceRow>();
  return {
    requirements: expanded.requirements,
    missingProducts: expanded.missingProducts,
    batches: batchRows.results.map((row) => ({ id: row.id, productionDate: row.production_date, parentBatchId: row.parent_batch_id, segmentNo: row.segment_no, componentCode: row.component_code, cutName: row.cut_name_snapshot, requiredQuantity: row.required_quantity, availableQuantityAtStart: row.available_quantity_at_start, additionalNeeded: row.additional_needed, productionTarget: row.production_target, producedQuantity: row.produced_quantity, traceabilityNo: row.traceability_no, origin: row.origin, slaughterhouse: row.slaughterhouse, cattleType: row.cattle_type, grade: row.grade, storageMethod: row.storage_method, expiryText: row.expiry_text, packagingMaterial: row.packaging_material, foodType: row.food_type, status: row.status })),
    recentTraceability: recent.results.map((row) => ({ traceabilityNo: row.traceability_no, origin: row.origin, slaughterhouse: row.slaughterhouse, cattleType: row.cattle_type, grade: row.grade, lastUsedAt: row.last_used_at })),
  };
}
