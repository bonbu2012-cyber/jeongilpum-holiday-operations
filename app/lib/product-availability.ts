export type ProductAvailabilityEvent = {
  id: string;
  entityId: string;
  afterData: string | null;
};

export function parseProductSoldOut(afterData: string | null | undefined) {
  if (!afterData) return false;
  try {
    const value = JSON.parse(afterData) as { soldOut?: unknown };
    return value.soldOut === true;
  } catch {
    return false;
  }
}

export function latestProductAvailability(events: ProductAvailabilityEvent[]) {
  const latest = new Map<string, { soldOut: boolean; version: string }>();
  for (const event of events) {
    if (!latest.has(event.entityId)) {
      latest.set(event.entityId, {
        soldOut: parseProductSoldOut(event.afterData),
        version: event.id,
      });
    }
  }
  return latest;
}

export function isProductSoldOut(product: { remainingQuantity: number | null }) {
  return product.remainingQuantity !== null && product.remainingQuantity <= 0;
}

export function clampCartToAvailability(
  cart: Record<string, number>,
  products: Array<{ id: string; remainingQuantity: number | null }>,
) {
  const soldOutIds = new Set(products.filter(isProductSoldOut).map((product) => product.id));
  let changed = false;
  const next = { ...cart };
  for (const productId of soldOutIds) {
    if ((next[productId] ?? 0) > 0) {
      next[productId] = 0;
      changed = true;
    }
  }
  return changed ? next : cart;
}
