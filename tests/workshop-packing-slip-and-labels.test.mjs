import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDeliveryType,
  deliveryClassificationLabel,
  calculateSetCutRequirements,
  prepareInspectionItems,
  generatePackingLabels,
  formatPaymentStatus,
} from "../app/lib/workshop-packing-slip.ts";

test("classifyDeliveryType distinguishes onsite, shipping, and direct delivery based on method and notes", () => {
  assert.equal(
    classifyDeliveryType({ deliveryMethod: "onsite_reservation", note: "" }),
    "onsite"
  );
  assert.equal(
    classifyDeliveryType({ deliveryMethod: "onsite_sale", note: "" }),
    "onsite"
  );
  assert.equal(
    classifyDeliveryType({ deliveryMethod: "delivery", address: "서울시 강남구" }),
    "shipping"
  );
  assert.equal(
    classifyDeliveryType({ deliveryMethod: "delivery", note: "직접배달 부탁드립니다" }),
    "direct_delivery"
  );
  assert.equal(
    classifyDeliveryType({ deliveryMethod: "onsite_reservation", note: "가게 근처 퀵배달" }),
    "direct_delivery"
  );

  assert.equal(deliveryClassificationLabel("onsite"), "현장수령");
  assert.equal(deliveryClassificationLabel("shipping"), "택배발송");
  assert.equal(deliveryClassificationLabel("direct_delivery"), "직접배달");
});

test("calculateSetCutRequirements accurately calculates packs for Bonghwang, Palyeong, and O'meat sets", () => {
  const mockItems = [
    {
      id: "w-1",
      orderNo: "JI-260912-0001",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 5,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T14:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "김철수",
      buyerPhone: "01011112222",
    },
    {
      id: "w-2",
      orderNo: "JI-260912-0002",
      productId: "palyeong",
      productName: "팔영세트",
      quantity: 3,
      deliveryMethod: "delivery",
      dueAt: "2026-09-12T18:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "이영희",
      buyerPhone: "01033334444",
    },
    {
      id: "w-3",
      orderNo: "JI-260912-0003",
      productId: "omeat-signature",
      productName: "O'meat Signature",
      quantity: 2,
      deliveryMethod: "delivery",
      dueAt: "2026-09-12T18:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "박민수",
      buyerPhone: "01055556666",
    },
  ];

  const result = calculateSetCutRequirements(mockItems);

  // 봉황: 5세트 (5팩씩 = 25팩), 팔영: 3세트 (7팩씩 = 21팩) -> 진공 총 46팩
  assert.equal(result.totalVacuumPacks, 46);
  // 오미트 시그니처: 2세트 (6팩씩 = 12팩) -> 오미트 총 12팩
  assert.equal(result.totalOmeatPacks, 12);
  // 전체 총 팩수: 46 + 12 = 58팩
  assert.equal(result.totalAllPacks, 58);

  // 상품별 지침서 기반 중량 및 용기 규격 안내(weightSpec) 검증
  const bh = result.vacuumProducts.find((p) => p.name === "봉황세트");
  assert.ok(bh?.weightSpec.includes("1,000g"));
  assert.ok(bh?.weightSpec.includes("162202"));
  const py = result.vacuumProducts.find((p) => p.name === "팔영세트");
  assert.ok(py?.weightSpec.includes("1,260g"));
  assert.ok(py?.weightSpec.includes("162202"));
  const om = result.omeatProducts.find((p) => p.name === "O'meat Signature");
  assert.ok(om?.weightSpec.includes("1,300g"));
  assert.ok(om?.weightSpec.includes("241702"));

  // 162202 용기 정밀 스킨팩 목록 검증 (봉황·팔영)
  const sp162 = Object.fromEntries(result.skinPacks162202.map((c) => [`${c.cutName}_${c.weight}`, c]));
  assert.equal(sp162["치마살_180g"]?.packs, 8);
  assert.equal(sp162["치마살_180g"]?.container, "162202");
  assert.equal(sp162["차돌박이_280g"]?.packs, 5); // 봉황 차돌박이는 280g 특수중량
  assert.equal(sp162["차돌박이_280g"]?.container, "162202");
  assert.equal(sp162["업진살_180g"]?.packs, 3);
  assert.equal(sp162["살치살_180g"]?.packs, 3);
  assert.equal(sp162["채끝_180g"]?.packs, 3);

  // 241702 용기 정밀 스킨팩 목록 검증 (오미트 시그니처)
  const sp241 = Object.fromEntries(result.skinPacks241702.map((c) => [`${c.cutName}_${c.weight}`, c]));
  assert.equal(sp241["치마살_200g"]?.packs, 2);
  assert.equal(sp241["치마살_200g"]?.container, "241702");
  assert.equal(sp241["차돌박이_300g"]?.packs, 2); // 오미트 차돌박이는 300g 특수중량
  assert.equal(sp241["차돌박이_300g"]?.container, "241702");
  assert.equal(sp241["채끝_200g"]?.packs, 2);

  // 하위 호환용 cuts 및 cutPack 검증
  const cutPacks = Object.fromEntries(result.cuts.map((c) => [c.cutName, c]));
  assert.equal(cutPacks["치마살"].vacuumPacks, 8);
  assert.equal(cutPacks["치마살"].omeatPacks, 2);
  assert.equal(cutPacks["차돌박이"].vacuumPacks, 5);
  assert.equal(cutPacks["차돌박이"].omeatPacks, 2);
});

test("calculateSetCutRequirements excludes V8, LA, and baskets from skin pack calculations and focuses only on Bonghwang, Palyeong, and O'meat", () => {
  const mockItems = [
    {
      id: "w-v8",
      orderNo: "JI-260912-0010",
      productId: "practical",
      productName: "실속세트",
      quantity: 3,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T10:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "홍길동",
      buyerPhone: "01011112222",
    },
    {
      id: "w-la",
      orderNo: "JI-260912-0011",
      productId: "la-1",
      productName: "LA갈비 1호",
      quantity: 2,
      deliveryMethod: "delivery",
      dueAt: "2026-09-12T14:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "이순신",
      buyerPhone: "01022223333",
    },
    {
      id: "w-basket",
      orderNo: "JI-260912-0012",
      productId: "jin",
      productName: "진",
      quantity: 1,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T16:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "강감찬",
      buyerPhone: "01033334444",
    },
    {
      id: "w-bh",
      orderNo: "JI-260912-0013",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 2,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T17:00:00+09:00",
      workStatus: "confirmed",
      note: "",
      buyerName: "이순신",
      buyerPhone: "01055556666",
    },
  ];

  const result = calculateSetCutRequirements(mockItems);

  // V8 실속형, LA갈비 1호, 진 바구니는 스킨팩 대상에서 완전 제외됨
  // 오직 봉황 2세트(10팩)만 스킨팩으로 계산됨
  assert.equal(result.skinPacks162202.reduce((s, i) => s + i.packs, 0), 10);
  assert.equal(result.skinPacks241702.length, 0);
  assert.equal(result.totalVacuumPacks, 10);
  assert.equal(result.totalOmeatPacks, 0);
  assert.equal(result.totalAllPacks, 10);

  // otherProducts에 비스킨팩 품목 분류
  assert.equal(result.otherProducts.length, 3);
  assert.ok(result.otherProducts.some((p) => p.name === "실속세트"));
  assert.ok(result.otherProducts.some((p) => p.name === "LA갈비 1호"));
  assert.ok(result.otherProducts.some((p) => p.name === "진"));
});

test("generatePackingLabels creates exact (n/N) labels with sender/receiver details for shipping", () => {
  const items = [
    {
      id: "w-1",
      orderNo: "JI-260912-0001",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 2,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T14:00:00+09:00",
      workStatus: "in_progress",
      paymentStatus: "paid",
      note: "오후 2시 수령",
      buyerName: "김철수",
      buyerPhone: "010-1111-2222",
    },
    {
      id: "w-2",
      orderNo: "JI-260912-0002",
      productId: "palyeong",
      productName: "팔영세트",
      quantity: 1,
      deliveryMethod: "delivery",
      dueAt: "2026-09-12T18:00:00+09:00",
      workStatus: "in_progress",
      paymentStatus: "unpaid",
      recipientName: "홍길동",
      recipientPhone: "010-9999-8888",
      postalCode: "12345",
      roadAddr: "서울시 강남구 테헤란로 1",
      detailAddr: "101호",
      buyerName: "이영희",
      buyerPhone: "010-3333-4444",
      note: "문 앞 배송",
    },
  ];

  const labels = generatePackingLabels(items, "2026-09-12");

  // 총 3장의 라벨 (2 + 1)
  assert.equal(labels.length, 3);

  // 라벨 1: 김철수 (1/2)
  assert.equal(labels[0].buyerName, "김철수");
  assert.equal(labels[0].productName, "봉황세트");
  assert.equal(labels[0].quantityBadge, "(1/2)");
  assert.equal(labels[0].pickupTime, "14:00");
  assert.equal(labels[0].paymentStatusLabel, "결제완료");

  // 라벨 2: 김철수 (2/2)
  assert.equal(labels[1].buyerName, "김철수");
  assert.equal(labels[1].quantityBadge, "(2/2)");

  // 라벨 3: 택배건 (1/1)
  assert.equal(labels[2].buyerName, "이영희");
  assert.equal(labels[2].recipientName, "홍길동");
  assert.equal(labels[2].recipientPhone, "010-9999-8888");
  assert.match(labels[2].fullAddress, /12345/);
  assert.match(labels[2].fullAddress, /테헤란로 1 101호/);
  assert.equal(labels[2].paymentStatusLabel, "미결제");
  assert.equal(labels[2].classificationLabel, "택배발송");
});

test("formatPaymentStatus handles paid, unpaid, partial, refunded", () => {
  assert.deepEqual(formatPaymentStatus("paid"), { label: "결제완료", isPaid: true });
  assert.deepEqual(formatPaymentStatus("unpaid"), { label: "미결제", isPaid: false });
  assert.deepEqual(formatPaymentStatus("partial"), { label: "부분결제", isPaid: false });
  assert.deepEqual(formatPaymentStatus("refunded"), { label: "환불", isPaid: false });
  assert.deepEqual(formatPaymentStatus(undefined), { label: "미결제", isPaid: false });
});

test("prepareInspectionItems orders chronologically and separates onsite, shipping, and direct delivery", () => {
  const items = [
    {
      id: "w-ship",
      orderNo: "JI-0003",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 1,
      deliveryMethod: "delivery",
      dueAt: "2026-09-12T18:00:00+09:00",
      workStatus: "confirmed",
      buyerName: "택배고객",
      buyerPhone: "010-0000-0000",
      note: "",
    },
    {
      id: "w-late",
      orderNo: "JI-0002",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 1,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T15:00:00+09:00",
      workStatus: "confirmed",
      buyerName: "오후고객",
      buyerPhone: "010-0000-0000",
      note: "",
    },
    {
      id: "w-early",
      orderNo: "JI-0001",
      productId: "bonghwang",
      productName: "봉황세트",
      quantity: 1,
      deliveryMethod: "onsite_reservation",
      dueAt: "2026-09-12T11:00:00+09:00",
      workStatus: "confirmed",
      buyerName: "오전고객",
      buyerPhone: "010-0000-0000",
      note: "",
    },
  ];

  const prepared = prepareInspectionItems(items);
  assert.equal(prepared.length, 3);
  assert.equal(prepared[0].id, "w-early"); // 11:00 현장
  assert.equal(prepared[1].id, "w-late");  // 15:00 현장
  assert.equal(prepared[2].id, "w-ship");  // 택배
});
