import { buildPackageCode } from "./package-domain";

type PackageItemRow = {
  id: string;
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  code: string;
};

type ExistingPackageRow = {
  id: string;
  package_code: string;
  product_id: string;
  order_item_id: string | null;
  package_sequence: number | null;
};

export type PackagePreparation = {
  statements: D1PreparedStatement[];
  expectedPackageCount: number;
};

function deterministicPackageId(orderItemId: string, sequence: number) {
  return `pkg:${orderItemId}:${sequence}`;
}

export async function prepareEnsureOrderPackages(
  db: D1Database,
  input: { orderId: string; orderNo: string; actorId: string; now: string },
): Promise<PackagePreparation> {
  const [itemResult, packageResult] = await Promise.all([
    db.prepare("SELECT oi.id,oi.product_id,oi.product_name_snapshot,oi.quantity,p.code FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.created_at,oi.id").bind(input.orderId).all<PackageItemRow>(),
    db.prepare("SELECT id,package_code,product_id,order_item_id,package_sequence FROM packages WHERE order_id=? AND package_status!='voided' ORDER BY created_at,id").bind(input.orderId).all<ExistingPackageRow>(),
  ]);

  const statements: D1PreparedStatement[] = [];
  const assignedKeys = new Set(packageResult.results.filter((item) => item.order_item_id && item.package_sequence).map((item) => `${item.order_item_id}:${item.package_sequence}`));
  const legacyByProduct = new Map<string, ExistingPackageRow[]>();
  for (const value of packageResult.results.filter((item) => !item.order_item_id)) {
    legacyByProduct.set(value.product_id, [...(legacyByProduct.get(value.product_id) ?? []), value]);
  }
  const productOrdinal = new Map<string, number>();

  for (const item of itemResult.results) {
    for (let sequence = 1; sequence <= item.quantity; sequence += 1) {
      const ordinal = (productOrdinal.get(item.product_id) ?? 0) + 1;
      productOrdinal.set(item.product_id, ordinal);
      const slotKey = `${item.id}:${sequence}`;
      let packageCode = buildPackageCode(item.code, input.orderNo, ordinal);
      let packageId = deterministicPackageId(item.id, sequence);

      if (!assignedKeys.has(slotKey)) {
        const legacy = legacyByProduct.get(item.product_id)?.shift();
        if (legacy) {
          packageCode = legacy.package_code;
          packageId = legacy.id;
          statements.push(db.prepare("UPDATE packages SET order_item_id=?,package_sequence=?,updated_at=? WHERE id=? AND order_id=? AND order_item_id IS NULL").bind(item.id, sequence, input.now, legacy.id, input.orderId));
        } else {
          statements.push(db.prepare("INSERT OR IGNORE INTO packages(id,order_id,order_item_id,package_sequence,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'queued',?,?)").bind(packageId, input.orderId, item.id, sequence, packageCode, item.product_id, item.product_name_snapshot, input.now, input.now));
        }
      } else {
        const existing = packageResult.results.find((value) => value.order_item_id === item.id && value.package_sequence === sequence);
        if (existing) {
          packageCode = existing.package_code;
          packageId = existing.id;
        }
      }

      statements.push(db.prepare("INSERT INTO package_components(id,package_id,product_component_id,component_name_snapshot,sort_order,traceability_required,weight_required,origin_required,slaughterhouse_required,updated_at) SELECT lower(hex(randomblob(16))),p.id,c.id,c.component_name,c.sort_order,c.traceability_required,c.weight_required,c.origin_required,c.slaughterhouse_required,? FROM packages p JOIN product_components c ON c.product_id=p.product_id AND c.active=1 WHERE p.package_code=? AND NOT EXISTS(SELECT 1 FROM package_components pc WHERE pc.package_id=p.id AND pc.product_component_id=c.id)").bind(input.now, packageCode));
      statements.push(db.prepare("INSERT INTO package_assignment_history(id,package_id,from_order_id,to_order_id,reason,changed_by,changed_at) SELECT lower(hex(randomblob(16))),p.id,NULL,p.order_id,'INITIAL_ASSIGNMENT',?,? FROM packages p WHERE p.package_code=? AND NOT EXISTS(SELECT 1 FROM package_assignment_history h WHERE h.package_id=p.id)").bind(input.actorId, input.now, packageCode));
    }
  }

  return { statements, expectedPackageCount: itemResult.results.reduce((sum, item) => sum + item.quantity, 0) };
}
