"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AppNav from "./AppNav";
import {
  todayInSeoul,
  validateAndGroupBulkOrderRows,
  type BulkOrderFulfillmentType,
  type BulkOrderGroup,
  type BulkOrderRowInput,
  type BulkOrderValidationError,
} from "../lib/bulk-order-import";
import { readBulkOrderWorkbook } from "../lib/xlsx-order-reader";
import {
  isLegacyOrderCsv,
  parseLegacyOrderRows,
  type LegacyParsedOrder,
} from "../lib/legacy-order-csv-importer";

type Product = {
  id: string;
  code: string;
  name: string;
  price: number;
};

type ImportResult = {
  groupKey: string;
  status: "created" | "existing" | "failed";
  orderNo?: string;
  message?: string;
};

type ImportResponse = {
  error?: string;
  errors?: BulkOrderValidationError[];
  summary?: { createdCount: number; existingCount: number; failedCount: number };
  results?: ImportResult[];
};

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function resultLabel(status: ImportResult["status"]) {
  if (status === "created") return "접수 완료";
  if (status === "existing") return "기존 접수";
  return "접수 실패";
}

function fulfillmentLabel(type: BulkOrderFulfillmentType) {
  return type === "pickup" ? "현장수령" : "택배발송";
}

function scheduleLabel(group: BulkOrderGroup) {
  return group.fulfillmentType === "pickup"
    ? `${group.scheduleDate} · ${group.pickupTime}`
    : `${group.scheduleDate} 발송`;
}

export default function BulkOrderUploadApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [rows, setRows] = useState<BulkOrderRowInput[]>([]);
  const [legacyOrders, setLegacyOrders] = useState<LegacyParsedOrder[]>([]);
  const [groups, setGroups] = useState<BulkOrderGroup[]>([]);
  const [errors, setErrors] = useState<BulkOrderValidationError[]>([]);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);

  useEffect(() => {
    void fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { products?: Product[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "상품을 불러오지 못했습니다.");
        setProducts(data.products ?? []);
      })
      .catch((caught) => setCatalogError(caught instanceof Error ? caught.message : "상품을 불러오지 못했습니다."))
      .finally(() => setCatalogLoading(false));
  }, []);

  const productsByCode = useMemo(() => new Map(products.map((product) => [product.code.toUpperCase(), product])), [products]);
  const productErrors = useMemo(() => {
    if (legacyOrders.length > 0) return [];
    return groups.flatMap((group) => group.items.flatMap((item) => (
      products.length && item.productCode !== "CUSTOM" && !productsByCode.has(item.productCode)
        ? item.rowNumbers.map((rowNumber) => ({ rowNumber, field: "상품코드", message: "현재 상품코드표에 없는 상품입니다." }))
        : []
    )));
  }, [groups, products.length, productsByCode, legacyOrders.length]);

  const allErrors = [...errors, ...productErrors];
  const quantityTotal = legacyOrders.length > 0
    ? legacyOrders.reduce((sum, order) => sum + order.quantity, 0)
    : groups.reduce((sum, group) => sum + group.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const amountTotal = legacyOrders.length > 0
    ? legacyOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    : groups.reduce((sum, group) => sum + (
        group.totalAmount > 0
          ? group.totalAmount
          : group.items.reduce((itemSum, item) => {
              const product = productsByCode.get(item.productCode);
              const unitPrice = item.unitPrice ?? product?.price ?? 0;
              return itemSum + unitPrice * item.quantity;
            }, 0)
      ), 0);
  const pickupCount = groups.filter((group) => group.fulfillmentType === "pickup").length;
  const shippingCount = groups.length - pickupCount;

  const resetSelection = () => {
    setFileName("");
    setFileHash("");
    setRows([]);
    setLegacyOrders([]);
    setGroups([]);
    setErrors([]);
    setResults([]);
    setNotice("");
  };

  const chooseFile = async (file: File | undefined) => {
    resetSelection();
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isCsv = lowerName.endsWith(".csv");
    const isXlsx = lowerName.endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      setErrors([{ rowNumber: null, field: "파일", message: ".xlsx 또는 .csv 파일만 업로드할 수 있습니다." }]);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors([{ rowNumber: null, field: "파일", message: "파일 크기는 5MB 이하여야 합니다." }]);
      return;
    }
    setReading(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const digest = await sha256(buffer);
      setFileHash(digest);

      if (isCsv) {
        const text = new TextDecoder("utf-8").decode(buffer);
        if (!isLegacyOrderCsv(text)) {
          setErrors([{ rowNumber: null, field: "파일", message: "기존 앱 명단 서식(주문번호, 출고일, 상품 등 16개 열)이 아닙니다." }]);
          return;
        }
        const { orders, errors: parseErrors } = parseLegacyOrderRows(text, products);
        if (parseErrors.length > 0) {
          setErrors(parseErrors.map((msg) => ({ rowNumber: null, field: "CSV", message: msg })));
          return;
        }
        setLegacyOrders(orders);
        const legacyGroups: BulkOrderGroup[] = orders.map((order) => ({
          groupKey: order.orderNo,
          fulfillmentType: order.fulfillmentType,
          deliveryMethod: order.deliveryMethod,
          buyerName: order.buyerName,
          buyerPhone: order.buyerPhone,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          postalCode: "",
          roadAddr: order.roadAddr,
          roadAddrReference: "",
          jibunAddr: "",
          detailAddr: order.detailAddr,
          scheduleDate: order.scheduleDate,
          pickupTime: order.pickupTime,
          note: order.note,
          paymentStatus: order.paymentStatus === "paid" ? "paid" : "unpaid",
          totalAmount: order.totalAmount,
          rowNumbers: [order.rawRowNumber],
          items: [{
            productCode: order.productCode,
            productName: order.productName,
            unitPrice: order.unitPrice,
            lineTotal: order.lineTotal,
            isCustom: order.productId === "custom-order",
            quantity: order.quantity,
            rowNumbers: [order.rawRowNumber],
          }],
        }));
        setGroups(legacyGroups);
        setNotice(`기존 앱 명단 ${orders.length}건을 읽었습니다. 접수 내용을 확인 후 업로드해주세요.`);
      } else {
        const parsedRows = await readBulkOrderWorkbook(buffer);
        const validation = validateAndGroupBulkOrderRows(parsedRows, todayInSeoul());
        setRows(parsedRows);
        setGroups(validation.groups);
        setErrors(validation.errors);
        setNotice(validation.errors.length ? "오류를 수정한 뒤 파일을 다시 선택해주세요." : "업로드 전 검사가 끝났습니다.");
      }
    } catch (caught) {
      setErrors([{ rowNumber: null, field: "파일", message: caught instanceof Error ? caught.message : "파일을 읽지 못했습니다." }]);
    } finally {
      setReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const upload = async () => {
    if (!fileHash || (!rows.length && !legacyOrders.length) || allErrors.length || uploading || catalogLoading || catalogError) return;
    setUploading(true);
    setNotice("");
    setResults([]);
    try {
      const body = legacyOrders.length > 0
        ? { fileHash, legacyOrders }
        : { fileHash, rows };
      const response = await fetch("/api/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as ImportResponse;
      if (!response.ok) {
        setErrors(data.errors ?? [{ rowNumber: null, field: "업로드", message: data.error ?? "주문을 접수하지 못했습니다." }]);
        setNotice("저장하지 않았습니다. 오류를 수정한 뒤 다시 업로드해주세요.");
        return;
      }
      setResults(data.results ?? []);
      const summary = data.summary;
      setNotice(summary
        ? `${summary.createdCount}건 접수, ${summary.existingCount}건 기존 접수, ${summary.failedCount}건 실패`
        : "업로드를 처리했습니다.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "주문을 접수하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bulk-order-app">
      <main className="bulk-order-main">
        <section className="bulk-order-intro" aria-labelledby="bulk-order-title">
          <div>
            <p className="bulk-order-eyebrow">판매장 업무</p>
            <h1 id="bulk-order-title">엑셀로 대량 주문 접수</h1>
            <p>한 양식에서 현장수령과 택배발송을 함께 작성하세요. 저장 전에 행 오류와 주문 묶음을 확인할 수 있습니다.</p>
          </div>
          <a
            className="ui-button ui-button--ghost ui-button--md bulk-order-download"
            href="/templates/jeongilpum-bulk-orders.xlsx"
            download="정일품_대량주문_업로드양식.xlsx"
          >
            <Download size={17} aria-hidden="true" />
            엑셀 양식 받기
          </a>
        </section>

        <section className="bulk-order-panel" aria-labelledby="bulk-file-title">
          <div className="bulk-order-panel__heading">
            <div>
              <span>1</span>
              <div>
                <h2 id="bulk-file-title">파일 선택</h2>
                <p>주문입력 .xlsx 파일 또는 기존 앱의 .csv 파일을 읽습니다.</p>
              </div>
            </div>
            <small>최대 200행 · 5MB</small>
          </div>
          <input
            ref={fileInputRef}
            className="sr-only"
            id="bulk-order-file"
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <label className="bulk-order-dropzone" htmlFor="bulk-order-file">
            <FileSpreadsheet size={30} aria-hidden="true" />
            <strong>{reading ? "파일을 확인하는 중입니다" : fileName || "엑셀(.xlsx) 또는 명단(.csv) 파일 선택"}</strong>
            <span>{fileName ? "다른 파일을 선택하려면 다시 누르세요." : "파일은 브라우저 저장소에 보관하지 않습니다."}</span>
          </label>
          {catalogLoading ? <p className="bulk-order-message" role="status">상품 정보를 불러오는 중입니다.</p> : null}
          {catalogError ? <p className="bulk-order-message bulk-order-message--error" role="alert">{catalogError}</p> : null}
        </section>

        {allErrors.length ? (
          <section className="bulk-order-panel bulk-order-panel--error" aria-labelledby="bulk-errors-title">
            <div className="bulk-order-panel__heading">
              <div>
                <AlertTriangle size={20} aria-hidden="true" />
                <div>
                  <h2 id="bulk-errors-title">수정이 필요한 항목</h2>
                  <p>아래 항목을 엑셀에서 고친 뒤 파일을 다시 선택하세요.</p>
                </div>
              </div>
              <strong>{allErrors.length}개</strong>
            </div>
            <ul className="bulk-order-errors">
              {allErrors.slice(0, 40).map((error, index) => (
                <li key={`${error.rowNumber}-${error.field}-${index}`}>
                  <b>{error.rowNumber ? `${error.rowNumber}행` : error.field}</b>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
            {allErrors.length > 40 ? <p className="bulk-order-more-errors">나머지 {allErrors.length - 40}개 오류도 파일에서 함께 확인해주세요.</p> : null}
          </section>
        ) : null}

        {groups.length && !allErrors.length ? (
          <section className="bulk-order-panel" aria-labelledby="bulk-preview-title">
            <div className="bulk-order-panel__heading">
              <div>
                <span>2</span>
                <div>
                  <h2 id="bulk-preview-title">접수 내용 확인</h2>
                  <p>같은 주문그룹키의 여러 상품 행은 한 주문으로 접수됩니다.</p>
                </div>
              </div>
              <div className="bulk-order-summary" aria-label="업로드 요약">
                <strong>{groups.length}건</strong>
                <span>현장 {pickupCount}건</span>
                <span>택배 {shippingCount}건</span>
                <span>상품 {quantityTotal}개</span>
                <span>{won(amountTotal)}</span>
              </div>
            </div>
            <div className="bulk-order-table-scroll">
              <table className="bulk-order-table">
                <thead>
                  <tr>
                    <th scope="col">그룹키</th>
                    <th scope="col">수령방법</th>
                    <th scope="col">수령 대상</th>
                    <th scope="col">일정</th>
                    <th scope="col">상품</th>
                    <th scope="col">금액</th>
                    <th scope="col">결제상태</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group, gIdx) => {
                    const legacy = legacyOrders[gIdx];
                    const total = legacy
                      ? legacy.totalAmount
                      : (group.totalAmount > 0
                          ? group.totalAmount
                          : group.items.reduce((sum, item) => {
                              const unitPrice = item.unitPrice ?? productsByCode.get(item.productCode)?.price ?? 0;
                              return sum + unitPrice * item.quantity;
                            }, 0));
                    const displayName = group.fulfillmentType === "pickup" ? group.buyerName : (group.recipientName || group.buyerName);
                    const displayPhone = group.fulfillmentType === "pickup" ? group.buyerPhone : (group.recipientPhone || group.buyerPhone);
                    const productText = legacy
                      ? `${legacy.productName} × ${legacy.quantity}`
                      : group.items.map((item) => `${item.productName || productsByCode.get(item.productCode)?.name || item.productCode} × ${item.quantity}`).join(", ");
                    const isPaid = group.paymentStatus === "paid" || legacy?.paymentStatus === "paid";
                    return (
                      <tr key={group.groupKey}>
                        <th scope="row">{group.groupKey}</th>
                        <td><strong>{fulfillmentLabel(group.fulfillmentType)}</strong></td>
                        <td><strong>{displayName}</strong><small>{displayPhone}</small></td>
                        <td>{scheduleLabel(group)}</td>
                        <td>{productText}</td>
                        <td>{won(total)}</td>
                        <td>
                          <span className={`ui-badge ${isPaid ? "ui-badge--success" : "ui-badge--neutral"}`}>
                            {isPaid ? "결제완료" : "미결제"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bulk-order-submit">
              <p>양식에 입력된 결제상태(결제완료/미결제) 및 수령방식(현장/택배/배달)에 맞춰 접수됩니다.</p>
              <button className="bulk-order-upload-button" disabled={uploading || catalogLoading || Boolean(catalogError)} onClick={() => void upload()}>
                <Upload size={17} aria-hidden="true" />
                {uploading ? "일괄 주문 업로드 중" : `일괄 주문 업로드 (${groups.length}건)`}
              </button>
            </div>
          </section>
        ) : null}

        {results.length ? (
          <section className="bulk-order-panel bulk-order-panel--result" aria-labelledby="bulk-results-title">
            <div className="bulk-order-panel__heading">
              <div>
                <CheckCircle2 size={20} aria-hidden="true" />
                <div>
                  <h2 id="bulk-results-title">접수 결과</h2>
                  <p>{notice}</p>
                </div>
              </div>
            </div>
            <div className="bulk-order-results">
              {results.map((result) => (
                <div key={result.groupKey} className={`bulk-order-result bulk-order-result--${result.status}`}>
                  <strong>{result.groupKey}</strong>
                  <span>{resultLabel(result.status)}</span>
                  <b>{result.orderNo ?? result.message}</b>
                </div>
              ))}
            </div>
          </section>
        ) : notice && fileName ? <p className="bulk-order-message" role="status">{notice}</p> : null}
      </main>
      <AppNav current="bulk" />
    </div>
  );
}
