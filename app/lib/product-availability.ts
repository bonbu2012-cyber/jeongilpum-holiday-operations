export type AvailabilityProduct = {
  id: string;
  remainingQuantity: number | null;
};

export function isProductSoldOut(product: Pick<AvailabilityProduct, "remainingQuantity">) {
  return product.remainingQuantity !== null && product.remainingQuantity <= 0;
}

export function clampCartToAvailability(
  cart: Record<string, number>,
  products: AvailabilityProduct[],
) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return Object.fromEntries(Object.entries(cart).map(([productId, rawQuantity]) => {
    const product = productsById.get(productId);
    const quantity = Number.isFinite(rawQuantity) ? Math.max(0, Math.floor(rawQuantity)) : 0;
    if (!product) return [productId, 0];
    if (product.remainingQuantity === null) return [productId, quantity];
    return [productId, Math.min(quantity, Math.max(0, product.remainingQuantity))];
  }));
}
