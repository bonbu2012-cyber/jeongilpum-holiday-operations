import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("KioskApp does not require detailAddr for valid shipping address submission", async () => {
  const kiosk = await readFile(new URL("../app/components/KioskApp.tsx", import.meta.url), "utf8");
  // valid condition must only check postalValid and roadAddr length, not detailAddr
  assert.match(kiosk, /valid=postalValid&&draft\.roadAddr\.trim\(\)\.length>=5/);
  assert.doesNotMatch(kiosk, /valid=postalValid&&draft\.roadAddr\.trim\(\)\.length>=5&&draft\.detailAddr/);
  assert.match(kiosk, /상세주소 \(선택\)/);
});

test("CustomOrderApp does not require detailAddr for shipping order submission", async () => {
  const custom = await readFile(new URL("../app/components/CustomOrderApp.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(custom, /if \(!detailAddr\.trim\(\)\) nextErrors\.detailAddr = "상세 주소를 입력해주세요\.";/);
  assert.match(custom, /상세 주소 \(동·호수, 선택\)/);
});

test("WorkItemEditor integrates Kakao postcode search for delivery orders", async () => {
  const editor = await readFile(new URL("../app/components/WorkItemEditor.tsx", import.meta.url), "utf8");
  assert.match(editor, /loadPostcode/);
  assert.match(editor, /kakao-postcode-script/);
  assert.match(editor, /postcode\.v2\.js/);
  assert.match(editor, /카카오 도로명주소 검색/);
  assert.match(editor, /sales-address-confirmed-card/);
  assert.match(editor, /선택 확인된 주소/);
});

test("SalesApp and WorkshopApp render inline custom order composition and notes", async () => {
  const [sales, workshop, customDetails] = await Promise.all([
    readFile(new URL("../app/components/SalesApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/WorkshopApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CustomOrderDetails.tsx", import.meta.url), "utf8"),
  ]);

  // CustomOrderDetails includes inline composition box
  assert.match(customDetails, /custom-order-details__inline-box/);
  assert.match(customDetails, /custom-order-details__inline-tag/);

  // SalesApp includes stats button and inline notes/customization
  assert.match(sales, /📊 상품별 통계/);
  assert.match(sales, /ProductSalesStatsModal/);
  assert.match(sales, /sales-item-custom-box/);
  assert.match(sales, /sales-item-note-chip/);
  assert.match(sales, /sales-item-internal-note-chip/);

  // WorkshopApp includes separated customer request and internal memo
  assert.match(workshop, /workshop-customer-note/);
  assert.match(workshop, /workshop-internal-note/);
  assert.match(workshop, /custom-order-details__inline-box/);
});
