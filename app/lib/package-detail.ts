import type { WorkshopPackageDetail } from "./package-types";

type PackageRow = { id: string; order_id: string; package_code: string; package_status: string; order_no: string; product_name_snapshot: string; fulfillment_type: "pickup" | "shipping"; pickup_at: string | null; ship_date: string | null };
type PackRow = { id: string; skin_pack_code: string; component_code: string; component_name: string; quantity_slot: number; weight_g: number; traceability_no: string; origin: string; slaughterhouse: string; cattle_type: string; grade: string; manufactured_at: string; storage_method: string; expiry_text: string; packaging_material: string; food_type: string };
type LabelRow = { version: number; status: "draft" | "printed" | "void"; created_at: string; printed_at: string | null; voided_at: string | null };
type AuditRow = { id: string; event_type: string; created_at: string };
type AssignmentRow = { id: string; reason: string; from_order_no: string | null; to_order_no: string; changed_at: string };

export async function loadWorkshopPackage(db: D1Database, packageCode: string): Promise<WorkshopPackageDetail | null> {
  const value = await db.prepare("SELECT p.id,p.order_id,p.package_code,p.package_status,p.product_name_snapshot,o.order_no,f.fulfillment_type,f.pickup_at,f.ship_date FROM packages p JOIN orders o ON o.id=p.order_id JOIN fulfillments f ON f.order_id=o.id WHERE p.package_code=?").bind(packageCode).first<PackageRow>();
  if (!value) return null;
  const [packs, labels, assignments, audits] = await Promise.all([
    db.prepare("SELECT sp.id,sp.skin_pack_code,sp.component_code,pc.component_name,psp.quantity_slot,sp.weight_g,sp.traceability_no,sp.origin,sp.slaughterhouse,sp.cattle_type,sp.grade,sp.manufactured_at,sp.storage_method,sp.expiry_text,sp.packaging_material,sp.food_type FROM package_skin_packs psp JOIN skin_packs sp ON sp.id=psp.skin_pack_id JOIN product_components pc ON pc.id=psp.product_component_id WHERE psp.package_id=? ORDER BY pc.sort_order,psp.quantity_slot,sp.skin_pack_code").bind(value.id).all<PackRow>(),
    db.prepare("SELECT version,status,created_at,printed_at,voided_at FROM package_labels WHERE package_id=? ORDER BY version DESC LIMIT 10").bind(value.id).all<LabelRow>(),
    db.prepare("SELECT h.id,h.reason,fo.order_no AS from_order_no,t.order_no AS to_order_no,h.changed_at FROM package_assignment_history h LEFT JOIN orders fo ON fo.id=h.from_order_id JOIN orders t ON t.id=h.to_order_id WHERE h.package_id=? ORDER BY h.changed_at DESC,h.id DESC").bind(value.id).all<AssignmentRow>(),
    db.prepare("SELECT id,event_type,created_at FROM order_events WHERE order_id=? AND event_type IN ('PACKAGE_ASSEMBLED','PACKAGE_LABEL_PREVIEWED','PACKAGE_REASSIGNED') AND after_data LIKE ? ORDER BY created_at DESC,id DESC LIMIT 30").bind(value.order_id, '%"packageId":"' + value.id + '"%').all<AuditRow>(),
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
    skinPacks: packs.results.map((pack) => ({ id: pack.id, skinPackCode: pack.skin_pack_code, componentName: pack.component_name, componentCode: pack.component_code, quantitySlot: pack.quantity_slot, weightG: pack.weight_g, traceabilityNo: pack.traceability_no, origin: pack.origin, slaughterhouse: pack.slaughterhouse, cattleType: pack.cattle_type, grade: pack.grade, manufacturedAt: pack.manufactured_at, storageMethod: pack.storage_method, expiryText: pack.expiry_text, packagingMaterial: pack.packaging_material, foodType: pack.food_type })),
    labels: labels.results.map((item) => ({ version: item.version, status: item.status, createdAt: item.created_at, printedAt: item.printed_at, voidedAt: item.voided_at })),
    assignmentHistory: assignments.results.map((item) => ({ id: item.id, reason: item.reason, fromOrderNo: item.from_order_no, toOrderNo: item.to_order_no, changedAt: item.changed_at })),
    auditEvents: audits.results.map((item) => ({ id: item.id, type: item.event_type, createdAt: item.created_at })),
    labelActionRequired: assignments.results.some((item) => item.reason === "EARLY_CUSTOMER_ARRIVAL" || item.reason === "PACKAGE_REASSIGNED") ? "VOID_AND_REPRINT" : null,
  };
}

export function packageLabelPayload(detail: WorkshopPackageDetail) {
  return {
    packageCode: detail.packageCode,
    productName: detail.productName,
    qrValue: detail.qrValue,
    skinPacks: detail.skinPacks.map((pack) => ({ skinPackCode: pack.skinPackCode, cutName: pack.componentName })),
  };
}