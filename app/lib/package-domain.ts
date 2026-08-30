export type PackageComponentInput = {
  componentName: string;
  traceabilityRequired: boolean;
  weightRequired: boolean;
  originRequired: boolean;
  slaughterhouseRequired: boolean;
  traceabilityNo: string | null;
  weightG: number | null;
  origin: string;
  slaughterhouse: string;
  cattleType?: string;
  grade?: string;
};

export type LabelPayload = {
  packageCode: string;
  orderNo: string;
  productName: string;
  schedule: string;
  qrValue: string;
  components: Array<{ name: string; traceabilityNo: string; weightG: number; origin: string; slaughterhouse: string; cattleType: string; grade: string }>;
};

export function packageProductPrefix(productCode: string) {
  const segments = productCode.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  return (segments.at(-1) || "PKG").slice(0, 5);
}

export function packageOrderToken(orderNo: string) {
  const match = orderNo.toUpperCase().match(/JI-(\d{6})-([A-Z0-9]+)/);
  if (match) return `${match[1]}-${match[2]}`;
  return orderNo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-12) || "ORDER";
}

export function buildPackageCode(productCode: string, orderNo: string, sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("패키지 순번은 1 이상이어야 합니다.");
  return `${packageProductPrefix(productCode)}-${packageOrderToken(orderNo)}-${String(sequence).padStart(2, "0")}`;
}

export function parseTraceabilityScan(raw: string) {
  const normalized = raw.trim();
  if (!normalized) return { ok: false as const, error: "이력번호를 입력하거나 스캔해주세요." };
  // TODO: 실제 현장 복합 바코드 샘플과 공식 규격을 확인한 뒤 별도 parser를 추가한다.
  if (!/^\d+$/.test(normalized)) return { ok: false as const, error: "복합 바코드 형식은 아직 지원하지 않습니다. 샘플 규격 확인이 필요합니다." };
  if (normalized.length > 64) return { ok: false as const, error: "이력번호가 너무 깁니다." };
  return { ok: true as const, traceabilityNo: normalized, raw: normalized };
}

export function validateTraceabilityLength(value: string, allowedLengths: number[] = []) {
  if (!allowedLengths.length) return { ok: true as const };
  return allowedLengths.includes(value.length)
    ? { ok: true as const }
    : { ok: false as const, error: `허용된 이력번호 자릿수(${allowedLengths.join(", ")})와 일치하지 않습니다.` };
}

export function validatePackageComponents(components: PackageComponentInput[]) {
  const errors: string[] = [];
  for (const component of components) {
    if (component.traceabilityRequired && !component.traceabilityNo) errors.push(`${component.componentName}: 이력번호가 필요합니다.`);
    if (component.weightRequired && (!component.weightG || component.weightG <= 0)) errors.push(`${component.componentName}: 0g보다 큰 중량이 필요합니다.`);
    if (component.originRequired && !component.origin.trim()) errors.push(`${component.componentName}: 원산지가 필요합니다.`);
    if (component.slaughterhouseRequired && !component.slaughterhouse.trim()) errors.push(`${component.componentName}: 도축장이 필요합니다.`);
  }
  return errors;
}

export function buildLabelPayload(input: Omit<LabelPayload, "components"> & { components: PackageComponentInput[] }): LabelPayload {
  const errors = validatePackageComponents(input.components);
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    packageCode: input.packageCode,
    orderNo: input.orderNo,
    productName: input.productName,
    schedule: input.schedule,
    qrValue: input.qrValue,
    components: input.components.map((component) => ({
      name: component.componentName,
      traceabilityNo: component.traceabilityNo ?? "",
      weightG: component.weightG ?? 0,
      origin: component.origin,
      slaughterhouse: component.slaughterhouse,
      cattleType: component.cattleType ?? "",
      grade: component.grade ?? "",
    })),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function labelPayloadToWideCsv(payload: LabelPayload) {
  // 한 패키지에 여러 구성품이 함께 붙는 현재 라벨 흐름에는 wide가 적합하다.
  // TODO: Open Label 연동처가 구성품별 행을 요구하는지 확인되면 long exporter를 별도로 추가한다.
  const headers = ["package_code", "order_number", "product_name", "schedule", "qr_value"];
  const values: unknown[] = [payload.packageCode, payload.orderNo, payload.productName, payload.schedule, payload.qrValue];
  payload.components.forEach((component, index) => {
    const position = index + 1;
    headers.push("component_" + position + "_name", "component_" + position + "_traceability_no", "component_" + position + "_weight_g", "component_" + position + "_origin", "component_" + position + "_slaughterhouse", "component_" + position + "_cattle_type", "component_" + position + "_grade");
    values.push(component.name, component.traceabilityNo, component.weightG, component.origin, component.slaughterhouse, component.cattleType, component.grade);
  });
  return `${headers.map(csvCell).join(",")}\r\n${values.map(csvCell).join(",")}\r\n`;
}
