import { buildLabelPayload } from "./package-domain";
import type { WorkshopPackageDetail } from "./package-types";

type PackageRow = { id: string; order_id: string; package_code: string; package_status: string; order_no: string; product_name_snapshot: string; fulfillment_type: "pickup" | "shipping"; pickup_at: string | null; ship_date: string | null };
type ComponentRow = { id: string; component_name_snapshot: string; sort_order: number; traceability_required: number; weight_required: number; origin_required: number; slaughterhouse_required: number; traceability_no: string | null; weight_g: number | null; origin: string; slaughterhouse: string; cattle_type: string; grade: string };
type TraceRow = { traceability_no: string; origin: string; slaughterhouse: string; cattle_type: string; grade: string; last_used_at: string };
type LabelRow = { version: number; status: "draft" | "printed" | "void"; created_at: string; printed_at: string | null; voided_at: string | null };
type AuditRow = { id: string; event_type: string; created_at: string };
type AssignmentRow = { id: string; reason: string; from_order_no: string | null; to_order_no: string; changed_at: string };

export async function loadWorkshopPackage(db: D1Database, packageCode: string, workerId: string): Promise<WorkshopPackageDetail | null> {
  const value = await db.prepare("SELECT p.id,p.order_id,p.package_code,p.package_status,p.product_name_snapshot,o.order_no,f.fulfillment_type,f.pickup_at,f.ship_date FROM packages p JOIN orders o ON o.id=p.order_id JOIN fulfillments f ON f.order_id=o.id WHERE p.package_code=?").bind(packageCode).first<PackageRow>();
  if (!value) return null;
  const seoulToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [components, recent, labels, assignments, audits] = await Promise.all([
    db.prepare("SELECT pc.id,pc.component_name_snapshot,pc.sort_order,pc.traceability_required,pc.weight_required,pc.origin_required,pc.slaughterhouse_required,pc.traceability_no,pc.weight_g,pc.origin,pc.slaughterhouse,COALESCE(t.cattle_type,'') AS cattle_type,COALESCE(t.grade,'') AS grade FROM package_components pc LEFT JOIN traceability_records t ON t.traceability_no=pc.traceability_no WHERE pc.package_id=? ORDER BY pc.sort_order,pc.id").bind(value.id).all<ComponentRow>(),
    db.prepare("SELECT traceability_no,origin,slaughterhouse,cattle_type,grade,last_used_at FROM traceability_records WHERE last_used_by=? ORDER BY CASE WHEN date(last_used_at,'+9 hours')=? THEN 0 ELSE 1 END,last_used_at DESC LIMIT 5").bind(workerId, seoulToday).all<TraceRow>(),
    db.prepare("SELECT version,status,created_at,printed_at,voided_at FROM package_labels WHERE package_id=? ORDER BY version DESC LIMIT 10").bind(value.id).all<LabelRow>(),
    db.prepare("SELECT h.id,h.reason,fo.order_no AS from_order_no,t.order_no AS to_order_no,h.changed_at FROM package_assignment_history h LEFT JOIN orders fo ON fo.id=h.from_order_id JOIN orders t ON t.id=h.to_order_id WHERE h.package_id=? ORDER BY h.changed_at DESC,h.id DESC").bind(value.id).all<AssignmentRow>(),
    db.prepare("SELECT id,event_type,created_at FROM order_events WHERE order_id=? AND event_type IN ('PACKAGE_TRACEABILITY_UPDATED','PACKAGE_WEIGHT_UPDATED','PACKAGE_LABEL_PREVIEWED') AND after_data LIKE ? ORDER BY created_at DESC,id DESC LIMIT 30").bind(value.order_id, '%"packageId":"' + value.id + '"%').all<AuditRow>(),
  ]);
  const schedule = value.fulfillment_type === "shipping" ? `${value.ship_date ?? "일정 미지정"} 발송` : value.pickup_at ? `${value.pickup_at.slice(0, 10)} ${value.pickup_at.slice(11, 16)} 방문` : "일정 미지정";
  return {
    packageId: value.id,
    orderId: value.order_id,
    packageCode: value.package_code,
    packageStatus: value.package_status,
    orderNo: value.order_no,
    productName: value.product_name_snapshot,
    fulfillmentType: value.fulfillment_type,
    schedule,
    qrValue: `/workshop/packages/${encodeURIComponent(value.package_code)}`,
    components: components.results.map((component) => ({
      id: component.id,
      componentName: component.component_name_snapshot,
      sortOrder: component.sort_order,
      traceabilityRequired: Boolean(component.traceability_required),
      weightRequired: Boolean(component.weight_required),
      originRequired: Boolean(component.origin_required),
      slaughterhouseRequired: Boolean(component.slaughterhouse_required),
      traceabilityNo: component.traceability_no,
      weightG: component.weight_g,
      origin: component.origin,
      slaughterhouse: component.slaughterhouse,
      cattleType: component.cattle_type,
      grade: component.grade,
    })),
    recentTraceability: recent.results.map((item) => ({ traceabilityNo: item.traceability_no, origin: item.origin, slaughterhouse: item.slaughterhouse, cattleType: item.cattle_type, grade: item.grade, lastUsedAt: item.last_used_at })),
    labels: labels.results.map((item) => ({ version: item.version, status: item.status, createdAt: item.created_at, printedAt: item.printed_at, voidedAt: item.voided_at })),
    assignmentHistory: assignments.results.map((item) => ({ id: item.id, reason: item.reason, fromOrderNo: item.from_order_no, toOrderNo: item.to_order_no, changedAt: item.changed_at })),
    auditEvents: audits.results.map((item) => ({ id: item.id, type: item.event_type, createdAt: item.created_at })),
    labelActionRequired: assignments.results.some((item) => item.reason === "EARLY_CUSTOMER_ARRIVAL" || item.reason === "PACKAGE_REASSIGNED") ? "VOID_AND_REPRINT" : null,
  };
}

export function labelPayloadFromDetail(detail: WorkshopPackageDetail) {
  return buildLabelPayload({
    packageCode: detail.packageCode,
    orderNo: detail.orderNo,
    productName: detail.productName,
    schedule: detail.schedule,
    qrValue: detail.qrValue,
    components: detail.components,
  });
}
