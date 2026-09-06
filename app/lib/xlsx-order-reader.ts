import type { BulkOrderRowInput } from "./bulk-order-import";

type ZipEntry = { name: string; compression: number; compressedSize: number; localHeaderOffset: number };

const uploadHeaders = [
  "주문그룹키*", "수령방법*", "주문자명*", "주문자연락처*", "수령인명(택배필수)", "수령인연락처(택배필수)",
  "우편번호(택배필수)", "도로명주소(택배필수)", "참고주소", "지번주소", "상세주소(택배필수)",
  "수령/발송일*", "현장수령시간(현장필수)", "상품코드*", "수량*", "주문메모",
] as const;
const decoder = new TextDecoder("utf-8");
const element = (name: string) => `(?:\\w+:)?${name}`;

function uint16(view: DataView, offset: number) { return view.getUint16(offset, true); }
function uint32(view: DataView, offset: number) { return view.getUint32(offset, true); }

function xmlText(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`(?:^|\\s)${name.replace(":", "\\:")}="([^"]*)"`).exec(tag);
  return match ? xmlText(match[1]) : "";
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset;
  }
  throw new Error("올바른 .xlsx 파일이 아닙니다.");
}

function zipEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const end = findEndOfCentralDirectory(bytes);
  const count = uint16(view, end + 10);
  let offset = uint32(view, end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < count; index += 1) {
    if (uint32(view, offset) !== 0x02014b50) throw new Error("엑셀 파일의 ZIP 목록을 읽지 못했습니다.");
    const compression = uint16(view, offset + 10);
    const compressedSize = uint32(view, offset + 20);
    const nameLength = uint16(view, offset + 28);
    const extraLength = uint16(view, offset + 30);
    const commentLength = uint16(view, offset + 32);
    const localHeaderOffset = uint32(view, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replaceAll("\\", "/");
    entries.set(name, { name, compression, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { bytes, view, entries };
}

async function entryBytes(entry: ZipEntry, source: { bytes: Uint8Array; view: DataView }) {
  const { bytes, view } = source;
  const offset = entry.localHeaderOffset;
  if (uint32(view, offset) !== 0x04034b50) throw new Error("엑셀 파일 항목을 읽지 못했습니다.");
  const start = offset + 30 + uint16(view, offset + 26) + uint16(view, offset + 28);
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8) throw new Error("지원하지 않는 엑셀 압축 방식입니다.");
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function normalizePath(path: string) {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function worksheetPath(workbookXml: string, relsXml: string) {
  const sheetName = element("sheet");
  const sheetTags = workbookXml.match(new RegExp(`<${sheetName}\\b[^>]*\\/?>(?:<\\/${sheetName}>)?`, "g")) ?? [];
  const inputSheet = sheetTags.find((tag) => attribute(tag, "name") === "주문입력");
  if (!inputSheet) throw new Error("'주문입력' 시트를 찾을 수 없습니다. 제공된 양식을 사용해주세요.");
  const relationshipId = attribute(inputSheet, "r:id");
  const relationshipName = element("Relationship");
  const relationshipTags = relsXml.match(new RegExp(`<${relationshipName}\\b[^>]*\\/?>(?:<\\/${relationshipName}>)?`, "g")) ?? [];
  const relationship = relationshipTags.find((tag) => attribute(tag, "Id") === relationshipId);
  if (!relationship) throw new Error("'주문입력' 시트 연결을 읽지 못했습니다.");
  const target = attribute(relationship, "Target");
  return normalizePath(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
}

function sharedStrings(xml: string) {
  const values: string[] = [];
  const itemName = element("si");
  const textName = element("t");
  for (const match of xml.matchAll(new RegExp(`<${itemName}\\b[^>]*>([\\s\\S]*?)<\\/${itemName}>`, "g"))) {
    values.push([...match[1].matchAll(new RegExp(`<${textName}\\b[^>]*>([\\s\\S]*?)<\\/${textName}>`, "g"))]
      .map((part) => xmlText(part[1])).join(""));
  }
  return values;
}

function columnIndex(reference: string) {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value - 1;
}

function rowsFromWorksheet(xml: string, strings: string[]) {
  const rows: Array<{ rowNumber: number; values: unknown[] }> = [];
  const rowName = element("row");
  const cellName = element("c");
  const valueName = element("v");
  const textName = element("t");
  const rowRegex = new RegExp(`<${rowName}\\b([^>]*)>([\\s\\S]*?)<\\/${rowName}>`, "g");
  const cellRegex = new RegExp(`<${cellName}\\b([^>]*)>([\\s\\S]*?)<\\/${cellName}>`, "g");
  const valueRegex = new RegExp(`<${valueName}\\b[^>]*>([\\s\\S]*?)<\\/${valueName}>`);
  const textRegex = new RegExp(`<${textName}\\b[^>]*>([\\s\\S]*?)<\\/${textName}>`);
  for (const rowMatch of xml.matchAll(rowRegex)) {
    const rowNumber = Number(attribute(rowMatch[1], "r"));
    const values: unknown[] = [];
    for (const cellMatch of rowMatch[2].matchAll(cellRegex)) {
      const reference = attribute(cellMatch[1], "r");
      const type = attribute(cellMatch[1], "t");
      const index = columnIndex(reference);
      const body = cellMatch[2];
      const raw = valueRegex.exec(body)?.[1] ?? "";
      if (type === "s") values[index] = strings[Number(raw)] ?? "";
      else if (type === "inlineStr") values[index] = xmlText(textRegex.exec(body)?.[1] ?? "");
      else if (type === "str") values[index] = xmlText(raw);
      else if (raw === "") values[index] = "";
      else values[index] = Number.isFinite(Number(raw)) ? Number(raw) : xmlText(raw);
    }
    rows.push({ rowNumber, values });
  }
  return rows;
}

export function excelSerialToIsoDate(serial: number) {
  if (!Number.isFinite(serial)) return "";
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10);
}

export function excelSerialToTime(serial: number) {
  if (!Number.isFinite(serial)) return "";
  const totalMinutes = Math.round((serial - Math.floor(serial)) * 1_440) % 1_440;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function readBulkOrderWorkbook(buffer: ArrayBuffer): Promise<BulkOrderRowInput[]> {
  const source = zipEntries(buffer);
  const loadXml = async (name: string, required = true) => {
    const entry = source.entries.get(name);
    if (!entry) {
      if (!required) return "";
      throw new Error(`엑셀 파일에서 ${name}을 찾지 못했습니다.`);
    }
    return decoder.decode(await entryBytes(entry, source));
  };
  const [workbookXml, relsXml, stringsXml] = await Promise.all([
    loadXml("xl/workbook.xml"), loadXml("xl/_rels/workbook.xml.rels"), loadXml("xl/sharedStrings.xml", false),
  ]);
  const sheetXml = await loadXml(worksheetPath(workbookXml, relsXml));
  const rows = rowsFromWorksheet(sheetXml, stringsXml ? sharedStrings(stringsXml) : []);
  const header = rows.find(({ values }) => uploadHeaders.every((value, index) => String(values[index] ?? "").trim() === value));
  if (!header) throw new Error("주문입력 시트의 열 이름이 양식과 다릅니다. 제공된 양식을 다시 내려받아 사용해주세요.");
  return rows
    .filter((row) => row.rowNumber > header.rowNumber)
    .filter((row) => row.values.slice(0, uploadHeaders.length).some((value) => String(value ?? "").trim() !== ""))
    .map((row) => ({
      rowNumber: row.rowNumber,
      groupKey: row.values[0], fulfillmentMethod: row.values[1], buyerName: row.values[2], buyerPhone: row.values[3],
      recipientName: row.values[4], recipientPhone: row.values[5], postalCode: row.values[6], roadAddr: row.values[7],
      roadAddrReference: row.values[8], jibunAddr: row.values[9], detailAddr: row.values[10],
      scheduleDate: typeof row.values[11] === "number" ? excelSerialToIsoDate(row.values[11]) : row.values[11],
      pickupTime: typeof row.values[12] === "number" ? excelSerialToTime(row.values[12]) : row.values[12],
      productCode: row.values[13], quantity: row.values[14], note: row.values[15],
    }));
}
