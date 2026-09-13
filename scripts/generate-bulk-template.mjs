import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, "../public/templates/jeongilpum-bulk-orders.xlsx");

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "정일품";
  workbook.lastModifiedBy = "정일품";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Sheet: 상품목록 (Reference Sheet)
  const refSheet = workbook.addWorksheet("상품목록", {
    views: [{ showGridLines: true }],
  });

  refSheet.columns = [
    { header: "상품명", key: "name", width: 22 },
    { header: "정가(원)", key: "price", width: 15 },
  ];

  const catalogProducts = [
    { name: "실속세트", price: 144000 },
    { name: "봉황세트", price: 200000 },
    { name: "팔영세트", price: 300000 },
    { name: "진", price: 320000 },
    { name: "선", price: 270000 },
    { name: "미", price: 220000 },
    { name: "O'meat Signature", price: 289000 },
    { name: "O'meat Prestige", price: 389000 },
    { name: "LA갈비 1호", price: 99000 },
    { name: "LA갈비 2호", price: 148000 },
    { name: "사골×우족", price: 59000 },
    { name: "사골×잡뼈×꼬리", price: 99000 },
    { name: "기타", price: null },
  ];

  refSheet.addRows(catalogProducts);

  // Format refSheet header
  const refHeaderRow = refSheet.getRow(1);
  refHeaderRow.font = { name: "Pretendard", bold: true, color: { argb: "FFFFFFFF" } };
  refHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2E384D" },
  };
  refHeaderRow.alignment = { horizontal: "center", vertical: "middle" };

  for (let r = 2; r <= catalogProducts.length + 1; r++) {
    const row = refSheet.getRow(r);
    row.font = { name: "Pretendard" };
    row.getCell(2).numFmt = "#,##0";
  }

  // 2. Sheet: 주문입력 (Main Sheet)
  const sheet = workbook.addWorksheet("주문입력", {
    views: [{ showGridLines: true }],
  });

  // Title & Instructions in Rows 1~4
  sheet.mergeCells("A1:O1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "정일품 명절 선물세트 대량 주문서";
  titleCell.font = { name: "Pretendard", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF8B1D24" }, // Jeongilpum Wine/Burgundy color
  };
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 36;

  sheet.mergeCells("A2:O2");
  const sub1 = sheet.getCell("A2");
  sub1.value = "• [필수 입력] 출고일, 수령방식, 주문자명, 주문자연락처, 상품명, 수량은 반드시 입력해주세요.";
  sub1.font = { name: "Pretendard", size: 10, bold: true, color: { argb: "FF333333" } };
  sub1.alignment = { vertical: "middle", indent: 1 };

  sheet.mergeCells("A3:O3");
  const sub2 = sheet.getCell("A3");
  sub2.value = "• [단가/합계 자동계산] 상품명을 선택하시면 정가와 수량에 따른 합계금액이 자동 계산됩니다. '기타' 선택 시 단가·수량을 직접 입력하고 비고란에 품목명을 적어주세요.";
  sub2.font = { name: "Pretendard", size: 10, color: { argb: "FF555555" } };
  sub2.alignment = { vertical: "middle", indent: 1 };

  sheet.mergeCells("A4:O4");
  const sub3 = sheet.getCell("A4");
  sub3.value = "• [택배/배달 발송] 택배 또는 배달 수령 시 받는사람, 연락처, 주소를 정확히 작성해주세요. (현장수령 시 비워두셔도 됩니다)";
  sub3.font = { name: "Pretendard", size: 10, color: { argb: "FF555555" } };
  sub3.alignment = { vertical: "middle", indent: 1 };

  for (let r = 2; r <= 4; r++) {
    sheet.getRow(r).height = 20;
    sheet.getRow(r).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF7F8FA" },
    };
  }

  // Row 5: Column Headers
  const headers = [
    "출고일(희망수령일)*",
    "수령방식*",
    "주문자명*",
    "주문자연락처*",
    "상품명*",
    "수량*",
    "단가",
    "합계금액",
    "받는사람",
    "받는사람연락처",
    "받는사람주소",
    "방문시간",
    "배송메시지",
    "결제상태",
    "비고(기타상품내용/메모)",
  ];

  const headerRow = sheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.font = { name: "Pretendard", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // Color-coded headers
  for (let c = 1; c <= headers.length; c++) {
    const cell = headerRow.getCell(c);
    if (c <= 8) {
      // Core order & items (Navy Blue)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    } else if (c <= 11) {
      // Shipping / Recipient (Slate Green)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    } else {
      // Time, Memo, Payment (Slate Gray)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    }
  }

  sheet.columns = [
    { width: 17 }, // 출고일
    { width: 12 }, // 수령방식
    { width: 15 }, // 주문자명
    { width: 16 }, // 주문자연락처
    { width: 20 }, // 상품명
    { width: 8 },  // 수량
    { width: 14 }, // 단가
    { width: 15 }, // 합계금액
    { width: 13 }, // 받는사람
    { width: 16 }, // 받는사람연락처
    { width: 36 }, // 받는사람주소
    { width: 12 }, // 방문시간
    { width: 22 }, // 배송메시지
    { width: 12 }, // 결제상태
    { width: 28 }, // 비고
  ];

  // Data Validation & Formulas for Rows 6 to 100 on 주문입력
  const productNamesStr = catalogProducts.map((p) => p.name).join(",");

  for (let r = 6; r <= 100; r++) {
    const row = sheet.getRow(r);
    row.font = { name: "Pretendard", size: 10 };

    // Set formulas for unit price and total amount
    row.getCell(7).value = {
      formula: `IF(E${r}="기타","",IFERROR(VLOOKUP(E${r},상품목록!$A$2:$B$13,2,FALSE),""))`,
    };
    row.getCell(8).value = {
      formula: `IF(OR(F${r}="",G${r}=""),"",F${r}*G${r})`,
    };

    // Number formatting
    row.getCell(1).numFmt = "@";
    row.getCell(4).numFmt = "@";
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(10).numFmt = "@";
    row.getCell(12).numFmt = "@";

    // Alignments
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(11).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(12).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(13).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(14).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(15).alignment = { horizontal: "left", vertical: "middle" };

    // Dropdown Data Validations
    // 1. 수령방식
    row.getCell(2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"현장수령,택배,배달"'],
      showErrorMessage: true,
      errorTitle: "입력 오류",
      error: "현장수령, 택배, 배달 중 선택해주세요.",
    };

    // 2. 상품명
    row.getCell(5).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${productNamesStr}"`],
      showErrorMessage: true,
      errorTitle: "상품 선택",
      error: "목록에 있는 상품명을 선택해주세요. 목록에 없는 상품은 '기타'를 선택하세요.",
    };

    // 3. 결제상태
    row.getCell(14).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"미결제,결제완료"'],
      showErrorMessage: true,
      errorTitle: "결제상태",
      error: "미결제 또는 결제완료를 선택해주세요.",
    };

    // Thin borders
    for (let c = 1; c <= 15; c++) {
      row.getCell(c).border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  }

  // 3. Sheet: 작성예시 (Sample Sheet with realistic demonstrations)
  const exampleSheet = workbook.addWorksheet("작성예시", {
    views: [{ showGridLines: true }],
  });

  exampleSheet.mergeCells("A1:O1");
  const exTitle = exampleSheet.getCell("A1");
  exTitle.value = "정일품 대량 주문서 작성 예시 (참고용)";
  exTitle.font = { name: "Pretendard", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  exTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  exTitle.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  exampleSheet.getRow(1).height = 32;

  const exHeaderRow = exampleSheet.getRow(2);
  exHeaderRow.values = headers;
  exHeaderRow.height = 28;
  exHeaderRow.font = { name: "Pretendard", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  exHeaderRow.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= headers.length; c++) {
    const cell = exHeaderRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
  }

  for (let c = 1; c <= headers.length; c++) {
    exampleSheet.getColumn(c).width = sheet.getColumn(c).width;
  }

  // 3 Sample Rows in 작성예시
  const sampleData = [
    {
      date: "2026-09-14",
      method: "현장수령",
      buyer: "홍길동",
      buyerPhone: "010-1234-5678",
      product: "봉황세트",
      qty: 2,
      price: 200000,
      total: 400000,
      recipient: "",
      recipientPhone: "",
      address: "",
      time: "15:00",
      memo: "",
      payment: "결제완료",
      note: "매장 픽업 예정",
    },
    {
      date: "2026-09-14",
      method: "택배",
      buyer: "한화손해보험",
      buyerPhone: "010-5555-6666",
      product: "팔영세트",
      qty: 1,
      price: 300000,
      total: 300000,
      recipient: "김철수",
      recipientPhone: "010-9876-5432",
      address: "광주 북구 서강로 104-3 1810호",
      time: "",
      memo: "부재 시 경비실에 맡겨주세요",
      payment: "결제완료",
      note: "",
    },
    {
      date: "2026-09-15",
      method: "택배",
      buyer: "박신자",
      buyerPhone: "010-3333-4444",
      product: "기타",
      qty: 1,
      price: 150000,
      total: 150000,
      recipient: "이영희",
      recipientPhone: "010-7777-8888",
      address: "서울 강남구 테헤란로 123 4층",
      time: "",
      memo: "배송 전 연락 요망",
      payment: "미결제",
      note: "구이용 15만원 세트(선물세트x)",
    },
  ];

  for (let idx = 0; idx < sampleData.length; idx++) {
    const r = 3 + idx;
    const item = sampleData[idx];
    const row = exampleSheet.getRow(r);
    row.font = { name: "Pretendard", size: 10 };
    row.getCell(1).value = item.date;
    row.getCell(2).value = item.method;
    row.getCell(3).value = item.buyer;
    row.getCell(4).value = item.buyerPhone;
    row.getCell(5).value = item.product;
    row.getCell(6).value = item.qty;
    row.getCell(7).value = item.price;
    row.getCell(8).value = item.total;
    row.getCell(9).value = item.recipient;
    row.getCell(10).value = item.recipientPhone;
    row.getCell(11).value = item.address;
    row.getCell(12).value = item.time;
    row.getCell(13).value = item.memo;
    row.getCell(14).value = item.payment;
    row.getCell(15).value = item.note;

    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";

    for (let c = 1; c <= 15; c++) {
      row.getCell(c).border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel template generated successfully at: ${outputPath}`);
}

generateTemplate().catch((err) => {
  console.error("Failed to generate Excel template:", err);
  process.exit(1);
});
